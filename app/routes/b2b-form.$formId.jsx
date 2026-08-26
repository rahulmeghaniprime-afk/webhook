// app/routes/proxy.b2b-form.$formId.jsx
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request, params }) => {
    const { session } = await authenticate.public.appProxy(request);

    // authenticate.public.appProxy() already:
    //  1. Recomputes the HMAC-SHA256 signature over the sorted query params
    //     using SHOPIFY_API_SECRET
    //  2. Rejects the request (throws) if it doesn't match, or if the shop
    //     has no active session
    // Getting past this line means Shopify actually sent this request.

    if (!session) {
        // App was likely uninstalled for this shop, or the shop is unrecognized.
        return new Response("<p>This form is currently unavailable.</p>", {
            status: 404,
            headers: { "Content-Type": "application/liquid" },
        });
    }

    const url = new URL(request.url);
    const formId = params.formId ?? url.searchParams.get("form_id");

    // ALWAYS scope by shop — never trust formId alone. Otherwise shop A can
    // request shop B's form by guessing/incrementing an id.
    const form = await db.form.findFirst({
        where: { id: formId, shop: session.shop },
    });

    if (!form) {
        return new Response("<p>Form not found.</p>", {
            status: 404,
            headers: { "Content-Type": "application/liquid" },
        });
    }

    const liquid = `
    <style>${form.css}</style>
    ${form.html}
  `;

    return new Response(liquid, {
        status: 200,
        headers: {
            "Content-Type": "application/liquid",
            // Optional: let Shopify's edge cache this for a bit since the form
            // rarely changes. Skip this while the merchant is actively editing.
            "Cache-Control": "public, max-age=60",
        },
    });
};