/**
 * Client env. Expo injects any `EXPO_PUBLIC_*` var from .env into process.env at
 * build time. Everything is optional — when a service's keys are absent the app
 * degrades gracefully (offline store, mock purchase, no-op analytics).
 */
export const ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  branchKey: process.env.EXPO_PUBLIC_BRANCH_KEY ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  iapProductId: process.env.EXPO_PUBLIC_IAP_PRODUCT_ID || 'fieldnotes_pro_lifetime',
  // Auto-renewable Pro subscriptions (the weekly "stay current" stream). Same subscription group.
  iapMonthlyId: process.env.EXPO_PUBLIC_IAP_MONTHLY_ID || 'fieldnotes_pro_monthly',
  iapYearlyId: process.env.EXPO_PUBLIC_IAP_YEARLY_ID || 'fieldnotes_pro_yearly',
  // Pillar 2 — remote "stay current" content manifest (version-checked on launch).
  // Unset → app uses the bundled fresh seed only. See lib/contentSync.ts.
  contentManifestUrl: process.env.EXPO_PUBLIC_CONTENT_MANIFEST_URL ?? '',
  // Web app base URL — diagnostic/querybuild cards deep-link here for the live
  // "type & Run / AI-graded" rep (the honest boundary). See ui/WebCrossSell.tsx.
  webUrl: process.env.EXPO_PUBLIC_WEB_URL || 'https://byteshards.dev',
};

export const hasSupabase = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
export const hasPosthog = Boolean(ENV.posthogKey);
export const hasBranch = Boolean(ENV.branchKey);
export const hasGoogle = Boolean(ENV.googleWebClientId);
