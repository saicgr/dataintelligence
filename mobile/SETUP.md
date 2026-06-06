# FieldNotes mobile — setup

The app runs **with zero config** (offline store, mock purchase, no-op analytics). Fill in
`.env` to light up each service. Every block is independent and optional.

> Toolchain needs **Node 20+**. This machine defaults to Node 18 — run `nvm use 24` first.

```bash
cd mobile
nvm use 24
cp .env.example .env     # then edit .env (it's gitignored)
npm install
npm run ios              # or: npm run android / npm run web
```

---

## 1. Supabase (auth · cross-device sync · debrief flywheel)

1. Create a project at https://supabase.com/dashboard.
2. **Project Settings → API**: copy the **Project URL** and the **anon/public key** into:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
3. Apply the schema (tables + RLS + the `most_asked` privacy function):
   ```bash
   # with the Supabase CLI:
   supabase link --project-ref <ref> && supabase db push
   # …or paste supabase/migrations/0001_init.sql into the dashboard SQL editor.
   ```
4. **Auth → Providers**: enable **Email** (magic link), **Apple**, and **Google**.
   - Set the redirect URL allow-list to include `fieldnotes://` (the app scheme) — see `app.json` → `scheme`.

Without these keys the app stays fully offline; sign-in shows "add Supabase keys".

## 2. Google Sign-In

1. Google Cloud Console → Credentials → create an **OAuth 2.0 Web client**.
2. Add it as the Google provider client in Supabase (Auth → Providers → Google).
3. Put the web client id in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

## 3. Apple Sign-In

- Works on a real iOS build (not Expo Go for production). `expo-apple-authentication` is already wired.
- In Supabase enable the Apple provider; in Apple Developer set up Sign in with Apple for the app id.

## 4. In-app purchases (Pro subscription + lifetime)

**Pricing model + rationale: see [`PRICING.md`](./PRICING.md) (single source of truth).** TL;DR:
free core, a Pro **subscription** (monthly/yearly) for the weekly fresh stream, and a one-time
**lifetime** unlock for people who refuse subscriptions.

1. Create the three products and set their ids (defaults shown):
   ```
   EXPO_PUBLIC_IAP_PRODUCT_ID=fieldnotes_pro_lifetime   # Non-Consumable (iOS) / one-time (Play)
   EXPO_PUBLIC_IAP_MONTHLY_ID=fieldnotes_pro_monthly     # Auto-renewable subscription
   EXPO_PUBLIC_IAP_YEARLY_ID=fieldnotes_pro_yearly       # Auto-renewable subscription
   ```
   In **App Store Connect** put `_monthly` + `_yearly` in one subscription group; in **Play Console**
   create them as subscriptions. `_lifetime` is a non-consumable / one-time product.
2. `react-native-iap` (v15) is installed + its config plugin added. It requires a **dev/EAS build**:
   ```bash
   npx expo run:ios        # or: eas build -p ios --profile development
   ```
   In Expo Go / web the purchase falls back to a **mock unlock** so the flow is demoable.

## 5. PostHog (product analytics / funnel)

1. https://posthog.com → Project Settings → **Project API Key**.
   ```
   EXPO_PUBLIC_POSTHOG_KEY=phc_xxx
   EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or eu
   ```
2. Events already fire: `session_started/completed`, `paywall_viewed`, `purchase`,
   `share_card_viewed`, `invite_link_clicked`, `debrief_submitted`. No key → events log to
   the console only.

## 6. Branch (install attribution for the share → install K-factor)

Branch needs the native module + a dev build, so it's wired as a documented stub today.

1. https://dashboard.branch.io → Account Settings → **Branch Key** → `EXPO_PUBLIC_BRANCH_KEY`.
2. Install + configure:
   ```bash
   npx expo install react-native-branch
   ```
   add the config plugin to `app.json` plugins, then uncomment the Branch calls in
   `src/lib/attribution.ts`. Until then `share_card_viewed → invite_link_clicked` still
   track in PostHog; only the `install` join requires Branch.

---

### What's stubbed vs live without a dev build

| Feature | Expo Go / web | Dev/EAS build + keys |
|---|---|---|
| Swipe loop, content, SRS, streaks | ✅ real | ✅ real |
| Supabase auth + sync + debrief flywheel | ✅ (magic link/Google work; needs keys) | ✅ |
| Apple Sign-In | ❌ (iOS build only) | ✅ |
| In-app purchase | mock unlock | ✅ real |
| PostHog analytics | console logs | ✅ real |
| Branch attribution | no-op | ✅ after install |
