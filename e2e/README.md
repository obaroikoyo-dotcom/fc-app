# Fake-user tests

These open the real app in a browser and act like users. Run them after every
change to catch things you broke without noticing.

## Run them

```
npm run test:e2e          # all of them
npm run test:e2e:ui       # pick tests and watch them run
npx playwright show-report   # open the report after a run
```

The first three tests (`smoke.spec.ts`) need nothing. They start the app
locally, load the landing page, open the login screen and check a wrong
password is refused.

## The two test accounts

The app talks to your live Supabase project (the address is written into
`src/lib/supabase.ts`), so the tests sign in as real accounts there. Make two
accounts used for nothing else, one Brand and one Creator:

- Sign up each one in the app, confirm the email, finish onboarding.
- Creator: set up payouts with Stripe's test values (sort code 10-88-00,
  account 00012345, date of birth 01/01/1901).
- Brand: add a test card (4242 4242 4242 4242).

Then create a file called `.env.e2e.local` in the project folder (it is never
committed):

```
E2E_BRAND_EMAIL=...
E2E_BRAND_PASSWORD=...
E2E_CREATOR_EMAIL=...
E2E_CREATOR_PASSWORD=...
```

That switches on `signed-in.spec.ts`, which logs each account in and clicks
around.

## The money test (`review-and-release.spec.ts`)

It checks the moment that matters: the brand is asked "Are you happy with the
content?", taps Yes, and the creator sees "Payout released". It uses up one
deal, so it only runs when you ask:

```
E2E_RUN_RELEASE=1 npx playwright test review-and-release
```

Add these two lines to `.env.e2e.local` first (the names as they appear in the
chat list):

```
E2E_BRAND_NAME=...
E2E_CREATOR_NAME=...
```

Before every run, set up one deal by hand in test mode:

1. Brand posts a campaign. Creator applies. Brand accepts.
2. Brand pays with the 4242 test card.
3. Creator uploads a short video in the chat.

Leave it there and run the test.

## Things the tests can't do

- Connect TikTok, Instagram or YouTube (needs a real login on their side).
- Click through Stripe's own payout setup form.
- Tell you whether a screen is confusing. That needs real people.
