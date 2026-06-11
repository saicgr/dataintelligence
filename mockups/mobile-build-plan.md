# ByteShards Mobile — Build Plan (lean v1)

Companion app to the ByteShards web platform. **Free core, Pro subscription (monthly/yearly) for the weekly "stay current" stream + a lifetime unlock, no runtime AI.** Pricing model + rationale: **[`mobile/PRICING.md`](../mobile/PRICING.md) (single source of truth).** Reference prototype: `mockups/mobile-app.html` (v8).

Positioning: the web app is where you *train* (workbench + coach); the mobile app is where you *stay sharp and show up ready* — spaced recall + the interview-week companion. See `~/.claude/.../memory/mobile-app-plan.md` for the full decision record.

---

## 1. Scope

**In v1 (everything in the mockup):**
- Onboarding (no account) + interview-trigger capture → Cram/Maintain mode
- Home swipe loop: flip cards (self-rated Again/Got it/Easy) + MCQ (senior-correct vs junior-trap), spaced-repetition scheduling
- Library: 15 tracks → categories → questions; locks→windows flagship samples
- Practice: "Drill on demand" (pick a track / quick mock)
- Progress: streak, XP, all-15-track coverage, debrief history
- Debrief loop (re-rank deck + local history)
- Share card (viral surface) + invite link
- Paywall: Pro subscription (monthly/yearly) + lifetime unlock, restore, free-tier gating (see `mobile/PRICING.md`)
- Profile: optional email sign-in (sync), settings, theme

**Explicitly OUT (do not build):**
- ❌ AI articulation grader (cut)
- ❌ Any runtime AI / API calls
- ❌ Live coding workbench (stays web-only)
- ⏸ Company-aggregate "most-asked" flywheel **compute** — ship the debrief *capture* + local re-rank in v1; the cross-user aggregate (with the 20+ threshold) is a fast-follow once there's debrief volume.

---

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | **Expo (React Native), TypeScript** — reuse web content/types |
| Navigation | `expo-router` (file-based) |
| Local state/store | **Zustand + MMKV** (fast local-first persistence) |
| Backend | **Existing Supabase** (new mobile-specific tables + RLS) |
| Content | **Bundled JSON** in the app; updated via **EAS Update (OTA)** — no store review for content |
| Payments | **`react-native-iap`** (v15, Nitro) — auto-renewable subs (`_monthly`/`_yearly`) + non-consumable `_lifetime`. See `mobile/PRICING.md` |
| Auth (optional) | **Supabase Auth** — magic-link in v1; **Sign in with Apple + Google (+ others) all planned/in-scope.** Apple's "Sign in with Apple" requirement (triggered once any social login ships) is satisfied since Apple is wanted. |
| Analytics | **PostHog** (share funnel + activation) |
| Install attribution | **Branch** (deferred deep link for invite → install K-factor) |
| Build/release | **EAS Build + EAS Submit**; OTA via **EAS Update** |

---

## 3. Content pipeline (bundle + OTA)

```
lib/data/tools/*.ts  (web source of truth)
        │  build-time script: scripts/export-mobile-content.ts
        ▼
mobile/assets/content/{tracks,questions,session}.json   (bundled in app)
        │  ship corrections/new questions WITHOUT a store release
        ▼
EAS Update (OTA)  →  app fetches new bundle on next launch
```

- One transform script reads the existing `Authored[]` / `ToolTopics` and emits compact mobile JSON (questionText, answerStructured, redFlags junior/senior, MCQ distractors, track/category/level tags, `free` flag).
- Card authoring still uses the existing `question-author` + `answer-verifier` agents at build time — committed, then OTA-pushed.
- App reads content from the local bundle only (works offline). No per-user content; content is read-only.

---

## 4. Supabase schema (new tables)

All per-user tables RLS-scoped to `auth.uid()`. Account is **optional** — until sign-in, state lives only on-device (MMKV) and syncs up on first sign-in.

```sql
-- optional profile (created on first email sign-in)
profiles            (id uuid pk = auth.uid, role text, created_at)

-- one-time purchase record (also restorable from the store receipt)
entitlements        (user_id, product_id, platform, purchased_at, receipt jsonb)

-- spaced-repetition state per card
card_progress       (user_id, card_id, ease, interval_days, due_at,
                     reps, lapses, last_rating, updated_at)   -- SM-2 style

-- raw attempts (analytics + weak-spots)
attempts            (id, user_id, card_id, kind, correct bool, rated text, ts)

-- streak / XP
user_stats          (user_id, streak, longest_streak, xp, level, last_active_date)

-- interview debriefs (v1: personal; powers local re-rank + history)
debriefs            (id, user_id, company text, level text, outcome text,
                     topics text[], notes text, created_at)

-- FAST-FOLLOW (not v1): cross-user aggregate for "most-asked at company",
-- only ever exposed when count >= 20 (privacy threshold)
company_topic_agg   (company_norm text, topic text, n int)  -- view gated by n>=20
```

