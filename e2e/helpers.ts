import type { Page } from "@playwright/test";

const BASE = "http://localhost:3123";

/** Become Pro/unlimited (demo cookie) so every item opens without the paywall. */
export async function goPro(page: Page) {
  await page.context().addCookies([{ name: "fn_demo", value: "1", url: BASE }]);
}

/** Set the Monaco editor's value directly (typing into Monaco is flaky). */
export async function setMonaco(page: Page, value: string) {
  await page.waitForFunction(() => (window as any).monaco?.editor?.getModels?.().length > 0, null, { timeout: 15_000 });
  await page.evaluate((v) => {
    const models = (window as any).monaco.editor.getModels();
    models[models.length - 1].setValue(v);
  }, value);
}

/** Pass the "think first" approach gate via the always-available "Start anyway". */
export async function passGate(page: Page) {
  const start = page.getByRole("button", { name: /Start anyway/i });
  if (await start.isVisible().catch(() => false)) {
    await start.click();
  }
}
