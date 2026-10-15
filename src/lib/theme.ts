// FlipCollab is drawn in a dark palette. The light look is that same palette
// run through a colour filter (invert, turn the hues back, lift to pure white),
// and light is the default; dark is the same screens with the filter off.
//
// The choice is saved under its own key, "fc_theme" ("light" or "dark").
// The old key ("theme") is deliberately ignored: while dark was the default,
// a saved "normal" there just meant "never switched", and honouring it would
// keep everyone who ever opened Settings stuck on dark. Everyone starts on
// light; only a choice made from now on is remembered.

// brightness lifts the inverted near-white (#f5f5f5) to a true white page.
export const LIGHT_FILTER = "invert(1) hue-rotate(180deg) brightness(1.045)";
// The exact opposite of the filter above, in reverse order, so that a photo,
// video or a colour that must stay true goes through both and comes out unchanged.
export const UNDO_LIGHT_FILTER = "brightness(0.957) hue-rotate(180deg) invert(1)";

const THEME_KEY = "fc_theme";

export function isLightTheme(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) !== "dark";
  } catch {
    return true;
  }
}

export function saveLightTheme(light: boolean) {
  try {
    localStorage.setItem(THEME_KEY, light ? "light" : "dark");
  } catch {
    // storage blocked: the choice just doesn't stick
  }
}
