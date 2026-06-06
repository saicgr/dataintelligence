import { hasBranch } from './env';

/**
 * Install attribution for the share → install K-factor.
 *
 * Branch (`react-native-branch`) needs a native dev build + config plugin + keys
 * (see SETUP.md), so it's intentionally NOT statically imported here — that keeps
 * the JS/web bundle clean. Once you've installed it in a dev build, uncomment the
 * Branch calls below; until then these are safe no-ops.
 */
export async function initAttribution(
  onInstall?: (params: Record<string, unknown>) => void
): Promise<void> {
  if (!hasBranch) return;
  // const branch = (await import('react-native-branch')).default;
  // branch.subscribe(({ params }) => {
  //   if (params?.['+is_first_session']) onInstall?.(params as Record<string, unknown>);
  // });
}

/** Generate a Branch invite link for the share card (returns null until wired). */
export async function createInviteLink(_userId: string | null): Promise<string | null> {
  if (!hasBranch) return null;
  // const branch = (await import('react-native-branch')).default;
  // const buo = await branch.createBranchUniversalObject('invite', { title: 'FieldNotes' });
  // const { url } = await buo.generateShortUrl({ feature: 'invite', channel: 'share-card' });
  // return url;
  return null;
}
