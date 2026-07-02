import { authenticate } from "../shopify.server";

export const action = async ({request}) => {
    const {shop, topic, session, webhookId, eventId, payload} = await authenticate.webhook(request);
    console.log('shop:',shop, 'topic: ', topic, 'webhookId:', webhookId, 'eventId:', eventId, 'payload:', payload);
    console.log(typeof payload); 
    return new Response();
};