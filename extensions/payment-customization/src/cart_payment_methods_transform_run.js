// @ts-check

// Use JSDoc annotations for type safety
/**
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunInput} CartPaymentMethodsTransformRunInput
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunResult} CartPaymentMethodsTransformRunResult
 */

/**
 * @type {CartPaymentMethodsTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

// The configured entrypoint for the 'cart.payment-methods.transform.run' extension target
/**
 * @param {CartPaymentMethodsTransformRunInput} input 
 * @returns {CartPaymentMethodsTransformRunResult}
 */
export function cartPaymentMethodsTransformRun(input) {
  // Get the cart total from the function input, and return early if it's below 100
  const cartTotal = parseFloat(input.cart.cost.totalAmount.amount ?? "0.0");

  // Find the payment method to hide
  const hidePaymentMethod = input.paymentMethods
    .find(method => method.name.includes("Cash on Delivery"));

  if (!hidePaymentMethod) {
    return NO_CHANGES;
  }
  const metaField = JSON.parse(input.paymentCustomization.metafield?.value || "{}");
  const hasRestrictedArea = input.cart.deliveryGroups.some(group => group.deliveryAddress?.city?.toLowerCase() === metaField.city?.toLowerCase());
  if (hasRestrictedArea) {
    return {
      operations: [{
        paymentMethodHide: {
          paymentMethodId: hidePaymentMethod.id
        }
      }]
    };
  }
  if (cartTotal < 1000) {
    return NO_CHANGES;
  }
  return {
    operations: [{
      paymentMethodHide: {
        paymentMethodId: hidePaymentMethod.id
      }
    }]
  };
};