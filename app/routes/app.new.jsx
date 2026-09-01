import { useLoaderData, useSubmit, useActionData, useNavigation, useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import RichTextEditor from '../component/RichTextEditor';
import db from "../db.server";

// ============================================================================
// 1. HELPER: MAP ALL FIELD TYPES TO SHOPIFY METAOBJECT FIELD TYPE STRINGS
// ============================================================================
function mapToShopifyMetaobjectType(field) {
    const type = typeof field === "string" ? field : field?.type;
    const isMultiple = typeof field === "object" && Boolean(field?.multiple);

    switch (type) {
        case "number":
            return "number_integer";
        case "date":
            return "date";
        case "textarea":
            return "multi_line_text_field";
        case "checkbox_group":
            return "list.single_line_text_field";
        case "file":
            return isMultiple ? "list.file_reference" : "file_reference";
        case "email":
        case "text":
        case "select":
        case "radio":
        case "phone":
        default:
            return "single_line_text_field";
    }
}

// ============================================================================
// 2. HELPER: GENERATE CLEAN CLASS-BASED HTML & CSS
// ============================================================================
function generateFormHtmlAndCss(formId, title, description, fields, buttonLabel, policies, customerTag) {
    const css = `
    .b2b-form-wrapper { max-width: 600px; margin: 0 auto; padding: 28px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; border: 1px solid #e1e3e5; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .b2b-form-title { font-size: 22px; font-weight: 700; color: #1a1a1a; text-align: center; margin: 0 0 8px 0; }
    .b2b-form-desc { font-size: 13px; color: #6d6d6d; text-align: center; margin: 0 0 20px 0; line-height: 1.5; }
    .b2b-form-desc p { margin: 0; }
    .b2b-field-group { margin-bottom: 16px; }
    .b2b-label { display: block; font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 6px; }
    .b2b-required-star { color: #c0392b; margin-left: 2px; }
    .b2b-input, .b2b-select, .b2b-textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 13px; border: 1px solid #d5d5d5; border-radius: 6px; background: #fafafa; color: #1a1a1a; font-family: inherit; transition: border-color 0.2s, box-shadow 0.2s; }
    .b2b-input:focus, .b2b-select:focus, .b2b-textarea:focus { outline: none; border-color: #1a1a1a; box-shadow: 0 0 0 1px #1a1a1a; background: #ffffff; }
    .b2b-textarea { resize: vertical; min-height: 80px; }
    .b2b-choice-group { display: flex; flex-direction: row; gap: 8px; flex-wrap:wrap; }
    .b2b-choice-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #1a1a1a; cursor: pointer; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fafafa; width: fit-content; transition: background 0.15s; }
    .b2b-choice-label:hover { background: #f0f0f0; }
    .b2b-radio-input, .b2b-checkbox-input { width: 16px; height: 16px; accent-color: #1a1a1a; cursor: pointer; }
    .b2b-file-dropzone { border: 2px dashed #d0d0d0; border-radius: 8px; padding: 20px; text-align: center; background: #fafafa; position: relative; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
    .b2b-file-dropzone:hover { border-color: #1a1a1a; background: #f5f5f5; }
    .b2b-file-input { width: 100%; cursor: pointer; }
    .b2b-file-help { font-size: 11px; color: #888; margin-top: 6px; }
    .b2b-submit-btn { display: block; width: 100%; background: #1a1a1a; color: #ffffff; border: none; border-radius: 6px; padding: 12px 20px; font-size: 14px; font-weight: 600; text-align: center; cursor: pointer; margin-top: 20px; transition: background 0.15s; }
    .b2b-submit-btn:hover { background: #333333; }
    .b2b-policy-text { font-size: 11px; color: #999999; text-align: center; margin-top: 14px; line-height: 1.5; }
    .b2b-policy-text p { margin: 0; }
    .b2b-success-card { text-align: center; padding: 32px 16px; display: none; }
    .b2b-success-icon { width: 48px; height: 48px; margin: 0 auto 14px; border-radius: 50%; background: #e3f1df; color: #108043; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; }
    .b2b-success-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0; }
    .b2b-success-text { font-size: 14px; color: #6d6d6d; margin: 0; line-height: 1.5; }
    .b2b-error-box { background: #fff4f4; border: 1px solid #fed2d2; color: #c0392b; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; display: none; line-height: 1.4; }
    .b2b-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  `;

    const fieldsHtml = fields.map((field) => {
        const isRequired = field.required ? '<span class="b2b-required-star">*</span>' : '';
        let controlHtml = '';

        switch (field.type) {
            case 'customer_first_name':
            case 'customer_last_name':
            case 'customer_company_name':
            case 'text':
            case 'email':
            case 'number':
            case 'phone':
                const inputType = field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : 'text';
                controlHtml = `<input type="${inputType}" name="${field.id}" class="b2b-input" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} />`;
                break;

            case 'date':
                controlHtml = `<input type="date" name="${field.id}" class="b2b-input" ${field.required ? 'required' : ''} />`;
                break;

            case 'textarea':
                controlHtml = `<textarea name="${field.id}" class="b2b-textarea" rows="3" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea>`;
                break;

            case 'select': {
                const selectOpts = (field.options || []).map(opt => `<option value="${opt.value}">${opt.label || opt.value}</option>`).join('');
                controlHtml = `<select name="${field.id}" class="b2b-select" ${field.required ? 'required' : ''}><option value="" disabled selected>${field.placeholder || 'Select an option...'}</option>${selectOpts}</select>`;
                break;
            }

            case 'radio': {
                const radioOpts = (field.options || []).map(opt => `
          <label class="b2b-choice-label">
            <input type="radio" name="${field.id}" value="${opt.value}" class="b2b-radio-input" ${field.required ? 'required' : ''} />
            <span>${opt.label || opt.value}</span>
          </label>
        `).join('');
                controlHtml = `<div class="b2b-choice-group">${radioOpts}</div>`;
                break;
            }

            case 'checkbox_group': {
                const checkOpts = (field.options || []).map(opt => `
          <label class="b2b-choice-label">
            <input type="checkbox" name="${field.id}[]" value="${opt.value}" class="b2b-checkbox-input" />
            <span>${opt.label || opt.value}</span>
          </label>
        `).join('');
                controlHtml = `<div class="b2b-choice-group">${checkOpts}</div>`;
                break;
            }

            case 'file': {
                controlHtml = `
          <div class="b2b-file-dropzone">
            <input type="file" name="${field.id}${field.multiple ? '[]' : ''}" ${field.multiple ? 'multiple' : ''} class="b2b-file-input" ${field.required ? 'required' : ''} />
            <div class="b2b-file-help">${field.multiple ? 'Select or drag multiple files' : 'Select or drag a file'}</div>
          </div>
        `;
                break;
            }
            default:
                controlHtml = `<input type="text" name="${field.id}" class="b2b-input" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} />`;
                break;
        }

        return `
      <div class="b2b-field-group">
        <label class="b2b-label">${field.label || 'Untitled Field'}${isRequired}</label>
        ${controlHtml}
      </div>
    `;
    }).join('');

    const html = `
    <div class="b2b-form-wrapper" id="b2b-wrapper-${formId}" data-form-id="${formId}">
      <div class="b2b-form-header">
        <h2 class="b2b-form-title">${title || 'B2B Form'}</h2>
        ${description ? `<div class="b2b-form-desc">${description}</div>` : ''}
      </div>

      <form action="/apps/wholesale-form/submit" method="POST" enctype="multipart/form-data" class="b2b-form" id="b2b-form-${formId}">
        <input type="hidden" name="form_id" value="${formId}" />
        <input type="hidden" name="shop" value="{{ shop.permanent_domain }}" />
        <input type="hidden" name="customer_id" value="{{ customer.id }}" />
        <input type="hidden" name="customer_tag" value="${customerTag || ''}" />
        
        <div class="b2b-form-fields">
          ${fieldsHtml}
        </div>
        
        <button type="submit" class="b2b-submit-btn" id="b2b-btn-${formId}">${buttonLabel || 'Submit Application'}</button>

        <div id="b2b-status-${formId}" style="display:none; margin-top:16px; padding:12px 16px; border-radius:6px; font-size:13px; text-align:center; font-weight:600; line-height:1.4;"></div>
      </form>

      ${policies ? `<div class="b2b-policy-text" id="b2b-policy-${formId}">${policies}</div>` : ''}

      <script>
        (function() {
          var form = document.getElementById("b2b-form-${formId}");
          if (!form) return;

          form.addEventListener("submit", function(e) {
            e.preventDefault();
            var btn = document.getElementById("b2b-btn-${formId}");
            var statusBox = document.getElementById("b2b-status-${formId}");

            if (statusBox) {
              statusBox.style.display = "block";
              statusBox.style.background = "#f0f4f8";
              statusBox.style.color = "#333333";
              statusBox.style.border = "1px solid #d0d7de";
              statusBox.textContent = "Submitting form, please wait...";
            }
            if (btn) {
              btn.disabled = true;
              btn.textContent = "Submitting...";
            }

            var formData = new FormData(form);
            var targetUrl = form.getAttribute("action") || "/apps/wholesale-form/submit";

            fetch(targetUrl, {
              method: "POST",
              body: formData,
              headers: { "Accept": "application/json" }
            })
            .then(function(res) {
              return res.json().then(function(data) {
                return { ok: res.ok, data: data };
              }).catch(function() {
                return { ok: res.ok, data: { success: res.ok } };
              });
            })
            .then(function(result) {
              if (result.data && result.data.success) {
                if (statusBox) {
                  statusBox.style.display = "block";
                  statusBox.style.background = "#e3f1df";
                  statusBox.style.color = "#108043";
                  statusBox.style.border = "1px solid #c2e1bc";
                  statusBox.textContent = "✓ Form submitted successfully!";
                }
                form.reset();
              } else {
                var errorMsg = (result.data && result.data.error) ? result.data.error : "Submission failed. Please check your inputs and try again.";
                if (statusBox) {
                  statusBox.style.display = "block";
                  statusBox.style.background = "#fff4f4";
                  statusBox.style.color = "#c0392b";
                  statusBox.style.border = "1px solid #fed2d2";
                  statusBox.textContent = "✕ " + errorMsg;
                }
              }
            })
            .catch(function(err) {
              console.error("Submission error:", err);
              if (statusBox) {
                statusBox.style.display = "block";
                statusBox.style.background = "#fff4f4";
                statusBox.style.color = "#c0392b";
                statusBox.style.border = "1px solid #fed2d2";
                statusBox.textContent = "✕ Network error while submitting. Please try again.";
              }
            })
            .finally(function() {
              if (btn) {
                btn.disabled = false;
                btn.textContent = "${buttonLabel || 'Submit Application'}";
              }
            });
          });
        })();
      </script>
    </div>
  `;

    return { html, css };
}

// ============================================================================
// 3. REMIX / REACT ROUTER LOADER
// ============================================================================
export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const formName = url.searchParams.get('name') || 'New B2B Form';

    const tagRows = await db.tagData.findMany({
        where: { shop: session.shop },
        select: { tag: true },
        orderBy: { tag: 'asc' },
    });

    const customerTagOptions = [...new Set(tagRows.map((row) => row.tag).filter(Boolean))];

    return { formName, customerTagOptions };
};

