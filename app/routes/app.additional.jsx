import { authenticate } from "../shopify.server";
import { useLoaderData, useRevalidator, useFetcher } from "react-router";
import {Tagcomponent} from './component/tagcomponent'
import { useState } from "react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query Markets {
        markets(first: 250, query:"market_type:COMPANY_LOCATION") {
          nodes {
            name
            id
            name
            type
            catalogsCount{
              count
            }
            catalogs(first:250){
              nodes{
                id
                title
              }
            }
          }
        }
      }
    `
  );
  const planRes = await admin.graphql(
    `#graphql
      query ShopPlan{
        shop{
          plan{
            partnerDevelopment
            publicDisplayName
            shopifyPlus
          }
        }
      }
    `
  );
  const metaRes = await admin.graphql(
    `#graphql
      query {
       shop {
        id
         store_tagline: metafield(key: "store_tags") {
           jsonValue
         }
       }
     }
    `
  )
  const responseData = await response.json();
  const responsePlanData = await planRes.json();
  const metafieldData = await metaRes.json();
  if (!responseData?.data?.markets?.nodes || !responsePlanData?.data?.shop?.plan) {
    return {
      error: responseData?.data?.markets?.userErrors || responseData?.errors || "Unknown Error Market",
      errorplan: responsePlanData?.data?.shop?.userErrors || responsePlanData?.errors || "Unknown Error Plan"
    }
  }
  const markets = responseData.data.markets.nodes;
  const plusPlan = responsePlanData.data.shop.plan.shopifyPlus;
  return { markets, plusPlan, metafieldData }
}

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("metaupdate");
  const metadataRaw = formData.get("metadata");
  if(intent === 'metaupdate'){
    console.log(metadataRaw);
    const metadata = JSON.parse(metadataRaw);
    const metaRes = await admin.graphql(`
      #graphql
        mutation SetShopMetafield($value: String!) {
          metafieldsSet(metafields: [{
            type: "json"
            ownerId: "gid://shopify/Shop/78456586439"
            key: "store_tagline"
            value: $value
          }]) {
            metafields { id key value }
            userErrors { field message }
          }
        }
      `,{
        variables: {
          value:metadataRaw
        }
      });
  }
}

export default function AdditionalPage() {
  const { markets, plusPlan, metafieldData } = useLoaderData();
  const [metadata, setMetadata] = useState(metafieldData);
  const fetcher = useFetcher();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const generateTags = () => fetcher.submit({intents:"metaupdate",metadata:JSON.stringify(metadata);}, { method: "POST" });
  const revalidator = useRevalidator();
  console.log(markets)
  const openModal = (id) => {
  console.log("openModal called with id:", id);
  shopify.modal.show(id);
};

const closeModal = (id) => {
  console.log("closeModal called with id:", id);
  shopify.modal.hide(id);
};
  const openmarket = async () => {
    const activity = await shopify.intents.invoke('create:shopify/Market');
    const response = await activity.complete;
    if (response.code === 'ok') {
      revalidator.revalidate();
    }
  }
  const opencatalog = async () => {
    const catalogActivity = await shopify.intents.invoke('create:shopify/Catalog');
    const response = await catalogActivity.complete;
    if (response.code === 'ok') {

    }
  }
  const editMarket = async (id) => {
    const marketActivity = await shopify.intents.invoke('edit:shopify/Market', { value: `${id}` })
    const response = await marketActivity.complete;
    if (response.code === 'ok') {
      revalidator.revalidate();
    }
  }
  const editCatalog = async (id) => {
    const catalogActivity = await shopify.intents.invoke('edit:shopify/Catalog', { value: `${id}` })
    const response = await catalogActivity.complete;
    if (response.code === 'ok') {
      revalidator.revalidate();
    }
  }
  const totalcatalog = markets.map(market => market.catalogsCount.count).reduce((a, b) => a + b, 0)
  return (
    <s-page heading="Additional page">
      <s-section heading="Multiple pages">
        <s-paragraph>
          The app template comes with an additional page which demonstrates how
          to create multiple pages within app navigation using{" "}
          <s-link
            href="https://shopify.dev/docs/apps/tools/app-bridge"
            target="_blank"
          >
            App Bridge
          </s-link>
          .
        </s-paragraph>
        <s-paragraph>
          To create your own page and have it show up in the app navigation, add
          a page inside <code>app/routes</code>, and a link to it in the{" "}
          <code>&lt;ui-nav-menu&gt;</code> component found in{" "}
          <code>app/routes/app.jsx</code>.
        </s-paragraph>
        <s-grid paddingBlockStart="base" gridTemplateColumns="auto auto" justifyContent="space-between" alignItems="center">
        </s-grid>
      </s-section>
      <s-section slot="aside" heading="Resources">
        <s-unordered-list>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav"
              target="_blank"
            >
              App nav best practices
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
      <s-section heading={"Company Location Markets (" + markets.length + ")"}>
        {!plusPlan && <s-grid paddingBlockEnd="base" gridTemplateColumns="auto auto" justifyContent="space-between" alignItems="center">
          <s-grid-item>
            <s-button onClick={openmarket} icon="markets">Create Market</s-button>
            <s-paragraph><s-text>Max Catalog Usage Limit: 3</s-text></s-paragraph>
          </s-grid-item>
          <s-grid-item>
            <s-grid justifyContent="end">
              <s-button onClick={opencatalog} icon="catalog-product" disabled={plusPlan ? false : true}>Create Catalog</s-button>
            </s-grid>
            <s-paragraph><s-text tone="neutral">Catalog Used {plusPlan ? (totalcatalog) : (`${totalcatalog} out of 3`)}</s-text></s-paragraph>
          </s-grid-item>
        </s-grid>}

        {markets?.length > 0 ? (
          <s-table>
            <s-table-header-row>
              <s-table-header>Market Name</s-table-header>
              <s-table-header><s-stack inlineSize="100px" justifyContent="center" >Catalogs Attached to Market</s-stack></s-table-header>
              <s-table-header>Catalog Name</s-table-header>
              <s-table-header>Customer Tag</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {markets.map((market) => (
                <s-table-row key={market.id}>
                  <s-table-cell><s-link onClick={() => editMarket(market.id)}>{market.name}</s-link></s-table-cell>
                  <s-table-cell>{market.catalogsCount?.count || 0}</s-table-cell>
                  <s-table-cell>{market.catalogs.nodes.map((catalog, cat_index) => <>
                    <s-link onClick={() => editCatalog(catalog.id)} key={catalog.id}>{catalog.title}</s-link>{market.catalogs.nodes.length > 1 && cat_index !== (market.catalogs.nodes.length - 1) ? ' , ' : ''}
                  </>)}</s-table-cell>
                  <s-table-cell>{market.catalogs.nodes.length ? (
                    <s-button onClick={() => openModal(market.id)}>Add</s-button>
                  ) : ('')}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>No markets found.</s-paragraph>
        )}



        <Tagcomponent markets={markets}/>
      </s-section>


      {/* <s-button
        id="open-additional-modal"
        variant="primary"
        onClick={() => {openModal("additional-modal")}}
      >
        Open modal
      </s-button> */}
      {/* <s-modal id="additional-modal" heading="Additional modal">
        <s-scroll-box overflow="auto hidden" maxBlockSize="300px">
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>

          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>

          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
          <s-paragraph>
            This is a modal. You can open it by clicking the "Open modal" button
            in the app navigation.
          </s-paragraph>
        </s-scroll-box>

      </s-modal> */}
    </s-page>
  );
}
