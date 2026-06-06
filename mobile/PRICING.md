# FieldNotes Mobile — Pricing (single source of truth)

> This is the **canonical** mobile pricing doc. Anything about mobile prices, SKUs, or the
> paywall lives here. Other docs (`SETUP.md`, `../mockups/mobile-build-plan.md`, `../PRODUCT.md`)
> point here — do not restate prices in them.

## The model

**Free core · Pro subscription · Lifetime escape hatch.**

| Tier | Price | What you get |
|---|---|---|
| **Free** | $0 | Browse every track, read every answer, spaced review, **15 new cards/day**, "explain it out loud" scenarios, streak, fully offline. A *taste* of the weekly fresh stream (the daily fresh trickle + a short preview). **This is the funnel.** |
| **Pro — Monthly** | **$4.99/mo** | Everything below, billed monthly, cancel anytime. |
| **Pro — Yearly** | **$29.99/yr** (~$2.50/mo, *Save 50%*) | The default. The weekly **"stay current" fresh stream** (full), **unlimited** new cards/day, **weak-spot & adaptive scheduling**, JD analyzer. |
| **Pro — Lifetime** | **$59.99** (anchor $99.99) | The same Pro, **bought once**, for people who refuse subscriptions. Priced ≈ 2 years of yearly so it still covers expected tenure. |

Pro is granted by owning **any** Pro SKU — a live subscription *or* the lifetime unlock.

## Why subscription (and why it took weekly content to justify it)

The decider is **match revenue cadence to cost cadence.**

- The evergreen deck is *finite* — a one-time-shaped, sprint product. Interview prep churns the day
  people get hired, so a subscription on a static deck is dishonest and would bleed churn.
- But the **weekly fresh drops are a stream** (manual authoring + the content agent, every week,
  forever). That is an *ongoing cost*. Funding ongoing cost with a one-time payment loses money on
  every loyal user. Recurring cost must be funded by recurring revenue → **subscription.**
- Weekly cadence is also what makes the subscription *honest*: "a fresh batch every week" is the
  ongoing value that gives people a reason to keep paying **after** they land the job (stay current).

**Funnel vs standalone is a false binary** — freemium gives both: free evergreen core = funnel +
word-of-mouth; the paid weekly stream = standalone recurring revenue; **Web Pro** (live coding +
AI coach) sits above as the premium tier. Mobile has **no runtime AI** by design, so a paid mobile
tier *can't* cannibalize Web Pro — that constraint is the anti-cannibalization moat.

**Risk to own:** weekly cadence is a promise. A thin week → cancellations. The manual + agent
pipeline is the quality lever; OTA (EAS Update) is the delivery lever.

## SKUs & env

| SKU (store product id) | Type | Env override |
|---|---|---|
| `fieldnotes_pro_lifetime` | Non-consumable (iOS) / one-time managed (Play) | `EXPO_PUBLIC_IAP_PRODUCT_ID` |
| `fieldnotes_pro_monthly` | Auto-renewable subscription | `EXPO_PUBLIC_IAP_MONTHLY_ID` |
| `fieldnotes_pro_yearly` | Auto-renewable subscription | `EXPO_PUBLIC_IAP_YEARLY_ID` |

Defaults live in `src/lib/env.ts`; the registry + display prices live in `src/lib/products.ts`
(`PRO_PRODUCT_IDS`, `SUBSCRIPTION_IDS`, `SUB_*_PRICE`, `LIFETIME_*`). **Edit prices there**, not here
in prose — this table is documentation, the device shows real store prices.

## Store setup

1. **App Store Connect** — create one **subscription group** (e.g. "FieldNotes Pro") with two
   auto-renewable products (`_monthly`, `_yearly`), plus one **Non-Consumable** (`_lifetime`).
2. **Play Console** — two **subscriptions** (`_monthly`, `_yearly`) + one **one-time product**
   (`_lifetime`).
3. `react-native-iap` (v15, Nitro) requires a **dev/EAS build** — in Expo Go / web the purchase
   falls back to a **mock unlock** so the flow is demoable.
4. Optional store-side discounts/free-trials are configured in the stores; the app reads them.

## Entitlement logic (how it stays honest)

- `unlocked` (= "is Pro") is derived in `store.ts` as **any** of `PRO_PRODUCT_IDS` owned. Sole
  writer is `withOwned()` — never set `owned` directly.
- **Subscriptions are the store's truth.** `iap.native.ts > restoreAll()` reads one-time purchases
  via `getAvailablePurchases()` **and active subs via `getActiveSubscriptions()`** (lapsed subs are
  absent). `store.restore()` is the authoritative reconcile: permanent entitlements (lifetime, packs)
  are additive; **subscription flags are set strictly from live store state, so a cancelled/expired
  sub is revoked** even if a stale `entitlements` row still names it.
- `hydrateFromCloud()` syncs only **permanent** entitlements from the server — it never resurrects a
  cancelled sub from a stale row.
- Free taste of the fresh stream: the daily pool keeps a 1–2 card fresh trickle, and the dedicated
  "Stay current" deck shows a `FREE_FRESH_PREVIEW` (3) preview for non-Pro; the Home pill routes
  locked users to the paywall.

> Follow-up (not v1): a launch-time receipt refresh to auto-revoke an expired sub without the user
> tapping **Restore**. Today expiry reconciles on the store's own entitlement refresh + Restore.

## What's gated

Mirror of the paywall's Free-vs-Pro table (`src/app/paywall.tsx`). `soon` = built-but-not-shipped;
never sell `soon` as live.

| | Free | Pro |
|---|---|---|
| Browse tracks · read answers · Stage 0 primer | ✓ | ✓ |
| Spaced review · scenarios · streak · offline | ✓ | ✓ |
| Weekly "stay current" fresh drops | taste | ✓ |
| New cards per day | 15 | unlimited |
| Weak-spot & adaptive scheduling | — | ✓ |
| JD analyzer | — | ✓ |
| Most-asked-at-company lists | soon | soon |

## Code map

- `src/lib/products.ts` — SKUs, `PRO_PRODUCT_IDS`, `SUBSCRIPTION_IDS`, prices, `PackDef`/`PACKS`.
- `src/lib/env.ts` — env overrides for the three product ids.
- `src/lib/iap.native.ts` — v15 purchase (`fetchProducts`/`requestPurchase`/`finishTransaction`) +
  `restoreAll()` (one-time + active subs).
- `src/lib/store.ts` — `withOwned` (Pro = any Pro SKU), `purchase`, `restore` (sub reconcile),
  `hydrateFromCloud` (permanent-only), fresh gate.
- `src/app/paywall.tsx` — plan picker (yearly/monthly/lifetime) + Free-vs-Pro table.
- `src/app/(tabs)/profile.tsx` — Pro card. `src/app/(tabs)/index.tsx` — "Stay current" gate.