// ============================================================================
// 4. ACTION HANDLER (CREATE METAOBJECT DEF & SAVE TO PRISMA DATABASE)
// ============================================================================
export const action = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);

    let body;
    try {
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            body = await request.json();
        } else {
            const formData = await request.formData();
            const rawData = formData.get("data") || formData.get("payload");
            if (rawData) {
                body = JSON.parse(rawData);
            } else {
                body = Object.fromEntries(formData);
                if (typeof body.fields === "string") {
                    body.fields = JSON.parse(body.fields);
                }
            }
        }
    } catch (parseError) {
        console.error("Payload parse error:", parseError);
        return Response.json(
            { success: false, errors: [{ message: "Invalid request payload format." }] },
            { status: 400 },
        );
    }

    const { title, description, buttonlabel, policies, fields, customerTag } = body ?? {};

    if (!Array.isArray(fields) || fields.length === 0) {
        return Response.json(
            { success: false, errors: [{ message: "Please add at least one field before saving the form." }] },
            { status: 400 },
        );
    }

    try {
        const configuredTags = await db.tagData.findMany({
            where: { shop: session.shop },
            select: { tag: true },
        });
        const validCustomerTags = [...new Set(configuredTags.map((row) => row.tag).filter(Boolean))];

        if (validCustomerTags.length === 0) {
            return Response.json(
                {
                    success: false,
                    errors: [{ message: "Please create at least one Customer Tag on the home page before saving this form." }],
                },
                { status: 400 },
            );
        }

        const selectedCustomerTag = typeof customerTag === 'string' ? customerTag.trim() : '';
        if (!selectedCustomerTag) {
            return Response.json(
                {
                    success: false,
                    errors: [{ message: "Customer Tag is required. Please select a configured tag before saving the form." }],
                },
                { status: 400 },
            );
        }

        if (!validCustomerTags.includes(selectedCustomerTag)) {
            return Response.json(
                {
                    success: false,
                    errors: [{ message: "The selected Customer Tag is no longer available. Please choose a valid configured tag." }],
                },
                { status: 400 },
            );
        }
        const uniqueHash = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const formId = `form_${uniqueHash}`;
        const metaobjectType = `b2b_${uniqueHash}`;

        const fieldDefinitions = [];
        const dbMappings = [];
        const usedKeys = new Set();

        // Build field definitions for Shopify Metaobjects & DB FieldMappings
        fields.forEach((field, index) => {
            let baseKey = (field.label || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9_]/g, "_")
                .replace(/^_+|_+$/g, "")
                .substring(0, 25);

            if (!baseKey || /^[0-9_]/.test(baseKey)) {
                baseKey = `field_${baseKey || index}`.replace(/^_+|_+$/g, "").substring(0, 25);
            }
            if (!baseKey || baseKey.length < 2) {
                baseKey = `field_${index + 1}`;
            }

            let metaKey = baseKey;
            let suffix = 1;
            while (usedKeys.has(metaKey)) {
                const suffixStr = `_${suffix}`;
                metaKey = `${baseKey.substring(0, 25 - suffixStr.length)}${suffixStr}`;
                suffix += 1;
            }
            usedKeys.add(metaKey);

            const shopifyFieldType = mapToShopifyMetaobjectType(field);

            fieldDefinitions.push({
                key: metaKey,
                name: (field.label || `Field ${index + 1}`).substring(0, 60),
                type: shopifyFieldType,
                required: false, // Optional in metaobject schema for maximum submission flexibility
            });

            dbMappings.push({
                id: `fm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}_${index}`,
                fieldId: field.id,
                fieldLabel: field.label || `Field ${index + 1}`,
                fieldType: shopifyFieldType,
                metaobjectKey: metaKey,
                required: Boolean(field.required),
            });
        });

        // Create Shopify Metaobject Definition via Admin GraphQL
        const metaDefMutation = `
          mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
            metaobjectDefinitionCreate(definition: $definition) {
              metaobjectDefinition {
                id
                type
                name
              }
              userErrors {
                field
                message
                code
              }
            }
          }
        `;

        const metaDefName = `B2B Form - ${(title || "Application").trim()}`.substring(0, 60);

        const metaDefRes = await admin.graphql(metaDefMutation, {
            variables: {
                definition: {
                    name: metaDefName,
                    type: metaobjectType,
                    displayNameKey: fieldDefinitions[0]?.key,
                    fieldDefinitions,
                },
            },
        });

        const metaDefJson = await metaDefRes.json();

        if (metaDefJson.errors?.length) {
            console.error("GraphQL error creating metaobject definition:", metaDefJson.errors);
            return Response.json(
                {
                    success: false,
                    errors: metaDefJson.errors.map((e) => ({ message: e.message })),
                },
                { status: 400 },
            );
        }

        const metaDefResult = metaDefJson?.data?.metaobjectDefinitionCreate;
        const metaErrors = metaDefResult?.userErrors;

        if (metaErrors && metaErrors.length > 0) {
            console.error("Shopify metaobjectDefinitionCreate userErrors:", metaErrors);
            return Response.json({ success: false, errors: metaErrors }, { status: 400 });
        }

        const metaobjectDefId = metaDefResult?.metaobjectDefinition?.id;

        if (!metaobjectDefId) {
            return Response.json(
                {
                    success: false,
                    errors: [{ message: "Shopify did not return a metaobject definition ID." }],
                },
                { status: 502 },
            );
        }

        // Generate class-based HTML & CSS
        const { html, css } = generateFormHtmlAndCss(formId, title, description, fields, buttonlabel, policies, selectedCustomerTag);

        // Store Form and mappings in Prisma DB
        let savedForm;
        try {
            savedForm = await db.form.create({
                data: {
                    id: formId,
                    shop: session.shop,
                    name: title || "New B2B Form",
                    html,
                    css,
                    metaobjectType,
                    metaobjectDefId,
                    FieldMapping: {
                        create: dbMappings,
                    },
                },
                include: {
                    FieldMapping: true,
                },
            });
        } catch (dbError) {
            console.error("Failed to persist form after metaobject definition was created:", dbError);

            // Roll back the metaobject definition if DB write fails to prevent orphaned records
            let rollbackSucceeded = false;
            try {
                const rollbackRes = await admin.graphql(
                    `mutation DeleteOrphanedDefinition($id: ID!) {
                        metaobjectDefinitionDelete(id: $id) {
                            deletedId
                            userErrors { field message }
                        }
                    }`,
                    { variables: { id: metaobjectDefId } },
                );
                const rollbackJson = await rollbackRes.json();
                rollbackSucceeded = Boolean(rollbackJson?.data?.metaobjectDefinitionDelete?.deletedId);
            } catch (rollbackError) {
                console.error("Rollback of metaobject definition also failed:", rollbackError);
            }

            return Response.json(
                {
                    success: false,
                    errors: [{
                        message: rollbackSucceeded
                            ? "We could not save the form to the database. The Shopify Metaobject Definition was automatically reverted. Please try again."
                            : "We could not save the form to the database. Automatic revert of the Metaobject Definition was incomplete. Please check Settings > Custom data in Shopify admin.",
                    }],
                },
                { status: 500 },
            );
        }

        return Response.json({ success: true, form: savedForm }, { status: 200 });
    } catch (error) {
        console.error("Unexpected error creating B2B form:", error);
        return Response.json(
            { success: false, errors: [{ message: "Something went wrong while saving the form: " + (error?.message || "Unknown error") }] },
            { status: 500 },
        );
    }
};

