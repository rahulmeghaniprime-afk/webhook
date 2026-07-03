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
    const secret = request.headers.get("X-Worker-Secret");
    console.log("Header:", secret);
    console.log("Env:", env.WORKER_SECRET);
    if (secret !== env.WORKER_SECRET) {
      console.log("Secret mismatch");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    if (
      body.type !== "CREATE_B2B" ||
      !body.shop ||
      !body.customerId ||
      !body.token
    ) {
      return new Response("Bad Request", { status: 400 });
    }

    ctx.waitUntil(processCustomer(body, env));

    return new Response("OK", {
      status: 202,
    });
  },
};

async function processCustomer(Adata, env) {
  console.log(Adata);
  try {
    await  compnayCreate(Adata);
  } catch (err) {
    console.error(err);
  }
}

async function getCompanyContactRoleId(shopDomain, accessToken, companyId, roleNameToFind) {
  const query = `
    query CompanyContactRoles($id: ID!) {
      company(id: $id) {
        id
        name
        contactRoles(first: 5) {
          edges {
            node {
              id
              name
              note
            }
          }
        }
      }
    }
  `;

  const variables = { id: companyId };

  const res = await fetch(
    `https://${shopDomain}/admin/api/2026-07/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query, variables })
    }
  );

  const data = await res.json();

  const edges = data?.data?.company?.contactRoles?.edges || [];
  const match = edges.find(edge => edge.node.name === roleNameToFind);

  return match ? match.node.id : null;
}

async function compnayCreate(Adata) {
  const shopDomain = Adata.shop;
  const accessToken = Adata.token;

  // 1) companyCreate as you already have
  const companyCreateQuery = `
    mutation CompanyCreateWithLocation($input: CompanyCreateInput!) {
      companyCreate(input: $input) {
        company {
          id
          name
          locations(first: 5) {
            edges {
              node {
                id
                name
                buyerExperienceConfiguration {
                  editableShippingAddress
                }
              }
            }
          }
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const companyCreateVariables = {
    input: {
      company: {
        name: "Test Company Created"
      },
      companyLocation: {
        name: "Test Company Location",
        buyerExperienceConfiguration: {
          editableShippingAddress: true
        }
      }
    }
  };

  try {
    // --- Step 1: create company + location ---
    const createRes = await fetch(
      `https://${shopDomain}/admin/api/2026-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
          query: companyCreateQuery,
          variables: companyCreateVariables
        })
      }
    );

    const createData = await createRes.json();

    const createErrors = createData?.data?.companyCreate?.userErrors;
    if (createErrors && createErrors.length > 0) {
      console.error('companyCreate userErrors:', createErrors);
      return;
    }

    const company = createData?.data?.companyCreate?.company;
    const companyId = company?.id || null;
    const locationEdges = company?.locations?.edges || [];
    const companyLocationId = locationEdges[0]?.node?.id || null;


    if (!companyId || !companyLocationId) {
      console.error('Missing companyId or companyLocationId, cannot continue.');
      return;
    }

    // --- Step 2: assign existing customer as contact ---
    const assignContactQuery = `
      mutation CompanyAssignCustomerAsContact($companyId: ID!, $customerId: ID!) {
        companyAssignCustomerAsContact(companyId: $companyId, customerId: $customerId) {
          companyContact {
            id
            company {
              id
              name
            }
            customer {
              id
              defaultEmailAddress {
                emailAddress
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const assignContactVariables = {
      companyId,
      customerId: Adata.customerId
    };

    const assignContactRes = await fetch(
      `https://${shopDomain}/admin/api/2026-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
          query: assignContactQuery,
          variables: assignContactVariables
        })
      }
    );

    const assignContactData = await assignContactRes.json();

    const assignContactErrors = assignContactData?.data?.companyAssignCustomerAsContact?.userErrors;
    if (assignContactErrors && assignContactErrors.length > 0) {
      console.error('companyAssignCustomerAsContact userErrors:', assignContactErrors);
      return;
    }

    const companyContactId =
      assignContactData?.data?.companyAssignCustomerAsContact?.companyContact?.id ||
      null;



    if (!companyContactId) {
      console.error('Missing companyContactId, cannot assign role.');
      return;
    }

    // --- Step 3: fetch actual role ID (e.g. "Ordering only") ---
    const roleNameToFind = "Ordering only"; // or "Location admin", etc.
    const companyContactRoleId = await getCompanyContactRoleId(
      shopDomain,
      accessToken,
      companyId,
      roleNameToFind
    );



    if (!companyContactRoleId) {
      console.error(`Role "${roleNameToFind}" not found for this company.`);
      return;
    }

    // --- Step 4: assign that role to the contact at the location ---
    const assignRoleQuery = `
      mutation CompanyContactAssignRole(
        $companyContactId: ID!
        $companyContactRoleId: ID!
        $companyLocationId: ID!
      ) {
        companyContactAssignRole(
          companyContactId: $companyContactId
          companyContactRoleId: $companyContactRoleId
          companyLocationId: $companyLocationId
        ) {
          companyContactRoleAssignment {
            id
            companyContact {
              id
            }
            companyLocation {
              id
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const assignRoleVariables = {
      companyContactId,
      companyContactRoleId, // <-- using returned value here
      companyLocationId
    };

    const assignRoleRes = await fetch(
      `https://${shopDomain}/admin/api/2026-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
          query: assignRoleQuery,
          variables: assignRoleVariables
        })
      }
    );

    const assignRoleData = await assignRoleRes.json();


    const assignRoleErrors =
      assignRoleData?.data?.companyContactAssignRole?.userErrors;
    if (assignRoleErrors && assignRoleErrors.length > 0) {
      console.error('companyContactAssignRole userErrors:', assignRoleErrors);
      return;
    }

  } catch (err) {
    console.error('Error in compnayCreate flow:', err);
  }
}