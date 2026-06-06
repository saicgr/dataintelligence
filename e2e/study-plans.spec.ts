import { test, expect } from "@playwright/test";
import { goPro } from "./helpers";

test("study-plans index lists headliners + incident track", async ({ page }) => {
  await goPro(page);
  await page.goto("/practice/plans");
  await expect(page.getByRole("link", { name: /SQL 50/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /AI 50/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /On-call: every incident/ })).toBeVisible();
  await expect(page.getByText(/Hell week/)).toBeVisible();
});

test("a plan checklist deep-links into the practice workbench", async ({ page }) => {
  await goPro(page);
  await page.goto("/practice/plans/incident-oncall");
  const links = page.locator('a[href*="/practice?cat="]');
  await expect(links.first()).toBeVisible();
  const href = await links.first().getAttribute("href");
  expect(href).toMatch(/\/practice\?cat=incident&item=inc-/);
});