// ============================================================================
// 5. REACT UI COMPONENT (FORM BUILDER & LIVE PREVIEW)
// ============================================================================
const FIELD_TYPES = [
    { type: "customer_first_name", title: "First Name", description: "Customer first name field for later approval flow", defaultLabel: "First Name", defaultPlaceholder: "Enter first name...", hasOptions: false, icon: "text-font", customerFieldKey: "first_name" },
    { type: "customer_last_name", title: "Last Name", description: "Customer last name field for later approval flow", defaultLabel: "Last Name", defaultPlaceholder: "Enter last name...", hasOptions: false, icon: "text-font", customerFieldKey: "last_name" },
    { type: "customer_company_name", title: "Company Name", description: "Customer company name field for later approval flow", defaultLabel: "Company Name", defaultPlaceholder: "Enter company name...", hasOptions: false, icon: "text-font", customerFieldKey: "company_name" },
    { type: "email", title: "Email", description: "Email address input", defaultLabel: "Email Address", defaultPlaceholder: "Enter email address...", hasOptions: false, icon: "email" },
    { type: "text", title: "Single-line text", description: "Short single-line text input", defaultLabel: "Full Name / Company Representative", defaultPlaceholder: "Enter full name...", hasOptions: false, icon: "text-font" },
    { type: "select", title: "Dropdown list", description: "Select one option from a dropdown menu", defaultLabel: "Business Entity Type", defaultPlaceholder: "Select your business type...", hasOptions: true, defaultOptions: [{ id: "opt_1", label: "Wholesaler / Distributor", value: "wholesaler" }, { id: "opt_2", label: "Retail Storefront", value: "retailer" }, { id: "opt_3", label: "Corporate Account", value: "corporate" }], icon: "caret-down" },
    { type: "radio", title: "Radio buttons", description: "Choose one option from visible radio choices", defaultLabel: "Expected Monthly Order Volume", defaultPlaceholder: "", hasOptions: true, defaultOptions: [{ id: "opt_1", label: "$5,000 - $20,000 / month", value: "5k_20k" }, { id: "opt_2", label: "$20,000 - $100,000 / month", value: "20k_100k" }, { id: "opt_3", label: "$100,000+ / month", value: "100k_plus" }], icon: "radio-control" },
    { type: "textarea", title: "Multi-line text", description: "Multi-line paragraph / message text area", defaultLabel: "Business Description & Requirements", defaultPlaceholder: "Provide details about your business and bulk purchase needs...", hasOptions: false, icon: "text-align-left" },
    { type: "checkbox_group", title: "Multiple choice", description: "Multiple choice checkboxes (list of values)", defaultLabel: "Interested Product Categories", defaultPlaceholder: "", hasOptions: true, defaultOptions: [{ id: "opt_1", label: "Raw Materials", value: "raw_materials" }, { id: "opt_2", label: "Finished Goods", value: "finished_goods" }, { id: "opt_3", label: "Custom Packaging", value: "custom_packaging" }], icon: "checkbox" },
    { type: "date", title: "Date", description: "Date picker for launch or registration date", defaultLabel: "Target Launch Date", defaultPlaceholder: "", hasOptions: false, icon: "calendar" },
    { type: "number", title: "Number", description: "Numeric input for quantity, budget or tax ID", defaultLabel: "Estimated Monthly Quantity", defaultPlaceholder: "100", hasOptions: false, icon: "number-one" },
    { type: "file", title: "File upload", description: "Upload business licenses, tax certificates (Shopify file field)", defaultLabel: "Business Certificate / Resale License", defaultPlaceholder: "", hasOptions: false, multiple: false, icon: "file" },
    { type: "phone", title: "Phone", description: "Phone number with international format", defaultLabel: "Company Contact Phone", defaultPlaceholder: "+1 (555) 000-0000", hasOptions: false, icon: "phone" }
];

