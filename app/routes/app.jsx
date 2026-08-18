import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import TawkChat from "../component/TawkChat";
import Crispt from "../component/Crispt";

// export const loader = async ({ request }) => {
//   await authenticate.admin(request);

//   // eslint-disable-next-line no-undef
//   return { apiKey: process.env.SHOPIFY_API_KEY || "" };
// };

export const loader = async ({ request }) => {
  // Replace with the "app_handle" from your shopify.app.toml file
  const appHandle = "webhook-171";


  // Initiate billing and redirect utilities
  const { billing, redirect, session, admin } = await authenticate.admin(request);

  const storePlan = await admin.graphql(
    `#graphql
      query{
        shop{
          plan{
            partnerDevelopment
          }
        }
      }`
  );
  const devlopmentStore = await storePlan.json();

  const isDevelopment = devlopmentStore?.data?.shop?.plan?.partnerDevelopment;
  console.log(isDevelopment)
  if (isDevelopment) {
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
    };
  }

  // Check whether the store has an active subscription
  const { hasActivePayment } = await billing.check();

  // Extract the store handle from the shop domain
  // e.g., "cool-shop" from "cool-shop.myshopify.com"
  const shop = session.shop; // e.g., "cool-shop.myshopify.com"
  const storeHandle = shop.replace('.myshopify.com', '');

  // If there's no active subscription, redirect to the plan selection page...
  if (!hasActivePayment) {
    return redirect(`https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`, {
      target: "_top", // required since the URL is outside the app scope
    });
  }

  // ...Otherwise, continue loading the app as normal
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};


export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <ui-nav-menu>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/form">Form</s-link>
      </ui-nav-menu>
      <Outlet />
      {/* <TawkChat /> */}
      <Crispt />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
