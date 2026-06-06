import { test, expect } from "@playwright/test";
import { goPro } from "./helpers";

test("approach gate evaluates and always offers an escape", async ({ page }) => {
  await goPro(page);
  await page.goto("/practice?cat=pr&item=pr-recon-daily-revenue");

  // The think-first gate blocks the diff until an approach is given.
  await expect(page.getByText(/Think first/)).toBeVisible();
  await expect(page.getByRole("button", { name: /extract\.py/ })).toHaveCount(0);

  // Submitting an approach yields a verdict (on_track / getting there / off track).
  await page.locator("textarea").first().fill("Reconcile both directions, compare in cents, check the success gate.");
  await page.getByRole("button", { name: /Lock in approach/ }).click();
  await expect(page.getByText(/On track|Getting there|Off track/)).toBeVisible({ timeout: 20_000 });

  // "Start anyway" is always available and unlocks the diff.
  await page.getByRole("button", { name: /Start anyway/i }).click();
  await expect(page.getByRole("button", { name: /extract\.py/ })).toBeVisible();
});

test("gate is skipped on opt-out items (promptlab flagship)", async ({ page }) => {
  await goPro(page);
  await page.goto("/practice?cat=promptlab&item=pl-ticket-routing");
  await expect(page.getByText(/Think first/)).toHaveCount(0);
});
