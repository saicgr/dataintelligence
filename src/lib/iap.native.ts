// Native IAP via react-native-iap v15 (Nitro). Works in a dev/EAS build; in Expo Go it
// falls back to a mock unlock so the flow is still demoable. react-native-iap@15 pulls in a
// custom native module (NitroModules) that ISN'T bundled in Expo Go — and its load-time throw
// escapes a normal try/catch — so we must NOT even import it there. Gate on the runtime.
//
// v15 API note: the old getProducts/requestPurchase({sku}) shape is GONE. v15 uses
//   fetchProducts({ skus, type }) · requestPurchase({ request: { apple, google }, type })
//   getAvailablePurchases() (one-time) · getActiveSubscriptions() (live subs only).
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { PurchaseResult } from './iap-types';
import { BASE_PRODUCT_ID, isSubscriptionId, KNOWN_PRODUCT_IDS } from './products';

export type { PurchaseResult } from './iap-types';

// Expo Go reports executionEnvironment 'storeClient'; dev/standalone builds report
// 'standalone'/'bare' (where the native module is compiled in and safe to import).
const IN_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any = null;
let triedLoad = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lib(): Promise<any> {
  if (!triedLoad) {
    triedLoad = true;
    if (IN_EXPO_GO) return (mod = null); // native IAP module is absent in Expo Go — skip the import
    try {
      mod = await import('react-native-iap');
    } catch {
      mod = null;
    }
  }
  return mod;
}

export async function initIAP(): Promise<void> {
  const m = await lib();
  try {
    await m?.initConnection?.();
  } catch {
    /* no store available */
  }
}

export async function buyProduct(id: string = BASE_PRODUCT_ID): Promise<PurchaseResult> {
  const m = await lib();
  if (!m || !m.initConnection) {
    // Expo Go / native module missing → mock unlock for demo.
    return { ok: false, mock: true, productId: id, platform: Platform.OS };
  }
  const subs = isSubscriptionId(id);
  const type = subs ? 'subs' : 'in-app';
  try {
    // Surface the SKU to StoreKit/Billing before requesting it (required on Android).
    await m.fetchProducts({ skus: [id], type });
    // v15 takes per-platform request props; `apple` uses a single sku, `google` a sku list.
    const purchase = await m.requestPurchase({
      request: { apple: { sku: id }, google: { skus: [id] } },
      type,
    });
    const p = Array.isArray(purchase) ? purchase[0] : purchase;
    if (p) {
      try {
        // Subscriptions are non-consumable; never finish as consumable or it can be re-bought.
        await m.finishTransaction({ purchase: p, isConsumable: false });
      } catch {
        /* already finished */
      }
    }
    return {
      ok: Boolean(p),
      productId: id,
      platform: Platform.OS,
      receipt: p?.purchaseToken ?? p?.transactionId ?? undefined,
    };
  } catch {
    return { ok: false, productId: id, platform: Platform.OS };
  }
}

/**
 * Returns the deduped product ids the store says this user currently owns (filtered to ours).
 * One-time products come from getAvailablePurchases(); subscriptions come from
 * getActiveSubscriptions() so a LAPSED subscription is correctly absent (store is the truth).
 */
export async function restoreAll(): Promise<string[]> {
  const m = await lib();
  if (!m) return [];
  const ids = new Set<string>();
  const known = new Set<string>(KNOWN_PRODUCT_IDS);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avail: any[] = (await m.getAvailablePurchases?.()) ?? [];
    for (const x of avail) {
      const pid = String(x?.productId ?? '');
      if (known.has(pid)) ids.add(pid);
    }
  } catch {
    /* no one-time purchases available */
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active: any[] = (await m.getActiveSubscriptions?.()) ?? [];
    for (const s of active) {
      const pid = String(s?.productId ?? '');
      // isActive defaults true on this list, but honor it when present.
      if (known.has(pid) && s?.isActive !== false) ids.add(pid);
    }
  } catch {
    /* no active subscriptions */
  }

  return Array.from(ids);
}
