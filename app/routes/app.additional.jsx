import { authenticate } from "../shopify.server";
import { useLoaderData, useRevalidator } from "react-router";

export const loader = async ({request}) => {
  const {admin} = await authenticate.admin(request);
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
  const responseData = await response.json();
  const responsePlanData = await planRes.json();
  if(!responseData?.data?.markets?.nodes || !responsePlanData?.data?.shop?.plan){
    return {
      error: responseData?.data?.markets?.userErrors || responseData?.errors || "Unknown Error Market",
      errorplan: responsePlanData?.data?.shop?.userErrors || responsePlanData?.errors || "Unknown Error Plan"
    }
  }
  const markets = responseData.data.markets.nodes;
  const plusPlan = responsePlanData.data.shop.plan.shopifyPlus;
  return {markets, plusPlan}
}

export default function AdditionalPage() {
  const {markets, plusPlan} = useLoaderData();
  const revalidator = useRevalidator();
  console.log(markets)
  // const openModal = (id) => {
  //   shopify.modal.show(id);
  // }
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
    if(response.code === 'ok'){

    }
  }
  const editMarket = async (id) => {
    const marketActivity = await shopify.intents.invoke('edit:shopify/Market',{value: `${id}`})
    const response = await marketActivity.complete;
    if (response.code === 'ok') {
      revalidator.revalidate();
    }
  }
  const totalcatalog = markets.map(market => market.catalogsCount.count).reduce((a, b)=> a + b, 0)
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
          <s-button onClick={openmarket} icon="markets">Create Market</s-button>
          <s-button onClick={opencatalog} icon="catalog-product">Create Catalog</s-button>
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
      <s-section heading={"Company Location Markets ("+markets.length+")"}>
        {!plusPlan && <s-grid paddingBlockEnd="base" gridTemplateColumns="auto auto" justifyContent="space-between" alignItems="center"><s-grid-item><s-paragraph><s-text>Max Catalog Usage Limit: 3</s-text></s-paragraph></s-grid-item><s-grid-item><s-paragraph><s-text tone="neutral">Catalog Used {plusPlan ? (totalcatalog) : (`${totalcatalog}/3`)}</s-text></s-paragraph></s-grid-item></s-grid>}
        
        {markets?.length > 0 ? (
          <s-table>
              <s-table-header-row>
                <s-table-header>Market Name</s-table-header>
                <s-table-header >Catalogs Attached</s-table-header>
                <s-table-header>Catalog Name</s-table-header>
                <s-table-header></s-table-header>
              </s-table-header-row>
            <s-table-body>
              {markets.map((market) => (
                <s-table-row key={market.id}>
                  <s-table-cell>{market.name}</s-table-cell>
                  <s-table-cell>{market.catalogsCount?.count || 0}</s-table-cell>
                  <s-table-cell>{market.catalogs.nodes.map(catalog => catalog.title).join(', ') || ''}</s-table-cell>
                  <s-table-cell><s-button onClick={()=>editMarket(market.id)}>edit</s-button></s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>No markets found.</s-paragraph>
        )}
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
