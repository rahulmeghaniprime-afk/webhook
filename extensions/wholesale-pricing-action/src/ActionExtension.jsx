import "@shopify/ui-extensions/preact";
import { render } from 'preact';
import { useEffect, useState, useCallback } from 'preact/hooks';

// Where the price is written. Change to match your app's metafield definition.
const METAFIELD_NAMESPACE = 'b2b_pricing';
const METAFIELD_KEY = 'custom_price';
const METAFIELD_TYPE = 'number_decimal'; // use 'money' if you defined it that way

// metafieldsSet allows a max of 25 metafields per call (Shopify hard limit).
const METAFIELDS_BATCH_SIZE = 25;

export default async () => {
  render(<Extension />, document.body);
}

const VARIANTS_QUERY = `query Product($id: ID!, $first: Int, $last: Int, $after: String, $before: String) {
  product(id: $id) {
    title
    variants(first: $first, last: $last, after: $after, before: $before) {
      nodes {
        media(first: 1) {
          nodes {
            preview { image { url } }
          }
        }
        title
        id
        selectedOptions { name value }
        price
        compareAtPrice
        metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
          value
        }
      }
      pageInfo { endCursor hasNextPage hasPreviousPage startCursor }
    }
  }
}`;

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

function Extension() {
  const { close, data } = shopify;
  const productId = data.selected[0].id;

  const [product, setProduct] = useState({});
  const [pageInfo, setPageInfo] = useState({});
  const [indexCounter, setIndexCounter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Single source of truth for anything the merchant has typed, keyed by
  // variant id. This survives pagination because it lives on the parent,
  // not inside each Variant row (which unmounts/remounts on page change).
  const [editedValues, setEditedValues] = useState({});
  // Only variant ids the merchant actually typed into — prefilled/saved
  // values are NOT marked touched, so Save only writes what changed.
  const [touchedIds, setTouchedIds] = useState({});

  const fetchPage = useCallback(async ({ after, before } = {}) => {
    setLoading(true);
    try {
      const variables = after
        ? { id: productId, first: 250, after }
        : before
          ? { id: productId, last: 250, before }
          : { id: productId, first: 250 };
      const result = await adminGraphql(VARIANTS_QUERY, variables);
      setProduct(result.product);
      setPageInfo(result.product.variants.pageInfo);

      // Prefill from the saved metafield, but only for variants we haven't
      // already touched this session — never clobber an in-progress edit.
      const nodes = result.product.variants.nodes ?? [];
      setEditedValues(prev => {
        let changed = false;
        const next = { ...prev };
        for (const v of nodes) {
          const saved = v.metafield?.value;
          if (saved != null && !(v.id in next)) {
            next[v.id] = saved;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } catch (err) {
      console.error(err);
      setSaveError('Failed to load variants. Try again.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchPage();
    setIndexCounter(0);
  }, [fetchPage]);

  const nextPage = async () => {
    await fetchPage({ after: pageInfo.endCursor });
    setIndexCounter(c => c + 1);
  };

  const previousPage = async () => {
    await fetchPage({ before: pageInfo.startCursor });
    setIndexCounter(c => c - 1);
  };

  const handleValueChange = useCallback((variantId, value) => {
    setEditedValues(prev => {
      const next = { ...prev };
      if (value === '' || value == null) {
        delete next[variantId];
      } else {
        next[variantId] = value;
      }
      return next;
    });
    setTouchedIds(prev => (prev[variantId] ? prev : { ...prev, [variantId]: true }));
  }, []);

  const syncPricesToMetafields = async () => {
    const entries = Object.entries(editedValues).filter(
      ([variantId, v]) => touchedIds[variantId] && v !== ''
    );
    if (entries.length === 0) return;

    setSaving(true);
    setSaveError('');
    try {
      for (let i = 0; i < entries.length; i += METAFIELDS_BATCH_SIZE) {
        const batch = entries.slice(i, i + METAFIELDS_BATCH_SIZE);
        const metafields = batch.map(([variantId, price]) => ({
          ownerId: variantId,
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
          type: METAFIELD_TYPE,
          value: price,
        }));

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
      }
      close();
    } catch (err) {
      console.error(err);
      setSaveError('Some prices failed to save. Nothing was closed — please retry.');
    } finally {
      setSaving(false);
    }
  };

  const indexOffset = 250 * indexCounter;
  const variants = product?.variants?.nodes ?? [];

  return (
    <s-admin-action>
      <s-box maxBlockSize="500px">
        {(loading || saving) && (
          <s-grid justifyContent="center" padding="base">
            <s-spinner accessibilityLabel="Loading" size="large-100"></s-spinner>
          </s-grid>
        )}

        {saveError && (
          <s-banner tone="critical">{saveError}</s-banner>
        )}

        <s-grid
          padding="none none base none"
          direction="block"
          gap="base"
          maxBlockSize="360px"
          gridTemplateColumns="1fr 1fr"
          border="none"
        >
          {variants.map((variant, v_index) => (
            <Variant
              key={variant.id}
              variant={variant}
              index={indexOffset + v_index + 1}
              value={editedValues[variant.id] ?? ''}
              onValueChange={handleValueChange}
            />
          ))}

          {(pageInfo?.hasNextPage || pageInfo?.hasPreviousPage) && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', gridColumn: 'span 2/2' }}>
              <s-grid justifyContent="end" maxInlineSize="100%">
                <s-button icon="caret-left" disabled={!pageInfo?.hasPreviousPage} onClick={previousPage}></s-button>
              </s-grid>
              <s-grid justifyContent="start" maxInlineSize="100%">
                <s-button icon="caret-right" disabled={!pageInfo?.hasNextPage} onClick={nextPage}></s-button>
              </s-grid>
            </div>
          )}
        </s-grid>
      </s-box>

      <s-button slot="primary-action" disabled={saving} loading={saving} onClick={syncPricesToMetafields}>
        Save
      </s-button>
      <s-button slot="secondary-actions" disabled={saving} onClick={() => close()}>
        Close
      </s-button>
    </s-admin-action>
  );
}

function Variant({ variant, index, value, onValueChange }) {
  function extractDigits(rawValue) {
    if (!rawValue) {
      onValueChange(variant.id, '');
      return;
    }
    const cleaned = String(rawValue).replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 1
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : parts[0];
    onValueChange(variant.id, normalized);
  }

  return (
    <s-stack maxInlineSize="100%" border="none">
      <s-box padding="none none small-300 none" border="none">
        {index}. {variant.title}
      </s-box>
      <s-money-field
        placeholder="0.00"
        min="0.01"
        name={variant.id}
        value={value}
        labelAccessibilityVisibility="visible"
        onInput={(e) => extractDigits(e.target.value)}
        onBlur={(e) => extractDigits(e.target.value)}
      ></s-money-field>
    </s-stack>
  );
}