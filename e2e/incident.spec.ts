import { test, expect } from "@playwright/test";
import { goPro, passGate, setMonaco } from "./helpers";

const ITEM = "/practice?cat=incident&item=inc-de-prime-day-double-revenue";
const LEAK = ["keyed on event_id", "dedup is keyed on the wrong", "actualRootCause", "redHerrings"];

test("incident: file explorer, SQL investigation, notes persist, no answer-key leak", async ({ page }) => {
  await goPro(page);
  await page.goto(ITEM);
  await passGate(page); // incident is gated; "Start anyway" unlocks

  // Tier badge (💀 Broken) renders for this hellish incident.
  await expect(page.getByText(/Broken/)).toBeVisible();

  // File explorer lists the artifacts and switches the viewer on click.
  await expect(page.getByRole("button", { name: "pipeline/dedup.py" })).toBeVisible();
  await expect(page.getByRole("button", { name: "logs/oncall.log" })).toBeVisible();
  await page.getByRole("button", { name: "logs/oncall.log" }).click();
  await expect(page.getByText(/revenue mismatch/)).toBeVisible();

  // Investigate: run a SQL query in the scratchpad console.
  await setMonaco(page, "SELECT order_id, COUNT(*) c FROM order_events WHERE event_day = DATE '2026-05-21' GROUP BY order_id HAVING COUNT(*) > 1 ORDER BY c DESC");
  await page.getByRole("button", { name: /Run query/ }).click();
  await expect(page.locator("table")).toBeVisible({ timeout: 20_000 });

  // The auto "Steps taken" trail records the investigation (file opens + queries run).
  await expect(page.getByText(/Opened logs\/oncall\.log/)).toBeVisible();
  await expect(page.getByText(/Ran SQL/)).toBeVisible();

  // Notes pad: write, reload, persists (localStorage).
  await page.getByRole("button", { name: /Notes/ }).click();
  const notes = page.getByPlaceholder(/Jot findings/);
  await notes.fill("dupe order_ids: 2001, 2002, 2004 on peak day");
  await page.waitForTimeout(300);
  await page.reload();
  await passGate(page);
  await page.getByRole("button", { name: /Notes/ }).click();
  await expect(page.getByPlaceholder(/Jot findings/)).toHaveValue(/dupe order_ids/);

  // No server-only answer-key text anywhere in the DOM.
  const body = await page.locator("body").innerText();
  for (const s of LEAK) expect(body).not.toContain(s);
});

test("incident: Reveal answer shows the model post-mortem (Pro-gated)", async ({ page }) => {
  await goPro(page);
  await page.goto(ITEM);
  await passGate(page);
  await page.getByRole("button", { name: /Reveal answer/i }).click();
  await expect(page.getByText(/Model post-mortem/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/## Root cause/)).toBeVisible();
  await expect(page.getByText(/## Fix/)).toBeVisible();
});

test("incident: answer key never appears in any network response", async ({ page }) => {
  await goPro(page);
  const bad: string[] = [];
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] ?? "";
    if (/json|javascript|text|html/.test(ct)) {
      const body = await res.text().catch(() => "");
      for (const s of LEAK) if (body.includes(s)) bad.push(`${s} @ ${res.url()}`);
    }
  });
  await page.goto(ITEM);
  await passGate(page);
  await page.waitForTimeout(800);
  expect(bad).toEqual([]);
});
