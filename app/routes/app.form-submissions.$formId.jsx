import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { useEffect, useState, useMemo } from "react";
import db from "../db.server";

// ============================================================================
// LOADER
// ============================================================================
export const loader = async ({ request, params }) => {
    const { session, admin } = await authenticate.admin(request);
    const { formId } = params;

    const metaRes = await admin.graphql(`
        #graphql
        query {
        shop {
            metafield(namespace: "custom", key: "store_tags") {
            jsonValue
            }
        }
        }
    `);
    const metafieldData = await metaRes.json();
    const storedSyncData = metafieldData?.data?.shop?.metafield?.jsonValue || {};
    const storeTags = [];
    for (let i in (storedSyncData || {})) {
        storeTags.push(storedSyncData[i]);
    }

    const form = await db.form.findFirst({
        where: { id: formId, shop: session.shop },
        include: {
            FieldMapping: { orderBy: { id: "asc" } },
            formSubmissions: {
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    customerId: true,
                    status: true,
                    createdAt: true,
                    metaobjectId: true,
                    payload: true,
                    error: true,
                },
            },
        },
    });
    
    // const market_catalog = storeTags.find(mObj => .tags.includes(mObj.tag));


    if (!form) {
        throw new Response("Form not found", { status: 404 });
    }

    return { form, storeTags };
};

// ============================================================================
// HELPERS
// ============================================================================
function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function statusTone(status) {
    if (status === "created") return "success";
    if (status === "failed") return "critical";
    return "warning";
}

function parsePayload(payloadStr) {
    try { return JSON.parse(payloadStr || "{}"); } catch { return {}; }
}

function getPayloadStringValue(payload, keys) {
    const candidates = keys.flatMap((key) => [key, key.toLowerCase(), key.toUpperCase(), key.replace(/_/g, " ")]);
    for (const candidate of candidates) {
        const value = payload?.[candidate];
        if (typeof value === "string" && value.trim()) return value.trim();
        if (typeof value === "number") return String(value);
    }

    for (const value of Object.values(payload || {})) {
        if (typeof value === "string" && value.trim() && keys.some((key) => value.toLowerCase().includes(key.toLowerCase()))) {
            return value.trim();
        }
    }

    for (const [key, value] of Object.entries(payload || {})) {
        if (typeof value === "string" && value.trim()) {
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
            const matched = keys.some((candidate) => normalizedKey.includes(candidate.toLowerCase().replace(/[^a-z0-9]/g, "")));
            if (matched) return value.trim();
        }
    }

    return "";
}

function getPayloadNameFields(payload) {
    const firstName = getPayloadStringValue(payload, ["first_name", "customer_first_name", "first name", "firstname"]);
    const lastName = getPayloadStringValue(payload, ["last_name", "customer_last_name", "last name", "lastname"]);
    const companyName = getPayloadStringValue(payload, ["company_name", "customer_company_name", "company name", "company"]);
    return { firstName, lastName, companyName };
}

function handleizeMetafieldKey(label, fallback) {
    const normalized = String(label || fallback || "field")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64);

    return normalized || `field_${String(fallback || "value").replace(/[^a-z0-9]/gi, "").slice(0, 54)}`;
}

function getGraphqlUserErrors(result, operation) {
    const errors = result?.errors?.length
        ? result.errors
        : result?.data?.[operation]?.userErrors || [];
    return errors.map((error) => error.message).filter(Boolean);
}