Scheduler: ship **SM-2** (simple, well-understood) in v1; FSRS later if retention data warrants.

---

## 5. Local-first sync

- All writes hit **MMKV first** (instant, offline). A lightweight sync queue flushes to Supabase when signed-in + online.
- Signed-out users are fully functional; on first sign-in, merge local state up (last-write-wins per card, max() for streak/XP).
- Purchase entitlement resolves from the **store receipt** first (works with no account), Supabase `entitlements` is a convenience mirror for cross-device.

---

## 6. Payments

**Full model + rationale: [`mobile/PRICING.md`](../mobile/PRICING.md) (single source of truth).** In short:

- **Free core** (the funnel) · **Pro subscription** monthly/yearly — the weekly fresh stream + unlimited cards + smart scheduling · **lifetime** one-time unlock for people who refuse subscriptions.
- Products: `fieldnotes_pro_monthly` / `_yearly` (auto-renewable) + `fieldnotes_pro_lifetime` (non-consumable / one-time).
- `unlocked` = owns **any** Pro SKU. Subscriptions reconcile from **live store state** (`getActiveSubscriptions`); **Restore** re-reads store truth — no account needed.
- Store small-business / subscription program → ~15% fee tier.

---

## 7. Analytics & the share funnel

Fire events the mockup already stubs via `track()`:
`onboarding_done` → `session_started` → `session_completed` → `paywall_viewed` → `purchase` ; and the viral chain:
**`share_card_viewed` → `invite_link_clicked` → `install`** (install attributed via Branch/AppsFlyer deferred deep link) → compute **K-factor**. Treat share as a CAC-reducer, not a growth engine.

---

## 8. Screens → already designed in the mockup

Onboarding · Home (modes + swipe) · Library/Track/Question/Flagship · Practice · Progress · Debrief · Share · Paywall · Profile. The HTML prototype is the visual + interaction spec; port 1:1.

---

## 9. Milestones

1. **Scaffold** — Expo + expo-router + theming (port brand tokens), bottom nav, empty screens.
2. **Content pipeline** — export script → bundled JSON → render Library/Question from real data.
3. **Core loop** — swipe session, flip + MCQ cards, SM-2 scheduler, streak/XP, all on MMKV (no backend yet).
4. **Modes + debrief + share** — Cram/Maintain, debrief capture + local re-rank, share card.
5. **Supabase** — auth (**magic-link** first), tables + RLS, local→cloud sync.
6. **Social sign-in** — **Sign in with Apple + Google** (+ others) on top of magic-link.
7. **Payments** — Pro subscription (monthly/yearly) + lifetime unlock + restore + free-tier gating.
8. **Analytics + attribution** — **PostHog** events + **Branch** invite deep links (share→install K-factor).
9. **Beta** — TestFlight / Play internal track; EAS Update wired.
10. **Launch** — store listings, privacy disclosures, submit.

Phases 1–4 = a usable offline app with no accounts/payments — the cheapest possible proof that people swipe daily. **Gate everything after phase 4 on that signal.**

---

## 10. Accounts & costs

- Apple Developer Program — $99/yr · Google Play — $25 one-time
- Supabase — existing project (new tables; free tier likely fine early)
- Analytics/attribution — free tiers early
- EAS (Expo) — free tier or paid build plan depending on volume

---

## Decisions (locked)
- **Pricing:** free core · Pro **subscription** (monthly/yearly) for the weekly fresh stream · lifetime unlock. Was one-time-only; moved to subscription because the weekly fresh content is a *recurring cost* (manual + agent authoring) that must be funded by *recurring revenue*. Full doc: **[`mobile/PRICING.md`](../mobile/PRICING.md)**.
- **Free-tier cap:** reviews **unlimited**; **new cards capped (15/day)** on free; the full "stay current" fresh stream is Pro (free users get a taste). Pro = unlimited everything.
- **Sign-in:** optional, for cross-device sync. **Magic-link (email) in v1; Sign in with Apple + Google (+ others) all in-scope** (milestone 6). Apple SIWA requirement is satisfied (Apple is wanted).
- **Analytics + attribution:** **PostHog** (product/funnel) + **Branch** (invite→install attribution, K-factor). Wired at milestone 8 (offline core loop doesn't need them).
