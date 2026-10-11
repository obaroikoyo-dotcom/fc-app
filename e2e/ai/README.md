# AI fake users

These are AI "people" that use your app the way a human would: they look at the
screen, decide what to tap, get confused, and write down what they thought.
They are different from the scripted tests in `e2e/`, which only check that
known buttons still work.

## Run them

```
npm run test:ai                      # all personas
npm run test:ai -- new-brand         # just one
npm run test:ai -- new-brand --headed   # watch it happen in a browser window
```

It starts the app locally by itself. The report is written to
`e2e/ai/reports/<date>/ALL.md` (one file per persona too). Open it in VS Code.

## One-time setup

1. Get an Anthropic API key at console.anthropic.com (this is separate from a
   Claude subscription and is paid per use).
2. Add it to `.env.e2e.local` in the project folder:

```
ANTHROPIC_API_KEY=sk-ant-...
```

3. The two signed-in personas also need the test accounts from `e2e/README.md`
   (`E2E_BRAND_EMAIL` and so on). Without them those two are skipped and the
   two logged-out personas still run.

## The personas

Defined in `personas.ts`. Edit them or add your own: each is a name, whether
they start logged in, and a plain-English brief.

| id | who | starts |
| --- | --- | --- |
| `new-brand` | cautious skincare brand owner, first visit | logged out |
| `new-creator` | impatient part-time creator, first visit | logged out |
| `brand-signed-in` | brand owner deciding whether to pay | brand test account |
| `creator-signed-in` | creator wanting to know how they get paid | creator test account |

The logged-out ones go through the sign-up screens with made-up details and
stop before creating an account.

## Cost and limits

- Default model is `claude-opus-5-5`. Change it with `AI_TESTER_MODEL=...` in
  `.env.e2e.local` (for example `claude-sonnet-5-5` for a cheaper run).
- Each persona gets at most 30 steps (`AI_TESTER_MAX_STEPS`).
- A persona run is roughly half a dollar to a dollar and a half. Check your
  usage page after the first run and adjust.
- Check the browser side without spending anything: `AI_TESTER_DRY_RUN=1 npm run test:ai -- new-brand`.

## Safety

- Taps on delete-account, cancel-subscription and log-out buttons are refused.
- Anything that leaves your website is closed.
- They are told to use only fake details and the Stripe test card.
- They act on your live Supabase project (the address is written into the app),
  so use the dedicated test accounts only.

## What they can't tell you

- Whether a person would actually feel good using it. They are a cheap first
  pass that finds broken flows, unclear wording and trust problems. Real
  people still matter before launch.
- They can't upload a video, connect TikTok, or use Stripe's payout form.
