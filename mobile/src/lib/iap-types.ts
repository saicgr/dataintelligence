export interface PurchaseResult {
  ok: boolean;
  productId: string;
  platform: string;
  receipt?: unknown;
  /** true when we couldn't reach a real store (web / Expo Go) and unlocked for demo. */
  mock?: boolean;
}