const SAVE_BAR_ID = "b2b-form-save-bar";

const INITIAL_BUILDER_STATE = {
    title: 'B2B Form Application',
    description: 'Applied for B2B for Bulk Purchase and Contracts with required detail we will verify if approved specialize treatment given',
    buttonlabel: 'Submit Application',
    policies: 'By signing up, you agree to receive marketing emails. View our privacy policy and terms of service for more info.',
    fields: [
        { id: "customer_first_name", type: "customer_first_name", label: "First Name", placeholder: "Enter first name...", required: false, options: [], uniqueKey: "first_name" },
        { id: "customer_last_name", type: "customer_last_name", label: "Last Name", placeholder: "Enter last name...", required: false, options: [], uniqueKey: "last_name" },
        { id: "customer_company_name", type: "customer_company_name", label: "Company Name", placeholder: "Enter company name...", required: false, options: [], uniqueKey: "company_name" },
        { id: "f_email", type: "email", label: "Business Email", placeholder: "Enter email address...", required: true, options: [] },
        { id: "f_type", type: "select", label: "Business Entity Type", placeholder: "Select your business type...", required: true, options: [{ id: "opt_1", label: "Wholesaler / Reseller", value: "wholesaler" }, { id: "opt_2", label: "Corporate Account", value: "corporate" }, { id: "opt_3", label: "Retail Partner", value: "retail_partner" }] },
        { id: "f_size", type: "radio", label: "Expected Order Volume", placeholder: "", required: false, options: [{ id: "opt_r1", label: "$5,000 - $20,000 / month", value: "tier_1" }, { id: "opt_r2", label: "$20,000 - $100,000 / month", value: "tier_2" }, { id: "opt_r3", label: "$100,000+ / month", value: "tier_3" }] }
    ]
};

