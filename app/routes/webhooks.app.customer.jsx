import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
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
    if (payload?.customerId) {
        if (topic === 'CUSTOMER_TAGS_ADDED' && market_catalog) {
            console.log(market_catalog)
            await fetch("http://localhost:5566", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": process.env.WORKER_SECRET
                },
                body: JSON.stringify({
                    type: "CREATE_B2B",
                    shop,
                    market_catalog,
                    eventId,
                    customerId: payload.customerId,
                }),
            });
            console.log('webhook deliverd on time', timestamp);
        } else if (topic === 'CUSTOMER_TAGS_REMOVED' && market_catalog) {
            await fetch("http://localhost:5566", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": process.env.WORKER_SECRET
                },
                body: JSON.stringify({
                    type: "REMOVE_B2B",
                    shop,
                    market_catalog,
                    eventId,
                    customerId: payload.customerId,
                }),
            });
        }
    } else if (topic === 'CUSTOMERS_DELETE' && payload?.id) {
        await fetch("http://localhost:5566", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": process.env.WORKER_SECRET
            },
            body: JSON.stringify({
                type: "CUSTOMER_DELETED",
                shop,
                eventId,
                customerId: payload.customerId,
            }),
        });
    }
    console.log(payload);
    return new Response();
};