import { isLightTheme } from "./theme";

// Stripe draws its card box and its payout screens in its own frames, which can't
// read our colour names, so they get plain colours that match the current look.
// The light values are the app's own light values (see the colour block in index.css).

export function cardElementOptions() {
  const light = isLightTheme();
  return {
    hidePostalCode: true,
    style: {
      base: {
        fontSize: "14px",
        color: light ? "#000000" : "#ffffff",
        fontFamily: "'TikTok Sans', sans-serif",
        "::placeholder": { color: light ? "#6b6b6b" : "#999999" },
      },
      invalid: { color: light ? "#e5322d" : "#ff3b30" },
    },
  };
}

export function connectAppearance() {
  const light = isLightTheme();
  return {
    variables: {
      colorPrimary: light ? "#000000" : "#ffffff",
      colorBackground: light ? "#f9f9f9" : "#111111",
      colorText: light ? "#000000" : "#ffffff",
      colorSecondaryText: light ? "#6b6b6b" : "#999999",
      colorBorder: light ? "#efefef" : "#1a1a1a",
      colorDanger: light ? "#e5322d" : "#ff3b30",
      buttonPrimaryColorBackground: light ? "#000000" : "#ffffff",
      buttonPrimaryColorText: light ? "#ffffff" : "#0a0a0a",
      fontFamily: "'TikTok Sans', 'Helvetica Neue', sans-serif",
      borderRadius: "8px",
      spacingUnit: "4px",
    },
  };
}
