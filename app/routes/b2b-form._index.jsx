import { authenticate } from "../shopify.server";
import { handleFormSubmission } from "../services/formSubmission.server";
import db from "../db.server";

export const action = async ({ request }) => {
    return handleFormSubmission({ request });
};

export const loader = async ({ request }) => {
    let shopDomain = null;

    try {
        const proxyAuth = await authenticate.public.appProxy(request);
        shopDomain = proxyAuth?.session?.shop;
    } catch (e) {
        console.debug("Proxy auth fallback in _index loader:", e?.message);
    }

    const url = new URL(request.url);
    if (!shopDomain) {
        shopDomain = url.searchParams.get("shop");
    }

    const formId = url.searchParams.get("form_id");

    let form = null;
    if (formId && shopDomain) {
        form = await db.form.findFirst({
            where: { id: formId, shop: shopDomain },
        });
    } else if (shopDomain) {
        form = await db.form.findFirst({
            where: { shop: shopDomain },
            orderBy: { createdAt: "desc" },
        });
    } else {
        form = await db.form.findFirst({
            orderBy: { createdAt: "desc" },
        });
    }

    if (!form) {
        return new Response("<div style='text-align:center;padding:40px 20px;font-family:sans-serif;'><h2>Form Not Found</h2><p>No active B2B application form found for this store.</p></div>", {
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
            "Cache-Control": "no-cache",
        },
    });
};
