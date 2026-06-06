import { test, expect } from "@playwright/test";
import { goPro } from "./helpers";

test("promptlab grid shows inputs + AI output + verdict, and never the expected labels", async ({ page }) => {
  await goPro(page);
  await page.goto("/practice?cat=promptlab&item=pl-ticket-routing");

  // Grid headers: #, message, AI output, ✓ — no expected/label/answer column.
  const headers = await page.locator("table thead th").allInnerTexts();
  expect(headers.map((h) => h.trim())).toEqual(["#", "message", "AI output", "✓"]);
  expect(headers.join(" ").toLowerCase()).not.toMatch(/expected|label|answer/);

  // Accuracy meter targets the goal.
  await expect(page.getByText(/\/ 88%/)).toBeVisible();

  // The hidden labels for this item must not be present in the rendered DOM.
  const body = (await page.locator("body").innerText()).toLowerCase();
  // (the input messages are visible; the label TOKENS as a column are not — assert no label column cell)
  const cellTexts = await page.locator("table tbody td").allInnerTexts();
  // The 4th column is "AI output" (empty before a run) and 5th is the verdict dot — neither equals a bare label.
  expect(cellTexts.some((t) => t.trim() === "track_order")).toBeFalsy();
  expect(body).toContain("charged twice"); // an input cell IS visible (sanity)
});
