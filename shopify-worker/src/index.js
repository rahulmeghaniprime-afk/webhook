/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.json();

    ctx.waitUntil(processCustomer(body, env));

    return new Response("Accepted", {
      status: 202,
    });
  },
};

async function processCustomer(data, env) {
  console.log(data.customerId);

  // TODO:
  // Create company
  // Create location
  // Assign company contact
  // Add tag
}