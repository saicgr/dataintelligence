// Native analytics via PostHog. No-ops cleanly when no key is configured.
import PostHog from 'posthog-react-native';

import { ENV, hasPosthog } from './env';

let ph: PostHog | null = null;

export function initAnalytics(): void {
  if (!hasPosthog || ph) return;
  try {
    ph = new PostHog(ENV.posthogKey, { host: ENV.posthogHost });
  } catch {
    ph = null;
  }
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (__DEV__) console.log('▸ track:', event, props ?? '');
  try {
    ph?.capture(event, props as never);
  } catch {
    /* ignore */
  }
}

export function identify(id: string): void {
  try {
    ph?.identify(id);
  } catch {
    /* ignore */
  }
}
