import { loadStripe } from "@stripe/stripe-js";

const STRIPE_PUBLIC_KEY = "pk_test_51Sq7IJPnrgzNkKOXz2ArNbCZsR08JzDCLLRTJAPikyixpxkGUyLPecoQJtNVrgwiXGhbAtp8JJZBwlwfUIBZHbct00PXVDX24j";

// We wrap the initialization safely. 
// If loadStripe fails or isn't installed, it won't take down your entire React app.
export const stripePromise = (() => {
  try {
    return loadStripe(STRIPE_PUBLIC_KEY);
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
    return Promise.resolve(null);
  }
})();