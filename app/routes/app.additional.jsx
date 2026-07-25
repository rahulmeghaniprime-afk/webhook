import { authenticate } from "../shopify.server";
import { useLoaderData, useRevalidator, useFetcher } from "react-router";
import {Tagcomponent} from './component/tagcomponent'
import { useState, useEffect } from "react";
import prisma from "../db.server";

// export const loader = async ({ request }) => {
//   const { admin } = await authenticate.admin(request);
//   const response = await admin.graphql(
//     `#graphql
//       query Markets {
//         markets(first: 250, query:"market_type:COMPANY_LOCATION") {
//           nodes {
//             name
//             id
//             name
//             type
//             catalogsCount{
//               count
//             }
//             catalogs(first:250){
//               nodes{
//                 id
//                 title
//               }
//             }
//           }
//         }
//       }
//     `
//   );
//   const planRes = await admin.graphql(
//     `#graphql
//       query ShopPlan{
//         shop{
//           plan{
//             partnerDevelopment
//             publicDisplayName
//             shopifyPlus
//           }
//         }
//       }
//     `
//   );
//   const metaRes = await admin.graphql(
//     `#graphql
//       query {
//        shop {
//         id
//          store_tagline: metafield(key: "store_tags") {
//            jsonValue
//          }
//        }
//      }
//     `
//   )
//   const responseData = await response.json();
//   const responsePlanData = await planRes.json();
//   const metafieldData = await metaRes.json();
//   if (!responseData?.data?.markets?.nodes || !responsePlanData?.data?.shop?.plan) {
//     return {
//       error: responseData?.data?.markets?.userErrors || responseData?.errors || "Unknown Error Market",
//       errorplan: responsePlanData?.data?.shop?.userErrors || responsePlanData?.errors || "Unknown Error Plan"
//     }
//   }
//   const markets = responseData.data.markets.nodes;
//   const plusPlan = responsePlanData.data.shop.plan.shopifyPlus;
//   return { markets, plusPlan, metafieldData }
// }

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const marketRes = await admin.graphql(`
    #graphql
    query Markets {
      markets(first:250, query:"market_type:COMPANY_LOCATION") {
        nodes {
          id
          name
          catalogsCount {
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
  `);

  const metaRes = await admin.graphql(`
    #graphql
    query {
      shop {
        id
        metafield(namespace:"custom", key:"store_tags") {
          jsonValue
        }
      }
    }
  `);

  const marketData = await marketRes.json();
  const metafieldData = await metaRes.json();

  const shop = session.shop;

  const savedTags = await prisma.tagData.findMany({
    where: {
      shop,
    },
  });

  const tagMap = {};

  savedTags.forEach((row) => {
    tagMap[`${row.market}_${row.catalog}`] = {
      tag: row.tag,
      market: row.market,
      catalog: row.catalog,
    };
  });

  return {
    markets: marketData.data.markets.nodes,
    tagMap,
    metafield:
      metafieldData?.data?.shop?.metafield?.jsonValue || {},
    shop,
  };
};

// export const action = async ({ request }) => {
//   const { admin } = await authenticate.admin(request);
//   const formData = await request.formData();
//   const intent = formData.get("metaupdate");
//   const metadataRaw = formData.get("metadata");
//   if(intent === 'metaupdate'){
//     console.log(metadataRaw);
//     const metadata = JSON.parse(metadataRaw);
//     const metaRes = await admin.graphql(`
//       #graphql
//         mutation SetShopMetafield($value: String!) {
//           metafieldsSet(metafields: [{
//             type: "json"
//             ownerId: "gid://shopify/Shop/78456586439"
//             key: "store_tagline"
//             value: $value
//           }]) {
//             metafields { id key value }
//             userErrors { field message }
//           }
//         }
//       `,{
//         variables: {
//           value:metadataRaw
//         }
//       });
//   }
// }


