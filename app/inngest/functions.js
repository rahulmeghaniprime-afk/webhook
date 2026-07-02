import { inngest } from "./client";

export const createB2BCompany = inngest.createFunction(
  { id: "create-b2b-company" },

  { event: "tag.created" },

  async ({ event }) => {
    const customer = event.data;
    console.log(customer);
  }
);