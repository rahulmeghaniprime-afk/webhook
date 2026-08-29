import { authenticate, unauthenticated } from "../shopify.server";
import db from "../db.server";

// ============================================================================
// UPLOAD FILE HELPER (STAGED UPLOAD -> S3/GCS -> FILE CREATE -> WAIT FOR READY)
// ============================================================================
async function waitForShopifyFileReady(admin, fileId, maxAttempts = 15, delayMs = 800) {
    if (!fileId) return null;

    const fileQuery = `
      query GetFileStatus($id: ID!) {
        node(id: $id) {
          __typename
          ... on GenericFile {
            id
            fileStatus
            url
          }
          ... on MediaImage {
            id
            fileStatus
            image {
              url
            }
          }
          ... on Video {
            id
            fileStatus
            sources {
              url
            }
          }
        }
      }
    `;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const res = await admin.graphql(fileQuery, {
                variables: { id: fileId },
            });
            const json = await res.json();
            const node = json?.data?.node;

            if (node) {
                const status = node.fileStatus;
                const finalUrl = node.url || node.image?.url || (node.sources && node.sources[0]?.url);

                if (status === "READY" && finalUrl) {
                    return finalUrl;
                }

                if (status === "FAILED") {
                    console.warn(`Shopify file ${fileId} failed processing.`);
                    break;
                }
            }
        } catch (err) {
            console.warn(`Error checking file status (attempt ${attempt + 1}):`, err?.message);
        }

        // Wait before next check
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return null;
}

