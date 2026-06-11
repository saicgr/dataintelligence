// Default (web) analytics — logs in dev, no-ops in prod. iOS/Android use analytics.native.ts.
export function initAnalytics(): void {}

export function track(event: string, props?: Record<string, unknown>): void {
  if (__DEV__) console.log('▸ track:', event, props ?? '');
}

export function identify(id: string): void {
  if (__DEV__) console.log('▸ identify:', id);
}
