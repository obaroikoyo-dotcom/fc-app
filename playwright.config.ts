import { defineConfig } from "@playwright/test";

// Fake-user tests. By default they start the app locally (npm run dev) and use
// the Edge browser that's already on this machine, so there's nothing extra to
// download. Point them at a deployed copy instead with E2E_BASE_URL, for
// example E2E_BASE_URL=https://your-preview-url npx playwright test.
// Test account details live in .env.e2e.local (never committed).
try { process.loadEnvFile(".env.e2e.local"); } catch { /* no file yet */ }

const baseURL = process.env.E2E_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One at a time: the signed-in tests share two real accounts.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel: "msedge",
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev -- --port 5173", url: baseURL, reuseExistingServer: true, timeout: 60_000 },
});