async function uploadFileToShopify(admin, file) {
    if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
        return null;
    }

    const isImage = (file.type || "").startsWith("image/");
    const filename = file.name || `upload_${Date.now()}`;
    const mimeType = file.type || "application/octet-stream";

    let stagedResourceUrl = null;
    let fileId = null;
    let finalUrl = null;

    try {
        // 1. Create Staged Upload Target
        const stagedMutation = `
          mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
              stagedTargets {
                url
                resourceUrl
                parameters {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const stageRes = await admin.graphql(stagedMutation, {
            variables: {
                input: [{
                    filename,
                    mimeType,
                    httpMethod: "POST",
                    resource: isImage ? "IMAGE" : "FILE",
                    fileSize: String(file.size),
                }],
            },
        });

        const stageJson = await stageRes.json();
        const stageTarget = stageJson?.data?.stagedUploadsCreate?.stagedTargets?.[0];

        if (stageTarget?.url) {
            stagedResourceUrl = stageTarget.resourceUrl;

            // 2. Upload file to target URL
            const uploadForm = new FormData();
            for (const p of stageTarget.parameters || []) {
                uploadForm.append(p.name, p.value);
            }
            const buf = await file.arrayBuffer();
            const blob = new Blob([buf], { type: mimeType });
            uploadForm.append("file", blob, filename);

            await fetch(stageTarget.url, {
                method: "POST",
                body: uploadForm,
            });
        }
    } catch (stageErr) {
        console.warn("Staged upload note:", stageErr?.message);
    }

    // 3. Register File in Shopify Files (if resourceUrl obtained)
    if (stagedResourceUrl) {
        try {
            const fileCreateMutation = `
              mutation FileCreate($files: [FileCreateInput!]!) {
                fileCreate(files: $files) {
                  files {
                    id
                    fileStatus
                    alt
                    ... on GenericFile { url }
                    ... on MediaImage { image { url } }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;

            const fileCreateRes = await admin.graphql(fileCreateMutation, {
                variables: {
                    files: [{
                        originalSource: stagedResourceUrl,
                        contentType: isImage ? "IMAGE" : "FILE",
                        alt: filename,
                    }],
                },
            });

            const fileCreateJson = await fileCreateRes.json();
            const created = fileCreateJson?.data?.fileCreate?.files?.[0];
            if (created?.id) {
                fileId = created.id;
                if (created.fileStatus === "READY") {
                    finalUrl = created.url || created.image?.url;
                }
            }
        } catch (createErr) {
            console.warn("fileCreate registration note:", createErr?.message);
        }
    }

    // 4. Wait until Shopify finishes processing file and returns permanent CDN URL
    if (fileId && !finalUrl) {
        finalUrl = await waitForShopifyFileReady(admin, fileId, 15, 800);
    }

    return {
        id: fileId,
        url: finalUrl || stagedResourceUrl || `local_upload_${filename}`,
        name: filename,
    };
}

// ============================================================================
// MAIN SUBMISSION HANDLER
// ============================================================================
export async function handleFormSubmission({ request }) {
    let formData;
    try {
        formData = await request.formData();
    } catch (formParseErr) {
        console.error("Failed to parse formData:", formParseErr);
        return Response.json({ success: false, error: "Invalid form submission data." }, { status: 400 });
    }

    const formId = formData.get("form_id");
    const submittedShop = formData.get("shop");
    const customerId = formData.get("customer_id") || null;

    let shopDomain = null;
    let admin = null;

    // Try app proxy authentication
    try {
        const proxyAuth = await authenticate.public.appProxy(request);
        if (proxyAuth?.session?.shop) {
            shopDomain = proxyAuth.session.shop;
            admin = proxyAuth.admin;
        }
    } catch (proxyAuthErr) {
        console.debug("App proxy auth info:", proxyAuthErr?.message);
    }

    if (!shopDomain && submittedShop) {
        shopDomain = submittedShop.includes(".myshopify.com") ? submittedShop : `${submittedShop}.myshopify.com`;
    }

    if (!shopDomain) {
        return Response.json({ success: false, error: "Missing shop identification." }, { status: 400 });
    }

    if (!admin) {
        try {
            const unauth = await unauthenticated.admin(shopDomain);
            admin = unauth.admin;
        } catch (unauthErr) {
            console.error("Failed to obtain admin client for shop:", shopDomain, unauthErr);
            return Response.json({ success: false, error: "Unable to authenticate with Shopify store." }, { status: 401 });
        }
    }

    if (!formId) {
        return Response.json({ success: false, error: "Missing form_id in submission." }, { status: 400 });
    }

    // Retrieve Form and FieldMappings from database
    const form = await db.form.findFirst({
        where: { id: formId, shop: shopDomain },
        include: { FieldMapping: true },
    });

    if (!form) {
        return Response.json({ success: false, error: "Form not found." }, { status: 404 });
    }

    const storedValues = {};
    const metaobjectFields = [];
    const missing = [];

    // Process all fields according to FieldMapping
    for (const mapping of form.FieldMapping) {
        const fieldKey = mapping.metaobjectKey;
        const fieldType = mapping.fieldType;
        const isRequired = Boolean(mapping.required);

        // 1. FILE FIELDS
        if (fieldType === "file" || fieldType === "file_reference" || fieldType === "list.file_reference") {
            const rawFiles = formData.getAll(mapping.fieldId).concat(formData.getAll(`${mapping.fieldId}[]`));
            const validFiles = rawFiles.filter(item => item && typeof item === "object" && item.size > 0);

            if (isRequired && validFiles.length === 0) {
                missing.push(mapping.fieldLabel);
                continue;
            }

            const uploadResults = await Promise.all(
                validFiles.map(f => uploadFileToShopify(admin, f))
            );
            const uploadedFiles = uploadResults.filter(Boolean);

            if (uploadedFiles.length > 0) {
                const fileGids = uploadedFiles.map(u => u.id).filter(Boolean);
                const fileUrls = uploadedFiles.map(u => u.url).filter(Boolean);

                storedValues[fieldKey] = fileUrls.length > 1 ? fileUrls : fileUrls[0];

                if (fileGids.length > 0) {
                    // Send as JSON array string for list fields or if multiple files, otherwise array format
                    const isListType = fieldType === "list.file_reference" || fileGids.length > 1 || fieldType === "file";
                    metaobjectFields.push({
                        key: fieldKey,
                        value: isListType ? JSON.stringify(fileGids) : fileGids[0],
                    });
                }
            } else if (validFiles.length > 0) {
                // Fallback store filename if upload target is not ready
                const fileNames = validFiles.map(f => f.name);
                storedValues[fieldKey] = fileNames.length > 1 ? fileNames : fileNames[0];
            }
        }
        // 2. CHECKBOX GROUPS (LIST OF VALUES)
        else if (fieldType === "checkbox_group" || fieldType === "list.single_line_text_field") {
            const rawValues = formData.getAll(mapping.fieldId).concat(formData.getAll(`${mapping.fieldId}[]`));
            const cleanChoices = rawValues.map(v => (v ?? "").toString().trim()).filter(Boolean);

            if (isRequired && cleanChoices.length === 0) {
                missing.push(mapping.fieldLabel);
                continue;
            }

            if (cleanChoices.length > 0) {
                storedValues[fieldKey] = cleanChoices;
                metaobjectFields.push({
                    key: fieldKey,
                    value: JSON.stringify(cleanChoices),
                });
            }
        }
        // 3. NUMBERS
        else if (fieldType === "number" || fieldType === "number_integer") {
            const raw = formData.get(mapping.fieldId);
            const strVal = (raw ?? "").toString().trim();

            if (isRequired && !strVal) {
                missing.push(mapping.fieldLabel);
                continue;
            }

            if (strVal) {
                const parsed = parseInt(strVal, 10);
                const finalVal = isNaN(parsed) ? strVal : String(parsed);
                storedValues[fieldKey] = finalVal;
                metaobjectFields.push({
                    key: fieldKey,
                    value: finalVal,
                });
            }
        }
        // 4. TEXT, DATE, TEXTAREA, SELECT, RADIO, EMAIL, PHONE
        else {
            const raw = formData.get(mapping.fieldId);
            const strVal = (raw ?? "").toString().trim();

            if (isRequired && !strVal) {
                missing.push(mapping.fieldLabel);
                continue;
            }

            if (strVal) {
                storedValues[fieldKey] = strVal;
                metaobjectFields.push({
                    key: fieldKey,
                    value: strVal,
                });
            }
        }
    }

    if (missing.length > 0) {
        return Response.json(
            { success: false, error: `Please fill in required fields: ${missing.join(", ")}` },
            { status: 422 },
        );
    }

    // 1. Create durable record in Prisma DB
    let submission;
    try {
        submission = await db.formSubmission.create({
            data: {
                formId: form.id,
                shop: shopDomain,
                customerId: customerId ? String(customerId) : null,
                payload: JSON.stringify(storedValues),
                status: "pending",
            },
        });
    } catch (dbErr) {
        console.error("Prisma formSubmission create error:", dbErr);
        return Response.json({ success: false, error: "Database error saving submission." }, { status: 500 });
    }

    // 2. Create Metaobject Entry in Shopify via Admin GraphQL
    const metaobjectCreateMutation = `
      mutation CreateMetaobjectEntry($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
            type
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    try {
        let metaRes = await admin.graphql(metaobjectCreateMutation, {
            variables: {
                metaobject: {
                    type: form.metaobjectType,
                    fields: metaobjectFields,
                },
            },
        });

        let metaJson = await metaRes.json();
        let userErrors = metaJson?.data?.metaobjectCreate?.userErrors;

        // Auto-fix for list fields where single string GID was passed instead of JSON array string
        if (userErrors?.some(e => e.message?.includes("Value is invalid JSON") || e.code === "INVALID_JSON")) {
            console.log("Auto-adjusting JSON formatting for metaobject fields and retrying...");
            const adjustedFields = metaobjectFields.map(f => {
                if (typeof f.value === "string" && !f.value.startsWith("[") && f.value.startsWith("gid://")) {
                    return { key: f.key, value: JSON.stringify([f.value]) };
                }
                return f;
            });

            metaRes = await admin.graphql(metaobjectCreateMutation, {
                variables: {
                    metaobject: {
                        type: form.metaobjectType,
                        fields: adjustedFields,
                    },
                },
            });

            metaJson = await metaRes.json();
            userErrors = metaJson?.data?.metaobjectCreate?.userErrors;
        }

        // If it failed because a single field needs raw string instead of array
        if (userErrors?.some(e => e.message?.includes("Value must be a single") || e.message?.includes("cannot be an array"))) {
            const adjustedFields = metaobjectFields.map(f => {
                if (typeof f.value === "string" && f.value.startsWith('["gid://') && f.value.endsWith('"]')) {
                    try {
                        const parsed = JSON.parse(f.value);
                        if (Array.isArray(parsed) && parsed.length === 1) {
                            return { key: f.key, value: parsed[0] };
                        }
                    } catch (pErr) {
                        console.debug("Parse note:", pErr);
                    }
                }
                return f;
            });

            metaRes = await admin.graphql(metaobjectCreateMutation, {
                variables: {
                    metaobject: {
                        type: form.metaobjectType,
                        fields: adjustedFields,
                    },
                },
            });

            metaJson = await metaRes.json();
            userErrors = metaJson?.data?.metaobjectCreate?.userErrors;
        }

        if (userErrors?.length) {
            console.error("Shopify metaobjectCreate userErrors:", userErrors);
            await db.formSubmission.update({
                where: { id: submission.id },
                data: {
                    status: "failed",
                    error: JSON.stringify(userErrors),
                },
            });

            return Response.json(
                {
                    success: false,
                    error: userErrors.map(e => e.message).join(", ") || "Failed to create Shopify Metaobject entry.",
                },
                { status: 400 },
            );
        }

        const createdMetaobject = metaJson?.data?.metaobjectCreate?.metaobject;

        if (createdMetaobject?.id) {
            await db.formSubmission.update({
                where: { id: submission.id },
                data: {
                    status: "created",
                    metaobjectId: createdMetaobject.id,
                },
            });

            return Response.json({
                success: true,
                message: "Form submitted successfully!",
                metaobjectId: createdMetaobject.id,
                submissionId: submission.id,
            });
        }
    } catch (metaErr) {
        console.error("GraphQL execution error during metaobjectCreate:", metaErr);
        await db.formSubmission.update({
            where: { id: submission.id },
            data: {
                status: "failed",
                error: metaErr?.message || "Unexpected GraphQL error",
            },
        });

        return Response.json(
            { success: false, error: "An unexpected error occurred while saving your entry to Shopify." },
            { status: 500 },
        );
    }

    return Response.json({ success: true, message: "Form submitted successfully!" });
}
