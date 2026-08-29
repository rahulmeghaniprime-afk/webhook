import { useLoaderData, useNavigate, useLocation, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { useState } from "react";
import db from "../db.server";

// ============================================================================
// LOADER — fetch forms with submission counts
// ============================================================================
export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);

    const forms = await db.form.findMany({
        where: { shop: session.shop },
        include: {
            FieldMapping: true,
            formSubmissions: {
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    customerId: true,
                    status: true,
                    createdAt: true,
                    metaobjectId: true,
                    payload: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return { shop: session.shop, forms };
};

// ============================================================================
// ACTION — handle form deletion
// ============================================================================
export const action = async ({ request }) => {
    const { session, admin } = await authenticate.admin(request);
    const data = await request.formData();
    const intent = data.get("intent");
    const formId = data.get("formId");

    if (intent === "deleteForm" && formId) {
        try {
            // 1. Fetch the form to get metaobjectDefId
            const form = await db.form.findFirst({
                where: { id: formId, shop: session.shop },
                include: { formSubmissions: true },
            });

            if (!form) {
                return Response.json({ success: false, error: "Form not found." }, { status: 404 });
            }

            // 2. Delete Shopify Metaobject Definition (cascades all entries)
            if (form.metaobjectDefId) {
                try {
                    const deleteMutation = `
                      mutation DeleteMetaobjectDefinition($id: ID!) {
                        metaobjectDefinitionDelete(id: $id) {
                          deletedId
                          userErrors {
                            field
                            message
                          }
                        }
                      }
                    `;
                    await admin.graphql(deleteMutation, {
                        variables: { id: form.metaobjectDefId },
                    });
                } catch (metaDeleteErr) {
                    console.warn("Metaobject definition delete note:", metaDeleteErr?.message);
                }
            }

            // 3. Delete all FormSubmissions from DB (cascade via Prisma), then the form itself
            await db.formSubmission.deleteMany({ where: { formId } });
            await db.fieldMapping.deleteMany({ where: { formId } });
            await db.form.delete({ where: { id: formId } });

            return Response.json({ success: true, deletedId: formId });
        } catch (err) {
            console.error("deleteForm error:", err);
            return Response.json({ success: false, error: err?.message || "Delete failed." }, { status: 500 });
        }
    }

    return Response.json({ success: false, error: "Unknown intent." }, { status: 400 });
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

function statusColor(status) {
    if (status === "created") return "success";
    if (status === "failed") return "critical";
    return "warning";
}

function statusLabel(status) {
    if (status === "created") return "Created";
    if (status === "failed") return "Failed";
    return "Pending";
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function Form() {
    const { forms = [] } = useLoaderData();
    const navigate = useNavigate();
    const location = useLocation();
    const fetcher = useFetcher();

    const [formName, setFormName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);   // { id, name }

    const redirectFormapp = () => shopify.modal.show("FormInput");
    const closeFormModal = () => { setFormName(""); shopify.modal.hide("FormInput"); };

    const createForm = () => {
        if (!formName.trim()) return;
        const param = new URLSearchParams(location.search);
        param.set("name", formName.trim());
        navigate(`/app/new?${param.toString()}`);
    };

    const openDeleteModal = (id, name) => {
        setDeleteTarget({ id, name });
        shopify.modal.show("DeleteFormConfirm");
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        shopify.modal.hide("DeleteFormConfirm");
        const fd = new FormData();
        fd.append("intent", "deleteForm");
        fd.append("formId", deleteTarget.id);
        fetcher.submit(fd, { method: "POST" });
        setDeleteTarget(null);
    };

    const isDeleting = fetcher.state !== "idle";

    return (
        <>
            <s-page heading="B2B Forms & Applications">
                <s-section heading="Manage Custom Forms">
                    <s-stack direction="inline" justifyContent="space-between" alignItems="center" padding="none none base none">
                        <s-paragraph tone="neutral">
                            Create custom B2B application and registration forms that automatically create Shopify Metaobjects upon submission.
                        </s-paragraph>
                        <s-button onClick={redirectFormapp} variant="primary">
                            + Create New Form
                        </s-button>
                    </s-stack>

                    {forms.length === 0 ? (
                        <s-box padding="large" border="base" borderRadius="base" style={{ textAlign: "center", background: "#fafafa" }}>
                            <s-heading><span style={{ fontSize: "16px", fontWeight: "600" }}>No B2B Forms Created Yet</span></s-heading>
                            <s-paragraph tone="neutral">
                                Design your first form with custom fields, file uploads, and dropdowns. Each form automatically sets up a Shopify Metaobject definition.
                            </s-paragraph>
                            <s-box padding="base none none none">
                                <s-button onClick={redirectFormapp} variant="primary">Create Your First Form</s-button>
                            </s-box>
                        </s-box>
                    ) : (
                        <s-stack direction="block" gap="base">
                            {forms.map((f) => {
                                const submissions = f.formSubmissions || [];

                                return (
                                    <s-box key={f.id} border="base" borderRadius="base" padding="none">
                                        {/* ── Form header row ── */}
                                        <s-box padding="base" style={{ background: "#fafbfc", borderRadius: "6px" }}>
                                            <s-stack direction="inline" alignItems="center" justifyContent="space-between" gap="base">
                                                {/* Left: form info */}
                                                <s-stack direction="block" gap="tight">
                                                    <s-stack direction="inline" gap="small" alignItems="center">
                                                        <s-link onClick={() => navigate(`/app/form-submissions/${f.id}`)}>
                                                            <strong style={{ fontSize: "14px" }}>{f.name}</strong>
                                                        </s-link>
                                                        <s-badge color="base" tone="info">{f.metaobjectType}</s-badge>
                                                        <s-badge color="base">{f.FieldMapping?.length || 0} fields</s-badge>
                                                        <s-badge color="base" tone={submissions.length > 0 ? "success" : "neutral"}>
                                                            {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
                                                        </s-badge>
                                                    </s-stack>
                                                    <s-paragraph tone="subdued">
                                                        <small>
                                                            <code style={{ fontSize: "11px" }}>{f.id}</code>
                                                            &nbsp;·&nbsp;Created {formatDate(f.createdAt)}
                                                        </small>
                                                    </s-paragraph>
                                                </s-stack>

                                                {/* Right: actions */}
                                                <s-stack direction="inline" gap="small" alignItems="center">
                                                    {submissions.length > 0 && (
                                                        <s-button
                                                            variant="secondary"
                                                            size="slim"
                                                            onClick={() => navigate(`/app/form-submissions/${f.id}`)}
                                                        >
                                                            {`View Entries (${submissions.length})`}
                                                        </s-button>
                                                    )}
                                                    <s-button
                                                        icon="delete"
                                                        variant="plain"
                                                        tone="critical"
                                                        onClick={() => openDeleteModal(f.id, f.name)}
                                                        disabled={isDeleting}
                                                    />
                                                </s-stack>
                                            </s-stack>
                                        </s-box>
                                    </s-box>
                                );
                            })}
                        </s-stack>
                    )}
                </s-section>

                {/* ── Create Form Modal ── */}
                <s-modal id="FormInput" heading="Create New B2B Form">
                    <s-stack padding="none base none base">
                        <s-text-field
                            label="Form Name"
                            placeholder="e.g., Wholesale Partner Registration"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                        />
                    </s-stack>
                    <s-stack direction="inline" justifyContent="end" gap="small" padding="base base none base">
                        <s-button variant="secondary" onClick={closeFormModal}>Cancel</s-button>
                        <s-button variant="primary" onClick={createForm} disabled={!formName.trim()}>Continue to Builder</s-button>
                    </s-stack>
                </s-modal>

                {/* ── Delete Confirmation Modal ── */}
                <s-modal id="DeleteFormConfirm" heading="Delete Form & All Data?" variant="danger">
                    <s-stack padding="base" direction="block" gap="base">
                        <s-banner tone="critical">
                            <s-stack direction="block" gap="tight">
                                <strong>⚠ This is a permanent, irreversible action.</strong>
                                <s-paragraph>
                                    Deleting <strong>{deleteTarget?.name || "this form"}</strong> will permanently remove:
                                </s-paragraph>
                                <ul style={{ paddingLeft: "20px", margin: "4px 0" }}>
                                    <li>The form definition and all its fields</li>
                                    <li>All submitted entries stored in the database</li>
                                    <li>The Shopify Metaobject definition and all Metaobject entries created from submissions</li>
                                </ul>
                                <s-paragraph>
                                    This action <strong>cannot be undone</strong>. Customers&apos; submitted data will be lost.
                                </s-paragraph>
                            </s-stack>
                        </s-banner>
                    </s-stack>
                    <s-stack direction="inline" justifyContent="end" gap="small" padding="none base base base">
                        <s-button
                            variant="secondary"
                            onClick={() => { setDeleteTarget(null); shopify.modal.hide("DeleteFormConfirm"); }}
                        >
                            Cancel
                        </s-button>
                        <s-button variant="primary" tone="critical" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? "Deleting…" : "Yes, Delete Everything"}
                        </s-button>
                    </s-stack>
                </s-modal>
            </s-page>
        </>
    );
}