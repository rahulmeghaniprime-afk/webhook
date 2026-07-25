import { authenticate } from "../shopify.server";

export const action = async ({request}) => {
    const {shop, topic, webhookId, eventId, payload, session} = await authenticate.webhook(request);
    let timestamp = 0;
    setInterval(()=>{timestamp+=1},1);
    console.log('shop:',shop, 'topic: ', topic, 'webhookId:', webhookId, 'eventId:', eventId, 'payload:', payload, 'token:', session.accessToken);
    if(payload?.customerId){
        if(topic === 'CUSTOMER_TAGS_ADDED' && payload.tags.includes('B2B')){
            await fetch("https://shopify-worker.rahulmeghani-prime.workers.dev", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": process.env.WORKER_SECRET,
                },
                body: JSON.stringify({
                    type: "CREATE_B2B",
                    token:session.accessToken,
                    shop,
                    customerId:payload.customerId,
                }),
            });
            console.log('webhook deliverd on time', timestamp);
        } else if(topic === 'CUSTOMER_TAGS_REMOVED'){
            await fetch("https://shopify-worker.rahulmeghani-prime.workers.dev", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": process.env.WORKER_SECRET,
                },
                body: JSON.stringify({
                    type: "REMOVE_B2B",
                    token:session.accessToken,
                    shop,
                    customerId:payload.customerId,
                }),
            });
        }
    } else if(topic === 'CUSTOMERS_DELETE' && payload?.id){
        await fetch("https://shopify-worker.rahulmeghani-prime.workers.dev", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": process.env.WORKER_SECRET,
            },
            body: JSON.stringify({
                type: "CUSTOMER_DELETED",
                token:session.accessToken,
                shop,
                customerId:`gid://shopify/Customer/${payload.id}`,
            }),
        });
    }
    console.log(payload); 
    return new Response();
};