export const action = async ({ request, params }) => {
    try {
        const { session, admin } = await authenticate.admin(request);
        const formData = await request.formData();
        const intent = (formData.get("intent") || "").toString();
        const submissionId = (formData.get("submissionId") || "").toString();

        if (!submissionId) {
            return Response.json({ success: false, error: "Missing submission ID." }, { status: 400 });
        }

        const submission = await db.formSubmission.findUnique({
            where: { id: submissionId },
            include: { form: { include: { FieldMapping: { orderBy: { id: "asc" } } } } },
        });

        if (!submission || submission.form.shop !== session.shop || submission.formId !== params.formId) {
            return Response.json({ success: false, error: "Submission not found." }, { status: 404 });
        }

        if (intent === "reject") {
            if (submission.metaobjectId) {
                try {
                    const deleteMutation = `
                        mutation DeleteMetaobject($id: ID!) {
                            metaobjectDelete(id: $id) {
                                deletedId
                                userErrors {
                                    field
                                    message
                                }
                            }
                        }
                    `;
                    const metaRes = await admin.graphql(deleteMutation, { variables: { id: submission.metaobjectId } });
                    const metaJson = await metaRes.json();
                    const userErrors = metaJson?.data?.metaobjectDelete?.userErrors || [];
                    if (userErrors.length > 0) {
                        console.warn("Metaobject delete userErrors on submission reject:", userErrors);
                    }
                } catch (metaErr) {
                    console.warn("Metaobject delete warning on reject:", metaErr?.message);
                }
            }

            await db.formSubmission.delete({ where: { id: submission.id } });
            return Response.json({ success: true, message: "Submission rejected and removed." }, { status: 200 });
        }

        if (intent === "approve") {
            const payload = parsePayload(submission.payload);
            const customerEmail = getPayloadStringValue(payload, ["email", "customer_email", "business_email", "Email"]);
            if (!customerEmail || !customerEmail.includes("@")) {
                return Response.json({ success: false, error: "Missing valid email for customer approval." }, { status: 400 });
            }

            const { firstName, lastName } = getPayloadNameFields(payload);
            const customerTag = (payload.customer_tag || "").toString().trim();
            const customerLookupQuery = `
                query FindCustomerByEmail($query: String!) {
                    customers(first: 1, query: $query) {
                        nodes { id }
                    }
                }
            `;

            const customerCreateMutation = `
                mutation CreateCustomer($input: CustomerInput!) {
                    customerCreate(input: $input) {
                        customer { id }
                        userErrors { field message }
                    }
                }
            `;

            const tagsAddMutation = `
                mutation AddCustomerTags($id: ID!, $tags: [String!]!) {
                    tagsAdd(id: $id, tags: $tags) {
                        node { id }
                        userErrors { field message }
                    }
                }
            `;

            const metafieldsSetMutation = `
                mutation SetCustomerMetafields($metafields: [MetafieldsSetInput!]!) {
                    metafieldsSet(metafields: $metafields) {
                        metafields { key value }
                        userErrors { field message code }
                    }
                }
            `;

            try {
                const lookupResponse = await admin.graphql(customerLookupQuery, {
                    variables: { query: `email:${customerEmail}` },
                });
                const lookupJson = await lookupResponse.json();
                const lookupErrors = getGraphqlUserErrors(lookupJson, "customers");
                if (lookupErrors.length) {
                    return Response.json({ success: false, error: lookupErrors.join(", ") }, { status: 400 });
                }

                let customer = lookupJson?.data?.customers?.nodes?.[0] || null;
                let customerCreated = false;

                if (!customer?.id) {
                    const response = await admin.graphql(customerCreateMutation, {
                        variables: {
                            input: {
                                email: customerEmail,
                                firstName: firstName || undefined,
                                lastName: lastName || undefined,
                                emailMarketingConsent: {
                                    marketingState: "SUBSCRIBED",
                                    marketingOptInLevel: "SINGLE_OPT_IN",
                                    consentUpdatedAt: new Date().toISOString(),
                                },
                            },
                        },
                    });
                    const json = await response.json();
                    const userErrors = getGraphqlUserErrors(json, "customerCreate");
                    if (userErrors.length) {
                        return Response.json({ success: false, error: userErrors.join(", ") }, { status: 400 });
                    }
                    customer = json?.data?.customerCreate?.customer;
                    customerCreated = true;
                }

                if (!customer?.id) {
                    return Response.json({ success: false, error: "Shopify did not return a customer ID." }, { status: 400 });
                }

                if (customerTag) {
                    const tagResponse = await admin.graphql(tagsAddMutation, {
                        variables: { id: customer.id, tags: [customerTag] },
                    });
                    const tagJson = await tagResponse.json();
                    const tagErrors = getGraphqlUserErrors(tagJson, "tagsAdd");
                    if (tagErrors.length) {
                        return Response.json({ success: false, error: tagErrors.join(", ") }, { status: 400 });
                    }
                }

                const usedMetafieldKeys = new Set();
                const metafields = submission.form.FieldMapping
                    .map((mapping) => ({
                        label: mapping.fieldLabel,
                        fallback: mapping.metaobjectKey,
                        value: payload?.[mapping.metaobjectKey],
                    }))
                    .concat({ label: "customer_tag", fallback: "customer_tag", value: payload?.customer_tag })
                    .map(({ label, fallback, value }) => {
                        if (value === undefined || value === null || value === "") return null;

                        const baseKey = handleizeMetafieldKey(label, fallback);
                        let key = baseKey;
                        let duplicateIndex = 2;
                        while (usedMetafieldKeys.has(key)) {
                            const suffix = `_${duplicateIndex++}`;
                            key = `${baseKey.slice(0, 64 - suffix.length)}${suffix}`;
                        }
                        usedMetafieldKeys.add(key);

                        return {
                            ownerId: customer.id,
                            key,
                            type: "json",
                            value: JSON.stringify(value),
                        };
                    })
                    .filter(Boolean);

                if (metafields.length) {
                    for (let index = 0; index < metafields.length; index += 25) {
                        const metafieldResponse = await admin.graphql(metafieldsSetMutation, {
                            variables: { metafields: metafields.slice(index, index + 25) },
                        });
                        const metafieldJson = await metafieldResponse.json();
                        const metafieldErrors = getGraphqlUserErrors(metafieldJson, "metafieldsSet");
                        if (metafieldErrors.length) {
                            return Response.json({ success: false, error: metafieldErrors.join(", ") }, { status: 400 });
                        }
                    }
                }

                await db.formSubmission.delete({ where: { id: submission.id } });
                return Response.json({
                    success: true,
                    message: customerCreated
                        ? "Submission approved and customer created with form data."
                        : "Submission approved and existing customer updated with form data.",
                }, { status: 200 });
            } catch (graphqlError) {
                const errText =
                    graphqlError?.errors?.map((e) => e?.message || String(e)).join(", ") ||
                    graphqlError?.message ||
                    "Shopify customer creation failed.";

                console.error("Shopify customerCreate GraphQL error on approve:", graphqlError);
                return Response.json({ success: false, error: errText }, { status: 400 });
            }
        }

        return Response.json({ success: false, error: "Invalid action." }, { status: 400 });
    } catch (actionError) {
        // Catch any unhandled errors and always return JSON
        console.error("[Action Error] Unhandled error in submission action:", actionError);
        const errorMessage = actionError instanceof Error ? actionError.message : "An unexpected error occurred.";
        return Response.json({ success: false, error: errorMessage }, { status: 500 });
    }
};

