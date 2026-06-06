import { test, type Page } from "@playwright/test";
import { goPro, setMonaco } from "./helpers";

/**
 * A slow, captioned, LOOPING walkthrough of the Production-Incident workbench in a
 * visible Chromium window — for demos. On-screen controls + keyboard shortcuts:
 *   • Pause/Resume — Space (or the ⏸ button)
 *   • Step (skip the current wait) — → (or ⏭)
 *   • Restart the walkthrough — R (or ⟲)
 * Runs forever; press Ctrl+C in the terminal to stop.
 *   npm run demo:incident
 */

class RestartSignal extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Inject the caption banner + control bar + key handlers (idempotent; survives nav). */
async function ensureChrome(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __demo?: { paused: boolean; step: boolean; restart: boolean } };
    if (!w.__demo) w.__demo = { paused: false, step: false, restart: false };
    if (!document.getElementById("demo-caption")) {
      const c = document.createElement("div");
      c.id = "demo-caption";
      c.style.cssText =
        "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99999;" +
        "background:rgba(12,18,32,.94);color:#fff;padding:13px 22px;border-radius:9999px;" +
        "font:600 17px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 10px 34px rgba(0,0,0,.4);" +
        "max-width:84vw;text-align:center;letter-spacing:.2px;pointer-events:none;";
      document.body.appendChild(c);
    }
    if (!document.getElementById("demo-controls")) {
      const bar = document.createElement("div");
      bar.id = "demo-controls";
      bar.style.cssText =
        "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;gap:8px;" +
        "background:rgba(12,18,32,.94);padding:8px 10px;border-radius:9999px;box-shadow:0 10px 34px rgba(0,0,0,.4);" +
        "font:600 14px system-ui,sans-serif;";
      const mk = (label: string, fn: () => void) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = "background:#1f2940;color:#fff;border:0;border-radius:9999px;padding:8px 14px;cursor:pointer;";
        b.onclick = fn;
        return b;
      };
      const pauseBtn = mk("⏸ Pause", () => {
        w.__demo!.paused = !w.__demo!.paused;
        pauseBtn.textContent = w.__demo!.paused ? "▶ Resume" : "⏸ Pause";
      });
      bar.appendChild(pauseBtn);
      bar.appendChild(mk("⏭ Step", () => { w.__demo!.step = true; }));
      bar.appendChild(mk("⟲ Restart", () => { w.__demo!.restart = true; }));
      const hint = document.createElement("span");
      hint.textContent = "Space · → · R";
      hint.style.cssText = "color:#8aa;align-self:center;padding:0 8px;font-weight:500;";
      bar.appendChild(hint);
      document.body.appendChild(bar);
      window.addEventListener("keydown", (e) => {
        if (e.code === "Space") { e.preventDefault(); w.__demo!.paused = !w.__demo!.paused; pauseBtn.textContent = w.__demo!.paused ? "▶ Resume" : "⏸ Pause"; }
        else if (e.code === "ArrowRight") w.__demo!.step = true;
        else if (e.code === "KeyR") w.__demo!.restart = true;
      });
    }
  });
}

/** Pause-aware wait: holds while paused; "Step" skips the rest; "Restart" aborts the round. */
async function beat(page: Page, ms = 1600) {
  await ensureChrome(page);
  const end = Date.now() + ms;
  for (;;) {
    const s = await page.evaluate(() => {
      const w = window as unknown as { __demo: { paused: boolean; step: boolean; restart: boolean } };
      const v = { ...w.__demo };
      w.__demo.step = false;
      if (v.restart) w.__demo.restart = false;
      return v;
    }).catch(() => ({ paused: false, step: false, restart: false }));
    if (s.restart) throw new RestartSignal();
    if (s.step) return;
    if (!s.paused && Date.now() >= end) return;
    await sleep(s.paused ? 140 : Math.min(140, Math.max(0, end - Date.now())));
  }
}

async function caption(page: Page, text: string, round: number) {
  await ensureChrome(page);
  await page.evaluate(({ t, r }) => {
    const w = window as unknown as { __demo: { paused: boolean } };
    const el = document.getElementById("demo-caption");
    if (el) el.innerHTML = `<span style="opacity:.55;font-weight:700">DEMO · loop ${r}${w.__demo?.paused ? " · ⏸" : ""}</span>&nbsp;&nbsp;${t}`;
  }, { t: text, r: round });
  await beat(page);
}

