import { ENV } from './env';

/**
 * Product registry — single source of truth for IAP product ids + pricing metadata.
 *
 * Model (founder decision, see mobile/PRICING.md):
 *   • Free core            — browse every track, read every answer, spaced review,
 *                            15 new cards/day, scenarios, streak, offline. The funnel.
 *   • Pro SUBSCRIPTION      — the weekly "stay current" fresh stream + unlimited cards +
 *                            adaptive/weak-spot scheduling + JD analyzer. Monthly or yearly.
 *                            Recurring value (weekly drops) funded by recurring revenue.
 *   • Pro LIFETIME          — same Pro, bought once. For people who refuse subscriptions;
 *                            priced ≈ 2 years of yearly so it still covers expected tenure.
 *
 * Pro is granted by owning ANY of PRO_PRODUCT_IDS (a live subscription OR the lifetime unlock).
 *
 * IMPORTANT: each id must be created in the stores before it's buyable on device —
 *   • lifetime → NON-CONSUMABLE (App Store Connect) / one-time managed product (Play)
 *   • monthly/yearly → AUTO-RENEWABLE SUBSCRIPTION (both stores), same subscription group
 */

/** The one-time "Pro lifetime" unlock (yours forever). */
export const BASE_PRODUCT_ID = ENV.iapProductId; // default 'fieldnotes_pro_lifetime'
/** Auto-renewable Pro subscriptions. */
export const SUB_MONTHLY_ID = ENV.iapMonthlyId; // default 'fieldnotes_pro_monthly'
export const SUB_YEARLY_ID = ENV.iapYearlyId; // default 'fieldnotes_pro_yearly'

/** Subscription SKUs — purchased with type:'subs'; reconciled against live store state. */
export const SUBSCRIPTION_IDS: string[] = [SUB_MONTHLY_ID, SUB_YEARLY_ID];

/** Owning ANY of these grants Pro (`unlocked`). */
export const PRO_PRODUCT_IDS: string[] = [BASE_PRODUCT_ID, ...SUBSCRIPTION_IDS];

export const isSubscriptionId = (id: string): boolean => SUBSCRIPTION_IDS.includes(id);
export const isProProductId = (id: string): boolean => PRO_PRODUCT_IDS.includes(id);

export interface PackDef {
  id: string; // store product id (non-consumable)
  title: string;
  blurb: string;
  priceLabel: string; // display only; real price comes from the store on device
  kind: 'track'; // one-off track unlocks. (Fresh content is now subscription, not packs.)
  contentKey: string; // the track slug(s) it unlocks
}

/**
 * Optional one-off TRACK packs (a single non-consumable each). Start EMPTY so the
 * paywall/profile only show packs that truly exist. The "stay current" fresh stream is
 * NOT sold as packs anymore — it's the subscription's job.
 */
export const PACKS: PackDef[] = [];

export const KNOWN_PRODUCT_IDS: string[] = [...PRO_PRODUCT_IDS, ...PACKS.map((p) => p.id)];

export function packById(id: string): PackDef | undefined {
  return PACKS.find((p) => p.id === id);
}

// ── Display pricing (founder-set launch prices). Real device prices come from the store. ──
// Subscription (the headline: pays for the weekly fresh drops).
export const SUB_MONTHLY_PRICE = '$4.99';
export const SUB_YEARLY_PRICE = '$29.99';
export const SUB_YEARLY_PER_MONTH = '$2.50'; // 29.99 / 12, rounded — "save ~50%"
export const SUB_YEARLY_SAVINGS = 'Save 50%';
// Lifetime (the sub-hater escape hatch, priced ≈ 2 yrs of yearly).
export const LIFETIME_PRICE = '$59.99';
export const LIFETIME_ANCHOR = '$99.99';
