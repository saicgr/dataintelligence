import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;

/**
 * E2E suite for the practice workbenches. Boots `next start` (uses the existing
 * .next build) and runs Chromium against it. Tests target the scripted (no-GEMINI)
 * fallbacks so they're deterministic without an API key; AI-only assertions are
 * skipped when GEMINI_API_KEY is unset. Run: `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/demo-incident.spec.ts", // the looping demo runs via playwright.demo.config.ts
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on", // full step trace in the report (great for showing off)
    screenshot: "on", // capture a screenshot per test
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