async function walkthrough(page: Page, round: number) {
  await goPro(page);
  await page.goto("/practice?cat=incident&item=inc-de-prime-day-double-revenue");
  await page.reload();
  await ensureChrome(page);

  await caption(page, "💀 A SEV-1: peak-day revenue is overstated by a third. Let's debug it.", round);
  await beat(page, 1800);

  await caption(page, "🧠 Think first — state an approach before you can touch anything.", round);
  await page.getByPlaceholder(/plan in 1/i).fill(
    "Per-order amounts are right but the total is too high, so the row COUNT is inflated. I'd query order_events for duplicate order_ids on peak day, then read dedup.py to see what key it dedupes on."
  );
  await beat(page, 1200);
  await page.getByRole("button", { name: /Lock in approach/ }).click();
  await page.getByText(/On track|Getting there|Off track/).waitFor({ timeout: 25_000 }).catch(() => {});
  await caption(page, "✅ The AI judged the plan — then unlocks (you can always 'Start anyway').", round);
  await beat(page, 2600);
  const open = page.getByRole("button", { name: /Open the (editor|diff)/ });
  if (await open.isVisible().catch(() => false)) await open.click();
  else await page.getByRole("button", { name: /Start anyway/i }).click();
  await beat(page, 1400);

  await caption(page, "📂 Read the on-call log in the file explorer…", round);
  await page.getByRole("button", { name: "logs/oncall.log" }).click();
  await beat(page, 2400);
  await caption(page, "🐛 …and the suspicious dedup code.", round);
  await page.getByRole("button", { name: "pipeline/dedup.py" }).click();
  await beat(page, 2600);

  await caption(page, "🔎 Investigate: run a real SQL query against the data…", round);
  await setMonaco(page, "SELECT order_id, COUNT(*) AS dupes\nFROM order_events\nWHERE event_day = DATE '2026-05-21'\nGROUP BY order_id\nHAVING COUNT(*) > 1\nORDER BY dupes DESC");
  await beat(page, 1200);
  await page.getByRole("button", { name: /Run query/ }).click();
  await page.getByText(/2002/).waitFor({ timeout: 30_000 }).catch(() => {});
  await caption(page, "🎯 Duplicate order_ids surface (2002×3, 2001×2, 2004×2) — that's the inflation.", round);
  await beat(page, 3200);

  await caption(page, "📝 Jot a note — and watch the 🧭 Steps-taken trail record everything.", round);
  await page.getByRole("button", { name: /Notes/ }).click();
  await page.getByPlaceholder(/Jot findings/).fill("2001/2002/2004 duplicated on peak day. dedup.py keys on event_id (unique) — never dedupes orders.");
  await beat(page, 2600);

  await caption(page, "🧾 Submit the root cause + fix — graded against a hidden post-mortem.", round);
  await page.getByPlaceholder(/Root cause/).fill("At-least-once retries emit duplicate order events; dedup keys on event_id (unique per emission) not order_id, so dupes are summed. Only shows at peak because retry rate scales with load.");
  await page.getByPlaceholder(/^Fix/).fill("Dedup by order_id, make the sink idempotent (MERGE by order_id), backfill the day. Mitigate first by holding the alert.");
  await beat(page, 1400);
  await page.getByRole("button", { name: /Submit diagnosis/ }).click();
  await caption(page, "⚙️ Grading the diagnosis…", round);
  await beat(page, 4500);

  await caption(page, "📖 Reveal the model post-mortem (root cause, fix, triage, red herrings).", round);
  await page.getByRole("button", { name: /Reveal answer/i }).click();
  await page.getByText(/Model post-mortem/i).waitFor({ timeout: 15_000 }).catch(() => {});
  await beat(page, 6500);
  await caption(page, "✨ That's the production-incident workbench. Looping again…", round);
  await beat(page, 3500);
}

test("Production incident — looping captioned demo (Space=pause, →=step, R=restart)", async ({ page }) => {
  test.setTimeout(0); // run until Ctrl+C
  for (let round = 1; ; round++) {
    try {
      await walkthrough(page, round);
    } catch (e) {
      if (!(e instanceof RestartSignal)) {
        // Don't let a transient hiccup kill the kiosk — note it and loop.
        console.log("demo round error (continuing):", (e as Error).message?.slice(0, 120));
        await sleep(800);
      }
    }
  }
});