export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();

  const intent = formData.get("intent");

  if (intent !== "saveTag") {
    return { success: false };
  }

  const market = formData.get("market");
  const catalog = formData.get("catalog");
  const tag = formData.get("tag");

  const shop = session.shop;

  await prisma.tagData.upsert({
    where: {
      shop_market_catalog: {
        shop,
        market,
        catalog,
      },
    },
    update: {
      tag,
    },
    create: {
      shop,
      market,
      catalog,
      tag,
    },
  });

  await rebuildStoreTagsMetafield(
    admin,
    shopId,
    shop
  );

  const allTags = await prisma.tagData.findMany({
    where: {
      shop,
    },
  });

  const metafieldJson = {};

  allTags.forEach((row) => {
    metafieldJson[row.market] = {
      catalog: row.catalog,
      tag: row.tag,
    };
  });

  const shopRes = await admin.graphql(`
    #graphql
    query {
      shop {
        id
      }
    }
  `);

  const shopData = await shopRes.json();

  const shopId = shopData.data.shop.id;

  await admin.graphql(
    `
      mutation SaveMetafield(
        $ownerId: ID!,
        $value: String!
      ) {
        metafieldsSet(
          metafields: [
            {
              namespace: "custom"
              key: "store_tags"
              type: "json"
              ownerId: $ownerId
              value: $value
            }
          ]
        ) {
          metafields {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        ownerId: shopId,
        value: JSON.stringify(metafieldJson),
      },
    }
  );

  return {
    success: true,
  };
};


export default function AdditionalPage() {
//   const { markets, plusPlan, metafieldData } = useLoaderData();
//   const [metadata, setMetadata] = useState(metafieldData);
//   const fetcher = useFetcher();
//   const isLoading =
//     ["loading", "submitting"].includes(fetcher.state) &&
//     fetcher.formMethod === "POST";
//   const generateTags = () => fetcher.submit({intents:"metaupdate",metadata:JSON.stringify(metadata)}, { method: "POST" });
//   const revalidator = useRevalidator();
//   console.log(markets)
//   const openModal = (id) => {
//   console.log("openModal called with id:", id);
//   shopify.modal.show(id);
// };

// const closeModal = (id) => {
//   console.log("closeModal called with id:", id);
//   shopify.modal.hide(id);
// };
//   const openmarket = async () => {
//     const activity = await shopify.intents.invoke('create:shopify/Market');
//     const response = await activity.complete;
//     if (response.code === 'ok') {
//       revalidator.revalidate();
//     }
//   }
//   const opencatalog = async () => {
//     const catalogActivity = await shopify.intents.invoke('create:shopify/Catalog');
//     const response = await catalogActivity.complete;
//     if (response.code === 'ok') {

//     }
//   }
//   const editMarket = async (id) => {
//     const marketActivity = await shopify.intents.invoke('edit:shopify/Market', { value: `${id}` })
//     const response = await marketActivity.complete;
//     if (response.code === 'ok') {
//       revalidator.revalidate();
//     }
//   }
//   const editCatalog = async (id) => {
//     const catalogActivity = await shopify.intents.invoke('edit:shopify/Catalog', { value: `${id}` })
//     const response = await catalogActivity.complete;
//     if (response.code === 'ok') {
//       revalidator.revalidate();
//     }
//   }
//   const totalcatalog = markets.map(market => market.catalogsCount.count).reduce((a, b) => a + b, 0)


const { markets, tagMap } = useLoaderData();
const fetcher = useFetcher();
const revalidator = useRevalidator();
const [selectedMarket, setSelectedMarket] = useState("");
const [selectedCatalog, setSelectedCatalog] = useState("");
const [tagValue, setTagValue] = useState("");
const [isEdit, setIsEdit] = useState(false);
const openAddModal = (marketId, catalogId) => {
  setSelectedMarket(marketId);
  setSelectedCatalog(catalogId);
  setTagValue("");
  setIsEdit(false);
  shopify.modal.show("tag-modal");
};
const openEditModal = (
  marketId,
  catalogId,
  existingTag
) => {
  setSelectedMarket(marketId);
  setSelectedCatalog(catalogId);
  setTagValue(existingTag);
  setIsEdit(true);
  shopify.modal.show("tag-modal");
};
const closeTagModal = () => {
  shopify.modal.hide("tag-modal");
  setSelectedMarket("");
  setSelectedCatalog("");
  setTagValue("");
};

const saveTag = () => {
  if (!tagValue?.trim()) {
    shopify.toast.show("Please enter tag");
    return;
  }
  fetcher.submit(
    {
      intent: "saveTag",
      market: selectedMarket,
      catalog: selectedCatalog,
      tag: tagValue.trim(),
    },
    {
      method: "POST",
    }
  );
};

useEffect(() => {
  if (
    fetcher.state === "idle" &&
    fetcher.data?.success
  ) {
    closeTagModal();
    revalidator.revalidate();
    shopify.toast.show(
      isEdit
        ? "Tag updated successfully"
        : "Tag saved successfully"
    );
  }
}, [fetcher.state, fetcher.data]);

const getTagForRow = (
  marketId,
  catalogId
) => {
  return tagMap?.[
    `${marketId}_${catalogId}`
  ];
};

async function rebuildStoreTagsMetafield(
  admin,
  shopId,
  shop
) {
  const allTags =
    await prisma.tagData.findMany({
      where: {
        shop,
      },
    });

  const metafieldJson = {};

  allTags.forEach((row) => {
    metafieldJson[
      `${row.market}_${row.catalog}`
    ] = {
      market: row.market,
      catalog: row.catalog,
      tag: row.tag,
    };
  });

  await admin.graphql(
    `
    mutation SaveMetafield(
      $ownerId: ID!,
      $value: String!
    ) {
      metafieldsSet(
        metafields: [{
          namespace: "custom"
          key: "store_tags"
          type: "json"
          ownerId: $ownerId
          value: $value
        }]
      ) {
        userErrors {
          message
        }
      }
    }
  `,
    {
      variables: {
        ownerId: shopId,
        value: JSON.stringify(
          metafieldJson
        ),
      },
    }
  );
}

const validMarketIds =
  new Set(
    markets.map((m) => m.id)
  );

  const savedTags =
  await prisma.tagData.findMany({
    where: {
      shop,
    },
  });
  const invalidRows =
  savedTags.filter(
    (row) =>
      !validMarketIds.has(
        row.market
      )
  );
  if (invalidRows.length) {
    const validCatalogIds =
  new Set();

markets.forEach((market) => {
  market.catalogs.nodes.forEach(
    (catalog) => {
      validCatalogIds.add(
        catalog.id
      );
    }
  );
});
const invalidCatalogRows =
  savedTags.filter(
    (row) =>
      !validCatalogIds.has(
        row.catalog
      )
  );
  await prisma.tagData.deleteMany({
  where: {
    shop,
    catalog: {
      in:
        invalidCatalogRows.map(
          (x) => x.catalog
        ),
    },
  },
});
await rebuildStoreTagsMetafield(
  admin,
  shopId,
  shop
);
}
const validCatalogIds =
  new Set();

markets.forEach((market) => {
  market.catalogs.nodes.forEach(
    (catalog) => {
      validCatalogIds.add(
        catalog.id
      );
    }
  );
});
const invalidCatalogRows =
  savedTags.filter(
    (row) =>
      !validCatalogIds.has(
        row.catalog
      )
  );

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
                // <s-table-row key={market.id}>
                //   <s-table-cell><s-link onClick={() => editMarket(market.id)}>{market.name}</s-link></s-table-cell>
                //   <s-table-cell>{market.catalogsCount?.count || 0}</s-table-cell>
                //   <s-table-cell>{market.catalogs.nodes.map((catalog, cat_index) => <>
                //     <s-link onClick={() => editCatalog(catalog.id)} key={catalog.id}>{catalog.title}</s-link>{market.catalogs.nodes.length > 1 && cat_index !== (market.catalogs.nodes.length - 1) ? ' , ' : ''}
                //   </>)}</s-table-cell>
                //   <s-table-cell>{market.catalogs.nodes.length ? (
                //     <s-button onClick={() => openModal(market.id)}>Add</s-button>
                //   ) : ('')}</s-table-cell>
                // </s-table-row>
                market.catalogs.nodes.map((catalog) => {
                  const rowData = getTagForRow(market.id, catalog.id);
        return (<s-table-row
  key={`${market.id}_${catalog.id}`}
>
  <s-table-cell>
    <s-link
      onClick={() =>
        editMarket(market.id)
      }
    >
      {market.name}
    </s-link>
  </s-table-cell>

  <s-table-cell>
    {market.catalogsCount?.count || 0}
  </s-table-cell>

  <s-table-cell>
    <s-link
      onClick={() =>
        editCatalog(catalog.id)
      }
    >
      {catalog.title}
    </s-link>
  </s-table-cell>

  <s-table-cell>
    {rowData ? (
      <s-stack
        direction="inline"
        gap="tight"
        alignItems="center"
      >
        <s-text>
          {rowData.tag}
        </s-text>

        <s-button
          variant="tertiary"
          icon="edit"
          onClick={() =>
            openEditModal(
              market.id,
              catalog.id,
              rowData.tag
            )
          }
        >
          Edit
        </s-button>
      </s-stack>
    ) : (
      <s-button
        onClick={() =>
          openAddModal(
            market.id,
            catalog.id
          )
        }
      >
        Add
      </s-button>
    )}
  </s-table-cell>
</s-table-row>)
                })
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>No markets found.</s-paragraph>
        )}



        {/* <Tagcomponent markets={markets}/> */}
        <s-modal
  id="tag-modal"
  heading={
    isEdit
      ? "Edit Customer Tag"
      : "Add Customer Tag"
  }
>
  <s-stack gap="base">
    <s-text-field
      label="Customer Tag"
      value={tagValue}
      onInput={(e) =>
        setTagValue(e.target.value)
      }
    />

    <s-stack
      direction="inline"
      gap="base"
      justifyContent="end"
    >
      <s-button
        variant="secondary"
        onClick={closeTagModal}
      >
        Cancel
      </s-button>

      <s-button
        variant="primary"
        onClick={saveTag}
      >
        {isEdit ? "Update" : "Save"}
      </s-button>
    </s-stack>
  </s-stack>
</s-modal>
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
