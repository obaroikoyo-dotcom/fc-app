// LocationIQ's API key (Dashboard -> API Keys). Same pattern as the Supabase
// anon key and Sentry DSN elsewhere in this app: a plain public key meant to
// be used from the browser, not a secret. Once traffic grows, restrict it to
// flipcollab.com in the LocationIQ dashboard, the same way a Google Maps
// browser key is usually locked to a domain.
//
// While this is empty, both location-search fields below fall back to plain
// manual entry - typing still works everywhere, suggestions just don't
// appear until a key is set.
export const LOCATIONIQ_API_KEY = "";
