import "@shopify/ui-extensions/preact";
import {render} from 'preact';
import { useState } from 'preact/hooks';

const METAFIELD_NAMESPACE = 'b2b_pricing';
const METAFIELD_KEY = 'custom_price';
const METAFIELD_TYPE = 'number_decimal';

export default async () => {
  const productId = shopify?.data?.selected?.[0]?.id;
  const product = await getProduct(productId);
  render(<Extension product={product}/>, document.body);
}

/**
 * 
 * @param {*} query 
 * @param {*} variables 
 * @returns 
 */
async function adminGraphql(query, variables) {
  const res = await fetch("shopify:admin/api/graphql.json", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Network error: ${res.status}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '));
  }
  return json.data;
}


/**
 * 
 * @param {string} id
 */
async function getProduct(id){
  const res = await fetch('shopify:admin/api/graphql.json',{
    method: 'POST',
    body: JSON.stringify({
      query: `
        query GetProduct($id: ID!) {
            product(id: $id) {
              title
              variants(first:2){
                nodes{
                  media(first:1){
                    nodes{
                      preview{
                        image{
                          url
                        }
                      }
                    }
                  }
                  title
                  id
                  selectedOptions{
                    name
                    value
                  }
                  price
                  compareAtPrice
                  metafield(namespace:"b2b_pricing",key:"custom_price"){
                    value
                  }
                }
                pageInfo{
                  endCursor
                  hasNextPage
                  hasPreviousPage
                  startCursor
                }
              }
            }
        }
      `,
      variables: {id}
    })
  });
  const {data} = await res.json();
  return data.product;
}

/**
 * 
 * @param {*} props
 */

function Extension({product}) {
  const {i18n, data, extension: {target}} = shopify;
  console.log({data},{product});
  const [price, setPrice] = useState((product?.variants.nodes[0]?.metafield?.value) ? product.variants.nodes[0].metafield.value : '');
  const [loading, setLoading] = useState(false);
  const saveVariantPrice = async () => {
    const metafields = [{
          ownerId: product.variants.nodes[0].id,
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
          type: METAFIELD_TYPE,
          value: price,
        }];
        setLoading(true);
    try{
      const result = await adminGraphql(
          `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { id key value }
              userErrors { field message code }
            }
          }`,
          { metafields }
        );
      const userErrors = result.metafieldsSet.userErrors;
      if (userErrors?.length) {
        throw new Error(userErrors.map(e => e.message).join('; '));
      }
    } catch (err){
      console.error(err);
      console.log('price failed to save. Nothing was closed — please retry.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <s-admin-block heading="B2B (Wholesale Pricing) Extension">
      <s-stack direction="block">
        <s-text type="strong">{i18n.translate('first_variant_heading')}</s-text>
        {/* {product?.variants?.nodes?.length  && product.variants.nodes.map(variant => <Variant variant={variant}/>)} */}
        <Variant variant={product.variants.nodes[0]} price={price} setPrice={setPrice}/>
        <s-grid gap="base" justifyContent="end" padding="base base none base" gridTemplateColumns="auto auto">
          {product.variants.nodes.length > 1 && <s-button variant="secondary" href={`extension:${"wholesale-pricing-action"}/${"admin.product-details.action.render"}`}>Set All Variants B2B Prices </s-button>}
        <s-button onClick={saveVariantPrice} loading={loading}>Save Price</s-button>
        </s-grid>
      </s-stack>
    </s-admin-block>
  );
}
/**
 * 
 * @param {*} props 
 * @returns 
 */
function Variant({variant, price, setPrice}){
  const imageSrc =
    variant?.media?.nodes?.length && variant.media.nodes[0].preview?.image?.url
      ? variant.media.nodes[0].preview.image.url
      : undefined;
  function extractDigits(rawValue) {
    if (!rawValue) {
      setPrice('');
      return;
    }
    const cleaned = String(rawValue).replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 1
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : parts[0];
    setPrice(normalized);
  }

  return(
    <>
    <s-grid padding="base none" gridTemplateColumns="auto auto 1fr" gap="base">
      <s-thumbnail
        alt="Image of white sneakers"
        {...(imageSrc ? { src: imageSrc } : {})}
        size="large"
      ></s-thumbnail>
      <s-grid gap="none" justifyItems="safe center">
        <s-grid-item blockSize="auto">{variant.title}</s-grid-item>
        {variant.selectedOptions.map(option => {
          return<>
            <s-grid-item blockSize="0">{option.name}: {option.value}</s-grid-item>
          </>
        })}
      </s-grid>
        <s-box>
          <s-money-field
            label="B2B Customer Price"
            placeholder="0.00"
            min="0.01"
            value={price}
            onInput={(e) => extractDigits(e.target.value)}
            onBlur={(e) => extractDigits(e.target.value)}
            details="Blank value will be Treated as Default Price for B2B Customers"
          ></s-money-field>
        </s-box>
    </s-grid>
    </>
  )
}