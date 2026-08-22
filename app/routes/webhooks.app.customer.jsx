import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
    const clonedRequest = request.clone();
    const { shop, topic, webhookId, eventId, payload, session, admin } = await authenticate.webhook(request);
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
    const market_catalog = storeTags.find(mObj => payload.tags.includes(mObj.tag));
    let timestamp = 0;
    setInterval(() => { timestamp += 1 }, 1);
    console.log('shop:', shop, 'topic: ', topic, 'webhookId:', webhookId, 'eventId:', eventId, 'payload:', payload, 'token:', session.accessToken);
    const originalHmac = clonedRequest.headers.get("X-Shopify-Hmac-Sha256");
    const rawBodyText = await clonedRequest.text();
    if (payload?.customerId) {
        await fetch("http://localhost:5566", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": process.env.WORKER_SECRET,
                "X-Shopify-Hmac-Sha256": originalHmac
            },
            body: rawBodyText,
        });
        if (topic === 'CUSTOMER_TAGS_ADDED' && market_catalog) {
            console.log(market_catalog)
            await fetch("https://shopify-worker.rahulmeghani-prime.workers.dev", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": process.env.WORKER_SECRET,
                },
                body: JSON.stringify({
                    type: "CREATE_B2B",
                    token: session.accessToken,
                    shop,
                    market_catalog,
                    customerId: payload.customerId,
                }),
            });
            console.log('webhook deliverd on time', timestamp);
        } else if (topic === 'CUSTOMER_TAGS_REMOVED' && market_catalog) {
            await fetch("https://shopify-worker.rahulmeghani-prime.workers.dev", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": process.env.WORKER_SECRET,
                },
                body: JSON.stringify({
                    type: "REMOVE_B2B",
                    token: session.accessToken,
                    shop,
                    market_catalog,
                    customerId: payload.customerId,
                }),
            });
        }
    } else if (topic === 'CUSTOMERS_DELETE' && payload?.id) {
        await fetch("https://shopify-worker.rahulmeghani-prime.workers.dev", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": process.env.WORKER_SECRET,
            },
            body: JSON.stringify({
                type: "CUSTOMER_DELETED",
                token: session.accessToken,
                shop,
                customerId: `gid://shopify/Customer/${payload.id}`,
            }),
        });
    }
    console.log(payload);
    return new Response();
};