import { handleFormSubmission } from "../services/formSubmission.server";

export const action = async ({ request }) => {
    return handleFormSubmission({ request });
};

export const loader = async () => {
    return Response.json({ status: "Form submission endpoint active" });
};