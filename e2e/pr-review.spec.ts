import { test, expect } from "@playwright/test";
import { goPro, passGate } from "./helpers";

test("PR review shows a file explorer (tree) that switches files", async ({ page }) => {
  await goPro(page);
  await page.goto("/practice?cat=pr&item=pr-recon-daily-revenue");
  await passGate(page); // PR review is gated; "Start anyway" unlocks without a key

  // File explorer with the changed files grouped under the folder "recon".
  await expect(page.getByRole("button", { name: /extract\.py/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /compare\.py/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /job\.py/ })).toBeVisible();

  // Clicking a file switches the panel content.
  await page.getByRole("button", { name: /compare\.py/ }).click();
  await expect(page.getByText(/def reconcile/)).toBeVisible();
  await page.getByRole("button", { name: /job\.py/ }).click();
  await expect(page.getByText(/def run/)).toBeVisible();

  await expect(page.getByRole("button", { name: /Submit review/ })).toBeVisible();
});
