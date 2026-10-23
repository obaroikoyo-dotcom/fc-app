// FlipCollab has two looks, light and dark, and light is the default. Every colour in
// the app is a named colour (--c-*, --t-*, --s-*, --b-*, --a-* in index.css) with a dark
// and a light value, and the light values apply when <html> has the class "theme-light".
// (It used to be the dark palette run through a colour filter; that could not show
// strong reds or blues in pictures properly.)
//
// The choice is saved under its own key, "fc_theme" ("light" or "dark").
// The old key ("theme") is deliberately ignored: while dark was the default,
// a saved "normal" there just meant "never switched", and honouring it would
// keep everyone who ever opened Settings stuck on dark. Everyone starts on
// light; only a choice made from now on is remembered.

const THEME_KEY = "fc_theme";

export function isLightTheme(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) !== "dark";
  } catch {
    return true;
  }
}

// Puts the look on the page: the class the light colour values hang off, and the
// colour scheme the browser uses for scroll bars and form controls.
export function applyTheme(light: boolean) {
  document.documentElement.classList.toggle("theme-light", light);
}

export function saveLightTheme(light: boolean) {
  try {
    localStorage.setItem(THEME_KEY, light ? "light" : "dark");
  } catch {
    // storage blocked: the choice just doesn't stick
  }
  applyTheme(light);
}
