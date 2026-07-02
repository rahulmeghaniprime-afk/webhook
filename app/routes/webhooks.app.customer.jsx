import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({request}) => {
    const {shop, topic, webhookId, eventId, payload} = await authenticate.webhook(request);
    console.log('shop:',shop, 'topic: ', topic, 'webhookId:', webhookId, 'eventId:', eventId, 'payload:', payload);
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