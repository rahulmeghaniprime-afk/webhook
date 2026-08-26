import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
    const { session } = await authenticate.public.appProxy(request);
    if (!session) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const formId = formData.get("form_id");

    // Re-fetch the form + field definitions server-side. Never trust which
    // fields are "required" from the client — the browser's `required`
    // attribute is a UX nicety, not enforcement.
    const form = await db.form.findFirst({
        where: { id: formId, shop: session.shop },
        include: { FieldMapping: true },
    });

    if (!form) {
        return Response.json({ success: false, error: "Form not found" }, { status: 404 });
    }

    // Build { metaobjectKey: value } from the raw submission, validating
    // required fields against the stored FieldMapping — not against
    // whatever the client happened to send.
    const values = {};
    const missing = [];

    for (const mapping of form.FieldMapping) {
        const raw = formData.getAll(mapping.fieldId); // getAll() handles checkbox_group[]
        const value = raw.length > 1 ? raw.join(", ") : (raw[0] ?? "");

        if (mapping.required && !value) {
            missing.push(mapping.fieldLabel);
            continue;
        }
        values[mapping.metaobjectKey] = String(value).slice(0, 5000); // basic length guard
    }

    if (missing.length > 0) {
        return Response.json(
            { success: false, error: `Missing required fields: ${missing.join(", ")}` },
            { status: 422 },
        );
    }

    // 1) Durable record first, independent of whether the Metaobject call
    //    succeeds. This is what lets you retry/reconcile failures later
    //    instead of silently losing a submission.
    const submission = await db.formSubmission.create({
        data: {
            formId: form.id,
            shop: session.shop,
            customerId: formData.get("customer_id") || null,
            payload: JSON.stringify(values),
            status: "pending",
        },
    });

    // 2) Create the Metaobject entry via Admin GraphQL
    const mutation = `
    mutation CreateSubmission($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message }
      }
    }
  `;

    const { admin } = session; // or re-derive an admin client for this shop
    const res = await admin.graphql(mutation, {
        variables: {
            metaobject: {
                type: form.metaobjectType,
                fields: Object.entries(values).map(([key, value]) => ({ key, value })),
            },
        },
    });

    const json = await res.json();
    const errors = json?.data?.metaobjectCreate?.userErrors;

    if (errors?.length) {
        await db.formSubmission.update({
            where: { id: submission.id },
            data: { status: "failed", error: JSON.stringify(errors) },
        });
        return Response.json({ success: false, error: "Could not save submission" }, { status: 400 });
    }

    await db.formSubmission.update({
        where: { id: submission.id },
        data: {
            status: "created",
            metaobjectId: json.data.metaobjectCreate.metaobject.id,
        },
    });

    return Response.json({ success: true });
};