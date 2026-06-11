import { useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Pop the current screen, or fall back to the tab home when there's nothing to
 * pop. Prevents the "action 'GO_BACK' was not handled by any navigator" error
 * that fires on web refresh / deep-link / after a stack-resetting navigation.
 */
export function safeBack(router: AppRouter, fallback: string = '/(tabs)') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