export default function New() {
    const { formName, customerTagOptions = [] } = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const saveBarRef = useRef(null);

    const isSaving = navigation.state === "submitting";

    const [title, setTitle] = useState(formName || INITIAL_BUILDER_STATE.title);
    const [description, setDescription] = useState(INITIAL_BUILDER_STATE.description);
    const [buttonlabel, setButtonLabel] = useState(INITIAL_BUILDER_STATE.buttonlabel);
    const [policies, setPolicies] = useState(INITIAL_BUILDER_STATE.policies);
    const [fields, setFields] = useState(INITIAL_BUILDER_STATE.fields);
    const [selectedCustomerTag, setSelectedCustomerTag] = useState("");

    const [savedState, setSavedState] = useState(INITIAL_BUILDER_STATE);
    const [activeConfigId, setActiveConfigId] = useState(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    const handleBuilderInteraction = () => {
        if (!hasInteracted) setHasInteracted(true);
    };

    const isDirty = JSON.stringify({ title, description, buttonlabel, policies, fields }) !== JSON.stringify(savedState);
    const showSaveBar = hasInteracted || isDirty;

    // Show/hide the embedded app save bar using the programmatic UI web component API
    useEffect(() => {
        try {
            if (typeof shopify !== "undefined" && shopify.saveBar) {
                if (showSaveBar) {
                    shopify.saveBar.show(SAVE_BAR_ID);
                } else {
                    shopify.saveBar.hide(SAVE_BAR_ID);
                }
            }
        } catch (e) {
            console.debug("shopify.saveBar API fallback:", e);
        }

        const bar = saveBarRef.current;
        if (!bar) return;

        if (showSaveBar) {
            if (typeof bar.show === "function") {
                bar.show();
            } else {
                bar.removeAttribute("hidden");
            }
        } else {
            if (typeof bar.hide === "function") {
                bar.hide();
            } else {
                bar.setAttribute("hidden", "");
            }
        }
    }, [showSaveBar]);

    // When save succeeds
    useEffect(() => {
        if (actionData?.success) {
            setSavedState({ title, description, buttonlabel, policies, fields });
            setHasInteracted(false);
        }
    }, [actionData, title, description, buttonlabel, policies, fields]);

    const handleSaveForm = () => {
        if (customerTagOptions.length === 0) {
            if (typeof shopify !== "undefined" && shopify.toast) {
                shopify.toast.show("Please create at least one Customer Tag on the home page before saving the form.");
            }
            return;
        }

        if (!selectedCustomerTag) {
            if (typeof shopify !== "undefined" && shopify.toast) {
                shopify.toast.show("Customer Tag is required. Please select a configured tag.");
            }
            return;
        }

        const payload = { title, description, buttonlabel, policies, fields, customerTag: selectedCustomerTag };
        submit(payload, { method: "post", encType: "application/json" });
    };

    const handleCancelOrDiscard = () => {
        setHasInteracted(false);
        const bar = saveBarRef.current;
        if (bar) {
            if (typeof bar.hide === "function") bar.hide();
            else bar.setAttribute("hidden", "");
        }
        navigate("/app/form");
    };

    const addField = (fieldTypeDef) => {
        const newId = fieldTypeDef.customerFieldKey
            ? `customer_${fieldTypeDef.customerFieldKey}`
            : `field_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

        const newField = {
            id: newId,
            type: fieldTypeDef.type,
            label: fieldTypeDef.defaultLabel,
            placeholder: fieldTypeDef.defaultPlaceholder,
            required: false,
            multiple: Boolean(fieldTypeDef.multiple),
            options: fieldTypeDef.hasOptions
                ? fieldTypeDef.defaultOptions.map((opt, i) => ({ ...opt, id: `opt_${Date.now().toString(36)}_${i}` }))
                : [],
            uniqueKey: fieldTypeDef.customerFieldKey || null,
        };

        setFields(prev => {
            const hasExisting = prev.some((item) => item.uniqueKey === newField.uniqueKey || item.id === newField.id);
            if (hasExisting) {
                return prev;
            }
            return [...prev, newField];
        });
        setIsPickerOpen(false);
        setActiveConfigId(newId);
        setHasInteracted(true);
    };

    const updateField = (id, updates) => {
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        setHasInteracted(true);
    };

    const removeField = (id) => {
        if (id === "f_email") return; // Email is kept as mandatory contact identifier
        setFields(prev => prev.filter(f => f.id !== id));
        if (activeConfigId === id) setActiveConfigId(null);
        setHasInteracted(true);
    };

    const moveField = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= fields.length) return;
        setFields(prev => {
            const next = [...prev];
            const [item] = next.splice(index, 1);
            next.splice(targetIndex, 0, item);
            return next;
        });
        setHasInteracted(true);
    };

    const addOption = (fieldId) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            const optIndex = (f.options?.length || 0) + 1;
            const newOpt = { id: `opt_${Date.now().toString(36)}_${optIndex}`, label: `Option ${optIndex}`, value: `option_${optIndex}` };
            return { ...f, options: [...(f.options || []), newOpt] };
        }));
        setHasInteracted(true);
    };

    const updateOption = (fieldId, optionId, key, value) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            return { ...f, options: f.options.map(opt => opt.id === optionId ? { ...opt, [key]: value } : opt) };
        }));
        setHasInteracted(true);
    };

    const removeOption = (fieldId, optionId) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            return { ...f, options: f.options.filter(opt => opt.id !== optionId) };
        }));
        setHasInteracted(true);
    };

    return (
        <>
            <style>{`
        .field-item-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid #e3e3e3; border-radius: 8px; margin-bottom: 8px; background: #ffffff; cursor: pointer; transition: all 0.15s ease-in-out; }
        .field-item-row:hover { background: #f7f8f9; border-color: #c9cccf; }
        .field-item-row.is-active { background: #f1f7fe; border-color: #2c6ecb; box-shadow: 0 0 0 1px #2c6ecb; }
        .picker-popover-menu { background: #fff; border: 1px solid #c9cccf; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.15); padding: 8px; margin-top: 8px; max-height: 420px; overflow-y: auto; z-index: 1000; display: flex; flex-direction: column; gap: 4px; }
        .picker-option-btn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 12px; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer; text-align: left; transition: background 0.12s; }
        .picker-option-btn:hover { background: #f4f6f8; border-color: #e1e3e5; }
        .picker-option-icon { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 6px; background: #f1f2f4; color: #303030; flex-shrink: 0; }
        .field-config-container { background: #f9fbfd; border: 1px solid #cce0ff; border-radius: 8px; padding: 16px; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(0,91,211,0.08); }
        .config-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #e1e9f4; }
        .config-option-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .config-input { width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 13px; border: 1px solid #c9cccf; border-radius: 6px; background: #fff; outline: none; font-family: inherit; }
        .config-input:focus { border-color: #005bd3; box-shadow: 0 0 0 1px #005bd3; }

        .preview-shell { background: #f0f0f0; border-radius: 10px; overflow: hidden; border: 1px solid #d5d5d5; font-family: -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .preview-browser-bar { background: #e8e8e8; border-bottom: 1px solid #d0d0d0; padding: 8px 12px; display: flex; align-items: center; gap: 10px; }
        .preview-browser-dots { display: flex; gap: 5px; }
        .preview-browser-dot { width: 11px; height: 11px; border-radius: 50%; }
        .preview-browser-url { flex: 1; background: #fff; border: 1px solid #c4c4c4; border-radius: 20px; padding: 3px 12px; font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .preview-storefront { background: #ffffff; min-height: 500px; }
        .preview-nav { background: #1a1a1a; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
        .preview-nav-logo { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: 1px; text-transform: uppercase; }
        .preview-page-body { padding: 20px 16px; max-width: 560px; margin: 0 auto; }
        .preview-form-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
        .preview-form-title { font-size: 20px; font-weight: 700; color: #1a1a1a; text-align: center; margin: 0 0 8px 0; }
        .preview-form-desc { font-size: 13px; color: #6d6d6d; text-align: center; margin: 0 0 20px 0; line-height: 1.5; }
        .preview-divider { border: none; border-top: 1px solid #ebebeb; margin: 0 0 20px 0; }
        .preview-field-group { margin-bottom: 16px; }
        .preview-field-label { display: block; font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 6px; }
        .preview-required-star { color: #c0392b; margin-left: 2px; }
        .preview-input, .preview-select, .preview-textarea { width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 13px; border: 1px solid #d5d5d5; border-radius: 6px; background: #fafafa; color: #1a1a1a; font-family: inherit; }
        .preview-textarea { resize: vertical; min-height: 80px; }
        .preview-choice-group { display: flex; flex-direction: column; gap: 8px; }
        .preview-choice-label { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #1a1a1a; cursor: pointer; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fafafa; width: fit-content; }
        .preview-radio-input, .preview-checkbox-input { width: 16px; height: 16px; accent-color: #1a1a1a; cursor: pointer; }
        .preview-file-dropzone { border: 2px dashed #d0d0d0; border-radius: 8px; padding: 22px 16px; text-align: center; background: #fafafa; cursor: pointer; }
        .preview-file-text { font-size: 12px; color: #555; margin: 0; font-weight: 500; }
        .preview-file-subtext { font-size: 11px; color: #999; margin: 4px 0 0 0; }
        .preview-submit-btn { display: block; width: 100%; background: #1a1a1a; color: #fff; border: none; border-radius: 6px; padding: 12px 20px; font-size: 14px; font-weight: 600; text-align: center; cursor: pointer; margin-top: 20px; font-family: inherit; }
        .preview-policy-text { font-size: 11px; color: #999; text-align: center; margin-top: 14px; line-height: 1.5; }
        .preview-footer { background: #1a1a1a; padding: 16px 24px; text-align: center; }
        .preview-footer-text { font-size: 11px; color: rgba(255,255,255,0.4); }
      `}</style>

            <s-page heading={formName || "Create B2B Form"}>
                {/* Native App Bridge Save Bar */}
                <ui-save-bar id={SAVE_BAR_ID} ref={saveBarRef} hidden>
                    <button
                        type="button"
                        variant="primary"
                        onClick={handleSaveForm}
                        loading={isSaving ? true : false}
                        disabled={isSaving}
                    >
                        Save Form
                    </button>
                    <button
                        type="button"
                        variant="secondary"
                        onClick={handleCancelOrDiscard}
                        loading={isSaving ? true : false}
                        disabled={isSaving}
                    >
                        Discard
                    </button>
                </ui-save-bar>

                {/* Success Banner */}
                {actionData?.success && (
                    <s-box padding="base none">
                        <s-banner tone="success" heading="Form & Metaobject Created Successfully!">
                            <s-paragraph>
                                Form ID: <strong>{actionData.form?.id}</strong> | Metaobject Type: <strong>{actionData.form?.metaobjectType}</strong>
                            </s-paragraph>
                            <s-stack direction="inline" gap="small" padding="small none none none">
                                <s-button variant="primary" onClick={() => navigate("/app/form")}>View All Forms</s-button>
                                <s-button variant="secondary" onClick={() => navigate(0)}>Create Another</s-button>
                            </s-stack>
                        </s-banner>
                    </s-box>
                )}

                {/* Error Banner */}
                {actionData?.errors && (
                    <s-box padding="base none">
                        <s-banner tone="critical" heading="Unable to Save Form">
                            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                                {actionData.errors.map((err, idx) => (
                                    <li key={idx}>{err.message}</li>
                                ))}
                            </ul>
                        </s-banner>
                    </s-box>
                )}

                <s-section
                    heading="Form Builder & Configuration"
                    onFocusCapture={handleBuilderInteraction}
                    onClickCapture={handleBuilderInteraction}
                >
                    <s-stack direction="inline" justifyContent="space-between" alignItems="center" padding="none none base none">
                        <s-text tone="subdued">Configure form fields, inputs, and submission requirements.</s-text>
                    </s-stack>

                    <s-text-field
                        label="Form Title"
                        value={title}
                        onChange={(e) => { setTitle(e.target.value); setHasInteracted(true); }}
                        placeholder="e.g. B2B Wholesale Application"
                    ></s-text-field>

                    <s-box padding="base none none none">
                        <s-text><strong>Description & Instructions</strong></s-text>
                        <s-box padding="small-200 none none none">
                            <RichTextEditor value={description} onChange={(val) => { setDescription(val); setHasInteracted(true); }} />
                        </s-box>
                    </s-box>

                    <s-box padding="base none none none">
                        <s-stack direction="inline" justifyContent="space-between" alignItems="center" padding="none none small-300 none">
                            <s-heading><span style={{ fontSize: '15px', fontWeight: '600' }}>Form Fields ({fields.length})</span></s-heading>
                            <s-paragraph tone="neutral"><span style={{ fontSize: '12px', color: '#6d7175' }}>Click any field to customize settings</span></s-paragraph>
                        </s-stack>

                        <div style={{ marginBottom: '12px' }}>
                            {fields.map((field, idx) => {
                                const typeMeta = FIELD_TYPES.find(t => t.type === field.type) || FIELD_TYPES[0];
                                const isSelected = activeConfigId === field.id;
                                const isEmailField = field.id === "f_email";
                                const isCustomerMetaField = ["customer_first_name", "customer_last_name", "customer_company_name"].includes(field.type);

                                return (
                                    <div key={field.id}>
                                        <div
                                            className={`field-item-row ${isSelected ? 'is-active' : ''}`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setActiveConfigId(isSelected ? null : field.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setActiveConfigId(isSelected ? null : field.id);
                                                }
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                <div className="picker-option-icon">
                                                    <s-icon type={typeMeta.icon}></s-icon>
                                                </div>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#202223' }}>
                                                        {field.label || typeMeta.title}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                                        <s-badge color="base" accessibilityLabel={typeMeta.title}>{typeMeta.title}</s-badge>
                                                        {field.required && <s-badge color="base" tone="critical"><span style={{ fontSize: '10px', fontWeight: '500' }}>Required</span></s-badge>}
                                                        {field.type === 'file' && (
                                                            <s-badge color="base" tone={field.multiple ? "info" : "neutral"}>
                                                                <span style={{ fontSize: '10px' }}>{field.multiple ? "Multiple Files" : "Single File"}</span>
                                                            </s-badge>
                                                        )}
                                                        {typeMeta.hasOptions && (
                                                            <span style={{ fontSize: '11px', color: '#6d7175' }}>
                                                                • {field.options?.length || 0} choices
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                role="presentation"
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            >
                                                <s-button
                                                    variant="secondary"
                                                    accessibilityLabel="Move field up"
                                                    disabled={idx === 0}
                                                    onClick={() => moveField(idx, -1)}
                                                >
                                                    <s-icon type="chevron-up"></s-icon>
                                                </s-button>
                                                <s-button
                                                    variant="secondary"
                                                    accessibilityLabel="Move field down"
                                                    disabled={idx === fields.length - 1}
                                                    onClick={() => moveField(idx, 1)}
                                                >
                                                    <s-icon type="chevron-down"></s-icon>
                                                </s-button>
                                                <s-button
                                                    variant="secondary"
                                                    accessibilityLabel="Configure field"
                                                    onClick={() => setActiveConfigId(isSelected ? null : field.id)}
                                                >
                                                    <s-icon type="edit"></s-icon>
                                                </s-button>
                                                {!isEmailField && (
                                                    <s-button
                                                        variant="secondary"
                                                        tone="critical"
                                                        accessibilityLabel="Delete field"
                                                        onClick={() => removeField(field.id)}
                                                    >
                                                        <s-icon type="delete"></s-icon>
                                                    </s-button>
                                                )}
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="field-config-container">
                                                <div className="config-header">
                                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#005bd3' }}>
                                                        Configure {typeMeta.title} ({field.label || "Field"})
                                                    </span>
                                                    <s-button variant="secondary" accessibilityLabel="Close field settings" onClick={() => setActiveConfigId(null)}>✕</s-button>
                                                </div>

                                                <s-box padding="none none small-300 none">
                                                    <s-text-field
                                                        label="Field Label"
                                                        placeholder="Enter field label..."
                                                        value={field.label}
                                                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                    ></s-text-field>
                                                </s-box>

                                                {['text', 'textarea', 'number', 'phone', 'select', 'email'].includes(field.type) && (
                                                    <s-box padding="none none small-300 none">
                                                        <s-text-field
                                                            label="Placeholder Text"
                                                            placeholder="Placeholder hint text..."
                                                            value={field.placeholder || ''}
                                                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                                        ></s-text-field>
                                                    </s-box>
                                                )}

                                                <s-box padding="none none small-300 none">
                                                    <s-checkbox
                                                        label="Required field (merchant must provide this before submitting)"
                                                        checked={!!field.required}
                                                        disabled={isEmailField || isCustomerMetaField}
                                                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                                    ></s-checkbox>
                                                </s-box>

                                                {field.type === 'file' && (
                                                    <s-box padding="none none small-300 none">
                                                        <s-checkbox
                                                            label="Allow multiple file uploads (creates list.file_reference metaobject field)"
                                                            checked={!!field.multiple}
                                                            onChange={(e) => updateField(field.id, { multiple: e.target.checked })}
                                                        ></s-checkbox>
                                                    </s-box>
                                                )}

                                                {typeMeta.hasOptions && (
                                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e3e8ee' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#303030' }}>Choice Options</span>
                                                        </div>

                                                        {field.options?.map((opt, optIdx) => (
                                                            <div key={opt.id} className="config-option-row">
                                                                <span style={{ fontSize: '11px', color: '#8c9196', width: '18px' }}>{optIdx + 1}.</span>
                                                                <input
                                                                    type="text"
                                                                    className="config-input"
                                                                    placeholder="Option display label"
                                                                    value={opt.label}
                                                                    onChange={(e) => updateOption(field.id, opt.id, 'label', e.target.value)}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    className="config-input"
                                                                    placeholder="Option value"
                                                                    value={opt.value}
                                                                    onChange={(e) => updateOption(field.id, opt.id, 'value', e.target.value)}
                                                                />
                                                                <s-button
                                                                    variant="secondary"
                                                                    tone="critical"
                                                                    accessibilityLabel="Remove option"
                                                                    onClick={() => removeOption(field.id, opt.id)}
                                                                >
                                                                    ✕
                                                                </s-button>
                                                            </div>
                                                        ))}

                                                        <s-button variant="secondary" onClick={() => addOption(field.id)}>
                                                            + Add choice option
                                                        </s-button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ position: 'relative' }}>
                            <s-button variant="secondary" onClick={() => setIsPickerOpen(!isPickerOpen)}>
                                + Add Form Field
                            </s-button>

                            {isPickerOpen && (
                                <div className="picker-popover-menu">
                                    <div style={{ padding: '6px 8px', fontSize: '12px', fontWeight: '600', color: '#6d7175', borderBottom: '1px solid #eee' }}>
                                        Select Field Type
                                    </div>
                                    {FIELD_TYPES.filter(t => t.type !== "email").map((typeOption) => (
                                        <button
                                            key={typeOption.type}
                                            type="button"
                                            className="picker-option-btn"
                                            onClick={() => addField(typeOption)}
                                        >
                                            <div className="picker-option-icon">
                                                <s-icon type={typeOption.icon}></s-icon>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#202223' }}>{typeOption.title}</div>
                                                <div style={{ fontSize: '11px', color: '#6d7175' }}>{typeOption.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </s-box>

                    <s-box padding="base none none none">
                        <s-text-field
                            label="Submit Button Text"
                            value={buttonlabel}
                            onChange={(e) => { setButtonLabel(e.target.value); setHasInteracted(true); }}
                            placeholder="Submit Application"
                        ></s-text-field>
                    </s-box>

                    <s-box padding="base none none none">
                        <s-text><strong>Privacy & Policies Text</strong></s-text>
                        <s-box padding="small-200 none none none">
                            <RichTextEditor
                                value={policies}
                                onChange={(val) => { setPolicies(val); setHasInteracted(true); }}
                                specialclass="policy_editor"
                            />
                        </s-box>
                    </s-box>

                    <s-box padding="base none none none">
                        <s-select
                            label="Customer Tag"
                            helpText="Only tags configured on the home page are available. This value is required before the form can be saved."
                            value={selectedCustomerTag}
                            onChange={(e) => {
                                setSelectedCustomerTag(e.target.value || "");
                                setHasInteracted(true);
                            }}
                            required
                        >
                            <s-option value="">Select a customer tag...</s-option>
                            {customerTagOptions.map((tag) => (
                                <s-option key={tag} value={tag}>{tag}</s-option>
                            ))}
                        </s-select>
                    </s-box>

                    <s-box padding="base none none none">
                        <s-button
                            variant="primary"
                            onClick={handleSaveForm}
                            loading={isSaving ? true : false}
                        >
                            {isSaving ? "Saving Form..." : "Save Form"}
                        </s-button>
                    </s-box>
                </s-section>

                {/* LIVE STOREFRONT PREVIEW PANE */}
                <s-box slot="aside">
                    <s-box heading="Live Storefront Preview" padding="none">
                        <div className="preview-shell">
                            <div className="preview-browser-bar">
                                <div className="preview-browser-dots">
                                    <div className="preview-browser-dot" style={{ background: '#ff5f57' }}></div>
                                    <div className="preview-browser-dot" style={{ background: '#febc2e' }}></div>
                                    <div className="preview-browser-dot" style={{ background: '#28c840' }}></div>
                                </div>
                                <div className="preview-browser-url">your-store.myshopify.com/apps/b2b/wholesale-form</div>
                            </div>

                            <div className="preview-storefront">
                                <div className="preview-nav">
                                    <div className="preview-nav-logo">B2B Portal</div>
                                </div>

                                <div className="preview-page-body">
                                    <div className="preview-form-card">
                                        <h2 className="preview-form-title">{title || 'B2B Form'}</h2>

                                        {description && (
                                            <div className="preview-form-desc" dangerouslySetInnerHTML={{ __html: description }} />
                                        )}

                                        <hr className="preview-divider" />

                                        {fields.map((field) => (
                                            <div key={field.id} className="preview-field-group">
                                                <label className="preview-field-label">
                                                    {field.label || 'Untitled Field'}
                                                    {field.required && <span className="preview-required-star">*</span>}
                                                </label>

                                                {(field.type === 'text' || field.type === 'customer_first_name' || field.type === 'customer_last_name' || field.type === 'customer_company_name') && <input type="text" className="preview-input" placeholder={field.placeholder || ''} readOnly />}
                                                {field.type === 'email' && <input type="email" className="preview-input" placeholder={field.placeholder || ''} readOnly />}
                                                {field.type === 'phone' && <input type="tel" className="preview-input" placeholder={field.placeholder || ''} readOnly />}
                                                {field.type === 'number' && <input type="number" className="preview-input" placeholder={field.placeholder || ''} readOnly />}
                                                {field.type === 'date' && <input type="date" className="preview-input" readOnly />}
                                                {field.type === 'textarea' && <textarea rows={3} className="preview-textarea" placeholder={field.placeholder || ''} readOnly />}

                                                {field.type === 'select' && (
                                                    <select className="preview-select" defaultValue="">
                                                        <option value="" disabled>{field.placeholder || 'Select an option...'}</option>
                                                        {field.options?.map(opt => (
                                                            <option key={opt.id} value={opt.value}>{opt.label || opt.value}</option>
                                                        ))}
                                                    </select>
                                                )}

                                                {field.type === 'radio' && (
                                                    <div className="preview-choice-group">
                                                        {field.options?.map(opt => (
                                                            <label key={opt.id} className="preview-choice-label">
                                                                <input type="radio" name={`prev_${field.id}`} value={opt.value} className="preview-radio-input" />
                                                                <span>{opt.label || opt.value}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {field.type === 'checkbox_group' && (
                                                    <div className="preview-choice-group">
                                                        {field.options?.map(opt => (
                                                            <label key={opt.id} className="preview-choice-label">
                                                                <input type="checkbox" name={`prev_${field.id}`} value={opt.value} className="preview-checkbox-input" />
                                                                <span>{opt.label || opt.value}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {field.type === 'file' && (
                                                    <div className="preview-file-dropzone">
                                                        <p className="preview-file-text">
                                                            {field.multiple ? "Drag & drop multiple files, or browse" : "Drag & drop file, or browse"}
                                                        </p>
                                                        <p className="preview-file-subtext">PDF, PNG, JPG, DOC up to 20MB</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        <button type="button" className="preview-submit-btn">
                                            {buttonlabel || 'Submit Application'}
                                        </button>

                                        {policies && (
                                            <div className="preview-policy-text" dangerouslySetInnerHTML={{ __html: policies }} />
                                        )}
                                    </div>
                                </div>

                                <div className="preview-footer">
                                    <span className="preview-footer-text">&copy; 2026 Storefront &middot; B2B Customer Portal</span>
                                </div>
                            </div>
                        </div>
                    </s-box>
                </s-box>
            </s-page>
        </>
    );
}