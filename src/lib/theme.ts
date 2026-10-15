// FlipCollab is drawn in a dark palette. The light look is that same palette
// run through a colour filter (invert, turn the hues back, lift to pure white),
// and light is the default; dark is the same screens with the filter off.
//
// The saved value keeps its old name so nobody's choice is lost: "inverted"
// means the light look, "normal" means dark. Nothing saved means light.

// brightness lifts the inverted near-white (#f5f5f5) to a true white page.
export const LIGHT_FILTER = "invert(1) hue-rotate(180deg) brightness(1.045)";
// The exact opposite of the filter above, in reverse order, so that a photo,
// video or a colour that must stay true goes through both and comes out unchanged.
export const UNDO_LIGHT_FILTER = "brightness(0.957) hue-rotate(180deg) invert(1)";

export function isLightTheme(): boolean {
  try {
    return localStorage.getItem("theme") !== "normal";
  } catch {
    return true;
  }
}

export function saveLightTheme(light: boolean) {
  try {
    localStorage.setItem("theme", light ? "inverted" : "normal");
  } catch {
    // storage blocked: the choice just doesn't stick
  }
}
