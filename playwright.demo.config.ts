import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;

/**
 * Demo config: a slow, captioned, LOOPING walkthrough of the Production-Incident
 * workbench in a visible Chromium window. Runs until you Ctrl+C.
 *   npm run demo:incident
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "demo-incident.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 0, // looping demo — no per-test timeout
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: false,
    viewport: { width: 1500, height: 900 },
    launchOptions: { slowMo: 700 }, // slow enough to follow every action
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], headless: false } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