// ============================================================================
// COMPONENT
// ============================================================================
export default function FormSubmissions() {
    const { form, storeTags } = useLoaderData();
    console.log(storeTags);
    const navigate = useNavigate();

    const submissions = form.formSubmissions || [];
    const fieldMappings = form.FieldMapping || [];

    const [sortOrder, setSortOrder] = useState("latest");
    const [selectedSub, setSelectedSub] = useState(null);
    const submissionFetcher = useFetcher();
    const actioningId = submissionFetcher.state !== "idle"
        ? submissionFetcher.formData?.get("submissionId")
        : null;
    const actioningIntent = submissionFetcher.state !== "idle"
        ? submissionFetcher.formData?.get("intent")
        : null;

    const handleSubmissionAction = (submissionId, intent) => {
        if (submissionFetcher.state !== "idle") return;

        submissionFetcher.submit(
            { intent, submissionId },
            { method: "POST" }
        );
    };

    useEffect(() => {
        if (submissionFetcher.state !== "idle" || !submissionFetcher.data) return;

        const { success, message, error } = submissionFetcher.data;
        shopify.toast.show(success
            ? message || "Submission updated successfully."
            : error || "This submission could not be processed."
        );
    }, [submissionFetcher.state, submissionFetcher.data]);

    const sorted = useMemo(() => {
        const copy = [...submissions];
        if (sortOrder === "oldest") {
            copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else {
            copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return copy;
    }, [submissions, sortOrder]);

    const openDetail = (sub) => {
        setSelectedSub(sub);
        shopify.modal.show("SubmissionDetailModal");
    };

    const labelMap = useMemo(() => {
        const map = {};
        fieldMappings.forEach((f) => {
            map[f.metaobjectKey] = f.fieldLabel || f.metaobjectKey;
        });
        return map;
    }, [fieldMappings]);

    const selectedPayload = selectedSub ? parsePayload(selectedSub.payload) : {};

    return (
        <>
            <s-page
                heading={form.name}
                backAction={JSON.stringify({ content: "Back to Forms", url: "/app/form" })}
            >
                <s-section>
                    <s-stack direction="inline" gap="small" alignItems="center" padding="none none base none">
                        <s-badge tone="info">{form.metaobjectType}</s-badge>
                        <s-badge>{fieldMappings.length} field{fieldMappings.length !== 1 ? "s" : ""}</s-badge>
                        <s-badge tone={submissions.length > 0 ? "success" : "neutral"}>
                            {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
                        </s-badge>
                        <s-paragraph tone="subdued">
                            <small>Form ID: <code style={{ fontSize: "11px" }}>{form.id}</code></small>
                        </s-paragraph>
                    </s-stack>

                    {submissions.length === 0 ? (
                        <s-box
                            padding="large"
                            border="base"
                            borderRadius="base"
                            style={{ textAlign: "center", background: "#fafafa" }}
                        >
                            <s-stack direction="block" gap="base" alignItems="center">
                                <span style={{ fontSize: "40px" }}>📭</span>
                                <s-heading>
                                    <span style={{ fontSize: "16px", fontWeight: "600" }}>No Submissions Yet</span>
                                </s-heading>
                                <s-paragraph tone="neutral">
                                    This form has not received any submissions yet. Share the form link with your customers to start collecting entries.
                                </s-paragraph>
                                <s-box padding="base none none none">
                                    <s-button variant="secondary" onClick={() => navigate("/app/form")}>
                                        Back to Forms
                                    </s-button>
                                </s-box>
                            </s-stack>
                        </s-box>
                    ) : (
                        <>
                            <s-stack
                                direction="inline"
                                justifyContent="space-between"
                                alignItems="center"
                                padding="none none base none"
                            >
                                <s-paragraph tone="subdued">
                                    <small>
                                        Showing <strong>{sorted.length}</strong> submission{sorted.length !== 1 ? "s" : ""}
                                    </small>
                                </s-paragraph>

                                <s-stack direction="inline" gap="small" alignItems="center">
                                    <span style={{ fontSize: "13px", color: "#6d7175" }}>Sort:</span>
                                    <s-button
                                        variant={sortOrder === "latest" ? "primary" : "secondary"}
                                        size="slim"
                                        onClick={() => setSortOrder("latest")}
                                    >
                                        Latest First
                                    </s-button>
                                    <s-button
                                        variant={sortOrder === "oldest" ? "primary" : "secondary"}
                                        size="slim"
                                        onClick={() => setSortOrder("oldest")}
                                    >
                                        Oldest First
                                    </s-button>
                                </s-stack>
                            </s-stack>

                            <s-table>
                                <s-table-header-row>
                                    <s-table-header-cell>#</s-table-header-cell>
                                    <s-table-header-cell>Email / Customer</s-table-header-cell>
                                    <s-table-header-cell>Status</s-table-header-cell>
                                    <s-table-header-cell>Submitted At</s-table-header-cell>
                                    <s-table-header-cell>Metaobject</s-table-header-cell>
                                    <s-table-header-cell>Details</s-table-header-cell>
                                </s-table-header-row>
                                <s-table-body>
                                    {sorted.map((sub, idx) => {
                                        const payload = parsePayload(sub.payload);
                                        const emailVal =
                                            payload["email"] ||
                                            payload["Email"] ||
                                            payload["customer_email"] ||
                                            Object.values(payload).find(
                                                (v) => typeof v === "string" && v.includes("@")
                                            ) ||
                                            null;

                                        return (
                                            <s-table-row key={sub.id}>
                                                <s-table-cell>
                                                    <span style={{ color: "#6d7175", fontSize: "12px" }}>{idx + 1}</span>
                                                </s-table-cell>

                                                <s-table-cell>
                                                    <s-stack direction="block" gap="tight">
                                                        {emailVal ? (
                                                            <span style={{ fontSize: "13px" }}>{emailVal}</span>
                                                        ) : sub.customerId ? (
                                                            <code style={{ fontSize: "11px" }}>Customer {sub.customerId}</code>
                                                        ) : (
                                                            <span style={{ color: "#8c9196", fontSize: "12px" }}>Anonymous</span>
                                                        )}
                                                        <span style={{ color: "#8c9196", fontSize: "11px" }}>
                                                            <code>{sub.id.slice(0, 14)}…</code>
                                                        </span>
                                                    </s-stack>
                                                </s-table-cell>

                                                <s-table-cell>
                                                    <s-badge tone={statusTone(sub.status)}>
                                                        {sub.status === "created" ? "Created" : sub.status === "failed" ? "Failed" : "Pending"}
                                                    </s-badge>
                                                </s-table-cell>

                                                <s-table-cell>
                                                    <span style={{ fontSize: "12px", color: "#6d7175" }}>
                                                        {formatDate(sub.createdAt)}
                                                    </span>
                                                </s-table-cell>

                                                <s-table-cell>
                                                    {sub.metaobjectId ? (
                                                        <code style={{ fontSize: "10px" }}>{sub.metaobjectId.split("/").pop()}</code>
                                                    ) : (
                                                        <span style={{ color: "#8c9196" }}>—</span>
                                                    )}
                                                </s-table-cell>

                                                <s-table-cell>
                                                    <s-stack direction="inline" gap="small" alignItems="center">
                                                        <s-button
                                                            variant="primary"
                                                            size="slim"
                                                            disabled={actioningId !== null}
                                                            loading={actioningId === sub.id && actioningIntent === "approve"}
                                                            onClick={() => handleSubmissionAction(sub.id, "approve")}
                                                        >
                                                            {actioningId === sub.id && actioningIntent === "approve" ? "Approve" : "Approve"}
                                                        </s-button>
                                                        <s-button
                                                            variant="secondary"
                                                            size="slim"
                                                            disabled={actioningId !== null}
                                                            loading={actioningId === sub.id && actioningIntent === "reject"}
                                                            onClick={() => handleSubmissionAction(sub.id, "reject")}
                                                        >
                                                            {actioningId === sub.id && actioningIntent === "reject" ? "Reject" : "Reject"}
                                                        </s-button>
                                                        <s-button
                                                            variant="secondary"
                                                            size="slim"
                                                            disabled={actioningId !== null}
                                                            onClick={() => openDetail(sub)}
                                                        >
                                                            Detail
                                                        </s-button>
                                                    </s-stack>
                                                </s-table-cell>
                                            </s-table-row>
                                        );
                                    })}
                                </s-table-body>
                            </s-table>
                        </>
                    )}
                </s-section>
            </s-page>

            {/* ── Submission Detail Modal ── */}
            <s-modal id="SubmissionDetailModal" heading="Submission Detail">
                {selectedSub && (
                    <s-stack padding="none" direction="block" gap="base">
                        <s-stack direction="block" gap="tight">
                            <s-stack direction="inline" gap="small" alignItems="center">
                                <s-badge tone={statusTone(selectedSub.status)}>
                                    {selectedSub.status === "created" ? "Created" : selectedSub.status === "failed" ? "Failed" : "Pending"}
                                </s-badge>
                                <span style={{ fontSize: "12px", color: "#6d7175" }}>
                                    Submitted {formatDate(selectedSub.createdAt)}
                                </span>
                            </s-stack>
                            <s-paragraph tone="subdued">
                                <small>ID: <code>{selectedSub.id}</code></small>
                            </s-paragraph>
                            {selectedSub.customerId && (
                                <s-paragraph tone="subdued">
                                    <small>Customer ID: <code>{selectedSub.customerId}</code></small>
                                </s-paragraph>
                            )}
                            {selectedSub.metaobjectId && (
                                <s-paragraph tone="subdued">
                                    <small>Metaobject: <code>{selectedSub.metaobjectId}</code></small>
                                </s-paragraph>
                            )}
                        </s-stack>

                        <s-divider />

                        {Object.keys(selectedPayload).length === 0 ? (
                            <s-paragraph tone="subdued">No payload data available.</s-paragraph>
                        ) : (
                            <s-stack direction="block" gap="small">
                                <s-paragraph>
                                    <strong>Submitted Fields</strong>
                                </s-paragraph>
                                {Object.entries(selectedPayload).map(([key, val]) => {
                                    const label = labelMap[key] || key;
                                    const displayVal = Array.isArray(val)
                                        ? val.join(", ")
                                        : val === null || val === undefined
                                            ? "—"
                                            : String(val);
                                    const matchingStoreTag = storeTags.find((storeTag) => storeTag.tag === displayVal);

                                    return (
                                        <s-box
                                            key={key}
                                            padding="small-300"
                                            border="base"
                                            borderRadius="base"
                                        >
                                            <s-stack direction="inline" gap="none base">
                                                {
                                                    (label.toLowerCase().trim() === 'customer_tag') ? (
                                                        <>
                                                            <span style={{ fontSize: "13px", textTransform: "uppercase" }}>
                                                                {label}:
                                                            </span>
                                                            <span style={{ fontSize: "13px", wordBreak: "break-word" }}>
                                                                <span>{displayVal}</span>
                                                            </span>
                                                            {matchingStoreTag?.market ? (<span style={{display:"flex",flexWrap:'wrap', gap: '8px'}}><span style={{fontSize: '10px'}}>market: {matchingStoreTag.market}</span> <span style={{fontSize: '10px'}}>catalog: {matchingStoreTag.catalog}</span></span>) : null}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span style={{ fontSize: "13px", textTransform: "uppercase" }}>
                                                                {label}:
                                                            </span>
                                                            <span style={{ fontSize: "13px", wordBreak: "break-word" }}>
                                                                {(displayVal.startsWith('https://cdn.shopify.com')) ? ((displayVal.split(',').length === 1) ? (<s-link href={displayVal} target="_blank">{displayVal}</s-link>) : (displayVal.split(',').map(link_dv => <s-link key={link_dv} href={link_dv} target="_blank">{link_dv}</s-link>))) : (displayVal || "—")}
                                                            </span>
                                                        </>
                                                    )
                                                }
                                            </s-stack>
                                        </s-box>
                                    );
                                })}
                            </s-stack>
                        )}

                        {selectedSub.status === "failed" && selectedSub.error && (
                            <>
                                <s-divider />
                                <s-banner tone="critical">
                                    <s-stack direction="block" gap="tight">
                                        <strong>Error Details</strong>
                                        <s-paragraph>
                                            <code style={{ fontSize: "11px", wordBreak: "break-word" }}>
                                                {selectedSub.error}
                                            </code>
                                        </s-paragraph>
                                    </s-stack>
                                </s-banner>
                            </>
                        )}
                    </s-stack>
                )}
                <s-stack direction="inline" justifyContent="end" padding="base none none none">
                    <s-button variant="secondary" onClick={() => shopify.modal.hide("SubmissionDetailModal")}>
                        Close
                    </s-button>
                </s-stack>
            </s-modal>
        </>
    );
}
