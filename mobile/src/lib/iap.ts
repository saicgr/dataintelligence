// Default (web / non-native) IAP shim. Metro swaps in iap.native.ts on device.
import type { PurchaseResult } from './iap-types';
import { BASE_PRODUCT_ID } from './products';

export type { PurchaseResult } from './iap-types';

export async function initIAP(): Promise<void> {}

export async function buyProduct(productId: string = BASE_PRODUCT_ID): Promise<PurchaseResult> {
  // No store on web — unlock as a mock so the prototype is demoable.
  return { ok: true, mock: true, productId, platform: 'web' };
}

/** Web has no StoreKit — store-level restore is impossible here (returns nothing).
 *  Cross-device entitlements come from the signed-in server path (sync.listUserEntitlements). */
export async function restoreAll(): Promise<string[]> {
  return [];
}
