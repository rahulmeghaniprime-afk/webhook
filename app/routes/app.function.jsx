import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

const FUNCTION_HANDLE = "payment-customization";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Get existing payment customizations
  const query = `
    query {
      paymentCustomizations(first: 250) {
        nodes {
          id
          title
          enabled
          functionHandle
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const data = await response.json();

  const existingCustomization =
    data?.data?.paymentCustomizations?.nodes?.find(
      (item) => item.functionHandle === FUNCTION_HANDLE
    );

  let created = false;
  let customizationId = existingCustomization?.id;

  if (!existingCustomization) {
    const createMutation = `
      mutation {
        paymentCustomizationCreate(
          paymentCustomization: {
            title: "Payment Limit Customization"
            enabled: true
            functionHandle: "${FUNCTION_HANDLE}"
          }
        ) {
          paymentCustomization {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const createResponse = await admin.graphql(createMutation);
    const createData = await createResponse.json();

    const errors =
      createData?.data?.paymentCustomizationCreate?.userErrors || [];

    if (errors.length) {
      throw new Error(JSON.stringify(errors));
    }

    customizationId =
      createData?.data?.paymentCustomizationCreate?.paymentCustomization?.id;

    created = true;

    // Create metafield
    const metafieldMutation = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            namespace
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const metafieldVariables = {
      metafields: [
        {
          ownerId: customizationId,
          namespace: "app",
          key: "config",
          type: "json",
          value: JSON.stringify({
            limit: 1000,
          }),
        },
      ],
    };

    const metafieldResponse = await admin.graphql(
      metafieldMutation,
      {
        variables: metafieldVariables,
      }
    );

    const metafieldData = await metafieldResponse.json();

    const metafieldErrors =
      metafieldData?.data?.metafieldsSet?.userErrors || [];

    if (metafieldErrors.length) {
      throw new Error(JSON.stringify(metafieldErrors));
    }
  }

  return json({
    customizationId,
    created,
  });
};

export default function FunctionPage() {
  const data = useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Payment Customization</h1>

      <p>
        Customization ID: <strong>{data.customizationId}</strong>
      </p>

      <p>
        Status:{" "}
        <strong>
          {data.created ? "Created" : "Already Exists"}
        </strong>
      </p>
    </div>
  );
}