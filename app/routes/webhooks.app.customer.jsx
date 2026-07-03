import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({request}) => {
    const {shop, topic, webhookId, eventId, payload, session} = await authenticate.webhook(request);
    console.log('shop:',shop, 'topic: ', topic, 'webhookId:', webhookId, 'eventId:', eventId, 'payload:', payload, 'token:', session.accessToken);
    if(payload?.customerId){
        if(topic === 'CUSTOMER_TAGS_ADDED' && payload.tags.includes('B2B')){
            await prisma.appData.upsert({
                where: {
                    shop_customerId: {
                    shop,
                    customerId: BigInt(payload.customerId.split("/").pop()),
                    },
                }, 
                update: {},
                create: {
                    shop,
                    customerId: BigInt(payload.customerId.split("/").pop()),
                },
            });
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
        } else if(topic === 'CUSTOMER_TAGS_REMOVED'){
            await prisma.appData.deleteMany({
                where: {
                    shop,
                    customerId: BigInt(payload.customerId.split("/").pop()),
                },
            });
        }
    } else if(payload?.id){
        await prisma.appData.deleteMany({ 
            where: {
                shop,
                customerId: BigInt(payload.id),
            },
        });
    }
    console.log(payload); 
    return new Response();
};