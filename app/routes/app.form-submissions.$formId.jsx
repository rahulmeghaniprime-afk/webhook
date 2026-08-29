import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { useState, useMemo } from "react";
import db from "../db.server";

// ============================================================================
// LOADER
// ============================================================================
export const loader = async ({ request, params }) => {
    const { session } = await authenticate.admin(request);
    const { formId } = params;

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

    if (!form) {
        throw new Response("Form not found", { status: 404 });
    }

    return { form };
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

// ============================================================================
// COMPONENT
// ============================================================================
export default function FormSubmissions() {
    const { form } = useLoaderData();
    const navigate = useNavigate();

    const submissions = form.formSubmissions || [];
    const fieldMappings = form.FieldMapping || [];

    const [sortOrder, setSortOrder] = useState("latest");
    const [selectedSub, setSelectedSub] = useState(null);

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
                                                    <s-button
                                                        variant="secondary"
                                                        size="slim"
                                                        onClick={() => openDetail(sub)}
                                                    >
                                                        Detail
                                                    </s-button>
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

                                    return (
                                        <s-box
                                            key={key}
                                            padding="small-300"
                                            border="base"
                                            borderRadius="base"
                                        >
                                            <s-stack direction="inline" gap="base">
                                                <span style={{ fontSize: "13px", textTransform: "uppercase" }}>
                                                    {label}:
                                                </span>
                                                <span style={{ fontSize: "13px", wordBreak: "break-word" }}>
                                                    {(displayVal.startsWith('https://cdn.shopify.com')) ? ((displayVal.split(',').length === 1) ? (<s-link href={displayVal} target="_blank">{displayVal}</s-link>) : (displayVal.split(',').map(link_dv => <s-link href={link_dv} target="_blank">{link_dv}</s-link>))) : (displayVal || "—")}
                                                </span>
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
