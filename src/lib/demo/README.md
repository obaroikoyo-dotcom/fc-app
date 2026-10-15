# The demo (flipcollab.com/demo)

A link people can open to try FlipCollab with a made-up profile, no sign-up.

- `/demo` shows a picker (brand or creator).
- `/demo/creator` and `/demo/brand` go straight in.

## How it works

The demo is the normal app, unchanged, running against a fake backend that
lives inside the visitor's browser tab.

- `mode.ts` decides demo mode from the address alone.
- `supabase.ts` (in `src/lib`) hands the app a demo client instead of the real
  one when in demo mode. That client points at an unresolvable host with no
  real key, and every request goes to `engine.ts`. A `fetch` guard also catches
  the few places that call the real project address directly.
- `engine.ts` + `query.ts` answer PostgREST requests (select with embedded
  tables, filters, order, insert/update/delete/upsert) from in-memory tables.
- `rpc.ts` and `functions.ts` re-do the database functions and server
  functions the app calls. Stripe, push, file storage and social posting are
  never contacted: payments are simulated rows, anything else says it is off.
- `seed.ts` builds the world from a random seed (brands, creators, campaigns,
  deals at every stage, chats, notifications). Same visit, same world.
- `automation.ts` plays the other people: chat replies, a brand accepting an
  application, a creator handing in a video, a brand approving it.
- `session.ts` keeps the visit (role, seed, and a saved copy of the data) in
  sessionStorage, so a reload carries on. Closing the tab ends it.
- `realtime.ts` replaces Supabase Realtime (no websockets).
- `DemoInstallSheet` is the big "add to your home screen" ask. It is shown the
  moment any demo link opens (picker and direct links), on phones or where the
  browser offers to install, once per tab. The installed app opens the real
  FlipCollab, not the demo. `DemoNotice` ("this is a demo") shows after the
  splash.

## Rules

- No server changes, no SQL, nothing to deploy beyond the site.
- Nothing from the demo may ever reach the real project. `e2e/demo.spec.ts`
  fails if any request goes to a Supabase address.
- If a page starts using a table, embedded relation, RPC or function the demo
  doesn't know, add it to `query.ts` (RELATIONS), `rpc.ts` or `functions.ts`.
  Unknown ones fail loudly instead of returning wrong data.
- Keep copy plain: no emojis, no em dashes.
