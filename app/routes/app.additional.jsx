import { authenticate } from "../shopify.server";
import { useLoaderData, useRevalidator, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import prisma from "../db.server";

// ---------------------------------------------------------------------------
// Server-only helpers (NOT part of the component — these run in loader/action)
// ---------------------------------------------------------------------------

async function getShopId(admin) {
  const shopRes = await admin.graphql(`
    #graphql
    query {
      shop {
        id
      }
    }
  `);
  const shopData = await shopRes.json();
  return shopData.data.shop.id;
}

// Rebuilds the `custom.store_tags` shop metafield from whatever is currently
// in the tagData table for this shop. Keyed by `${market}_${catalog}` so two
// catalogs in the same market don't clobber each other.
async function rebuildStoreTagsMetafield(admin, shopId, shop) {
  const allTags = await prisma.tagData.findMany({
    where: { shop },
  });

  const metafieldJson = {};
  allTags.forEach((row) => {
    metafieldJson[`${row.market}_${row.catalog}`] = {
      market: row.market,
      catalog: row.catalog,
      tag: row.tag,
    };
  });

  await admin.graphql(
    `
      #graphql
      mutation SaveMetafield($ownerId: ID!, $value: String!) {
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
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const marketRes = await admin.graphql(`
    #graphql
    query Markets {
      markets(first: 250, query: "market_type:COMPANY_LOCATION") {
        nodes {
          id
          name
          catalogsCount {
            count
          }
          catalogs(first: 250) {
            nodes {
              id
              title
            }
          }
        }
      }
    }
  `);

  const planRes = await admin.graphql(`
    #graphql
    query ShopPlan {
      shop {
        plan {
          partnerDevelopment
          publicDisplayName
          shopifyPlus
        }
      }
    }
  `);

  const metaRes = await admin.graphql(`
    #graphql
    query {
      shop {
        id
        metafield(namespace: "custom", key: "store_tags") {
          jsonValue
        }
      }
    }
  `);

  const marketData = await marketRes.json();
  const planData = await planRes.json();
  const metafieldData = await metaRes.json();

  if (!marketData?.data?.markets?.nodes || !planData?.data?.shop?.plan) {
    return {
      error:
        marketData?.data?.markets?.userErrors ||
        marketData?.errors ||
        "Unknown Error Market",
      errorplan:
        planData?.data?.shop?.userErrors ||
        planData?.errors ||
        "Unknown Error Plan",
      markets: [],
      tagMap: {},
      plusPlan: false,
      metafield: {},
      shop,
    };
  }

  const markets = marketData.data.markets.nodes;
  const plusPlan = planData.data.shop.plan.shopifyPlus;

  // ---- Clean up saved tags whose market/catalog no longer exists ----------
  const savedTags = await prisma.tagData.findMany({ where: { shop } });

  const validMarketIds = new Set(markets.map((m) => m.id));
  const validCatalogIds = new Set();
  markets.forEach((market) => {
    market.catalogs.nodes.forEach((catalog) => {
      validCatalogIds.add(catalog.id);
    });
  });

  const invalidRows = savedTags.filter(
    (row) =>
      !validMarketIds.has(row.market) || !validCatalogIds.has(row.catalog)
  );

  let currentTags = savedTags;

  if (invalidRows.length) {
    await prisma.tagData.deleteMany({
      where: {
        shop,
        OR: invalidRows.map((row) => ({
          market: row.market,
          catalog: row.catalog,
        })),
      },
    });

    const shopId = await getShopId(admin);
    await rebuildStoreTagsMetafield(admin, shopId, shop);

    currentTags = await prisma.tagData.findMany({ where: { shop } });
  }

  const tagMap = {};
  currentTags.forEach((row) => {
    tagMap[`${row.market}_${row.catalog}`] = {
      tag: row.tag,
      market: row.market,
      catalog: row.catalog,
    };
  });

  return {
    markets,
    tagMap,
    plusPlan,
    metafield: metafieldData?.data?.shop?.metafield?.jsonValue || {},
    shop,
  };
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

// export const action = async ({ request }) => {
//   const { admin, session } = await authenticate.admin(request);
//   const shop = session.shop;

//   const formData = await request.formData();
//   const intent = formData.get("intent");

//   if (intent !== "saveTag") {
//     return { success: false };
//   }

//   const market = formData.get("market");
//   const catalog = formData.get("catalog");
//   const tag = formData.get("tag");

//   await prisma.tagData.upsert({
//     where: {
//       shop_market_catalog: {
//         shop,
//         market,
//         catalog,
//       },
//     },
//     update: { tag },
//     create: { shop, market, catalog, tag },
//   });

//   const shopId = await getShopId(admin);
//   await rebuildStoreTagsMetafield(admin, shopId, shop);

//   return { success: true };
// };
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "saveTag") {
    return { success: false };
  }

  const market = formData.get("market");
  const catalog = formData.get("catalog");
  const tag = formData.get("tag")?.trim();

  // Read all existing rows for this shop
  let rows = await prisma.tagData.findMany({
    where: { shop },
  });

  // Remove any row for this market/catalog
  rows = rows.filter(
    (row) => !(row.market === market && row.catalog === catalog)
  );

  // Remove any row that already uses this tag
  rows = rows.filter((row) => row.tag !== tag);

  // Add the latest row
  rows.push({
    shop,
    market,
    catalog,
    tag,
  });

  // Replace all rows for this shop
  await prisma.$transaction(async (tx) => {
    await tx.tagData.deleteMany({
      where: {
        shop,
      },
    });

    if (rows.length) {
      await tx.tagData.createMany({
        data: rows.map((row) => ({
          shop: row.shop,
          market: row.market,
          catalog: row.catalog,
          tag: row.tag,
        })),
      });
    }
  });

  const shopId = await getShopId(admin);

  await rebuildStoreTagsMetafield(admin, shopId, shop);

  return {
    success: true,
  };
};

// ---------------------------------------------------------------------------
// Component (client-side only — no prisma / admin.graphql calls in here)
// ---------------------------------------------------------------------------

export default function AdditionalPage() {
  const { markets, tagMap, plusPlan } = useLoaderData();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  const [selectedMarket, setSelectedMarket] = useState("");
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [isEdit, setIsEdit] = useState(false);

  const isSaving =
    fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveTag";

  const totalcatalog = markets
    .map((market) => market.catalogsCount?.count || 0)
    .reduce((a, b) => a + b, 0);

  const openAddModal = (marketId, catalogId) => {
    setSelectedMarket(marketId);
    setSelectedCatalog(catalogId);
    setTagValue("");
    setIsEdit(false);
    shopify.modal.show("tag-modal");
  };

  const openEditModal = (marketId, catalogId, existingTag) => {
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
      { method: "POST" }
    );
  };

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      closeTagModal();
      revalidator.revalidate();
      shopify.toast.show(
        isEdit ? "Tag updated successfully" : "Tag saved successfully"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  const getTagForRow = (marketId, catalogId) =>
    tagMap?.[`${marketId}_${catalogId}`];

  // ---- App Bridge intents (client-side, so they belong in the component) --
  const openmarket = async () => {
    const activity = await shopify.intents.invoke("create:shopify/Market");
    const response = await activity.complete;
    if (response.code === "ok") {
      revalidator.revalidate();
    }
  };

  const opencatalog = async () => {
    const catalogActivity = await shopify.intents.invoke(
      "create:shopify/Catalog"
    );
    const response = await catalogActivity.complete;
    if (response.code === "ok") {
      revalidator.revalidate();
    }
  };

  const editMarket = async (id) => {
    const marketActivity = await shopify.intents.invoke(
      "edit:shopify/Market",
      { value: `${id}` }
    );
    const response = await marketActivity.complete;
    if (response.code === "ok") {
      revalidator.revalidate();
    }
  };

  const editCatalog = async (id) => {
    const catalogActivity = await shopify.intents.invoke(
      "edit:shopify/Catalog",
      { value: `${id}` }
    );
    const response = await catalogActivity.complete;
    if (response.code === "ok") {
      revalidator.revalidate();
    }
  };

  // Flatten markets -> one row per (market, catalog) pair.
  const rows = markets.flatMap((market) =>
    market.catalogs.nodes.map((catalog) => ({ market, catalog }))
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
          To create your own page and have it show up in the app navigation,
          add a page inside <code>app/routes</code>, and a link to it in the{" "}
          <code>&lt;ui-nav-menu&gt;</code> component found in{" "}
          <code>app/routes/app.jsx</code>.
        </s-paragraph>
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

      <s-section
        heading={"Company Location Markets (" + markets.length + ")"}
      >
        {!plusPlan && (
          <s-grid
            paddingBlockEnd="base"
            gridTemplateColumns="auto auto"
            justifyContent="space-between"
            alignItems="center"
          >
            <s-grid-item>
              <s-button onClick={openmarket} icon="markets">
                Create Market
              </s-button>
              <s-paragraph>
                <s-text>Max Catalog Usage Limit: 3</s-text>
              </s-paragraph>
            </s-grid-item>
            <s-grid-item>
              <s-grid justifyContent="end">
                <s-button
                  onClick={opencatalog}
                  icon="catalog-product"
                  disabled={plusPlan ? false : true}
                >
                  Create Catalog
                </s-button>
              </s-grid>
              <s-paragraph>
                <s-text tone="neutral">
                  Catalog Used{" "}
                  {plusPlan ? totalcatalog : `${totalcatalog} out of 3`}
                </s-text>
              </s-paragraph>
            </s-grid-item>
          </s-grid>
        )}

        {rows.length > 0 ? (
          <s-table>
            <s-table-header-row>
              <s-table-header>Market Name</s-table-header>
              <s-table-header>
                <s-stack inlineSize="100px" justifyContent="center">
                  Catalogs Attached to Market
                </s-stack>
              </s-table-header>
              <s-table-header>Catalog Name</s-table-header>
              <s-table-header>Customer Tag</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map(({ market, catalog }) => {
                const rowData = getTagForRow(market.id, catalog.id);
                return (
                  <s-table-row key={`${market.id}_${catalog.id}`}>
                    <s-table-cell>
                      <s-link onClick={() => editMarket(market.id)}>
                        {market.name}
                      </s-link>
                    </s-table-cell>

                    <s-table-cell>
                      {market.catalogsCount?.count || 0}
                    </s-table-cell>

                    <s-table-cell>
                      <s-link onClick={() => editCatalog(catalog.id)}>
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
                          <s-text>{rowData.tag}</s-text>
                          <s-button
                            variant="tertiary"
                            icon="edit"
                            onClick={() =>
                              openEditModal(market.id, catalog.id, rowData.tag)
                            }
                          >
                            Edit
                          </s-button>
                        </s-stack>
                      ) : (
                        <s-button
                          onClick={() => openAddModal(market.id, catalog.id)}
                        >
                          Add
                        </s-button>
                      )}
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>No markets found.</s-paragraph>
        )}

        <s-modal
          id="tag-modal"
          heading={isEdit ? "Edit Customer Tag" : "Add Customer Tag"}
        >
          <s-stack gap="base">
            <s-text-field
              label="Customer Tag"
              value={tagValue}
              onInput={(e) => setTagValue(e.target.value)}
            />

            <s-stack direction="inline" gap="base" justifyContent="end">
              <s-button variant="secondary" onClick={closeTagModal}>
                Cancel
              </s-button>

              <s-button
                variant="primary"
                onClick={saveTag}
                loading={isSaving}
              >
                {isSaving ? "Saving..." : isEdit ? "Update" : "Save"}
              </s-button>
            </s-stack>
          </s-stack>
        </s-modal>
      </s-section>
    </s-page>
  );
}