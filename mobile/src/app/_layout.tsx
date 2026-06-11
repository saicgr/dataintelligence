import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { identify, initAnalytics, track } from '../lib/analytics';
import { initAttribution } from '../lib/attribution';
import { getSession, onAuth } from '../lib/auth';
import { initContentSync } from '../lib/contentSync';
import { initFeedback } from '../lib/feedback';
import { initIAP } from '../lib/iap';
import { setDailyReminder } from '../lib/reminders';
import { useStore } from '../lib/store';
import { useResolvedScheme } from '../lib/theme';
import { DialogHost } from '../ui/DialogHost';

function useBootstrap() {
  const setUserId = useStore((s) => s.setUserId);
  const hydrate = useStore((s) => s.hydrateFromCloud);

  useEffect(() => {
    initAnalytics();
    void initIAP();
    void initFeedback();
    void initAttribution((params) => track('install_attributed', params));

    // Build the first session from real progress, then refresh "stay current"
    // content from the remote manifest (rebuilds again if new cards arrive).
    useStore.getState().rebuildSession();
    void initContentSync(() => useStore.getState().rebuildSession());
    // Re-establish the daily reminder to match the persisted preference (idempotent: cancel-first).
    void setDailyReminder(useStore.getState().reminders);

    void getSession().then((session) => {
      if (session?.user) {
        setUserId(session.user.id);
        identify(session.user.id);
        void hydrate();
      }
    });

    const unsub = onAuth((session) => {
      setUserId(session?.user?.id ?? null);
      if (session?.user) {
        identify(session.user.id);
        void hydrate();
      }
    });
    return unsub;
  }, [setUserId, hydrate]);
}

// On web this is a phone app rendered through react-native-web, so clamp it to a
// centered phone-width column over a dark backdrop — otherwise it stretches edge-to-edge
// and reads like a website. Native (iOS/Android) is unaffected.
const isWeb = Platform.OS === 'web';

export default function RootLayout() {
  // Honor the user's theme preference (Profile → Theme), not just the OS scheme.
  const scheme = useResolvedScheme();
  useBootstrap();
  return (
    <GestureHandlerRootView style={[{ flex: 1 }, isWeb && { backgroundColor: '#0b0f15', alignItems: 'center' }]}>
      {/* Runtime <title> for web — the router's head manager otherwise overrides the
          +html.tsx shell title with an empty one. No-op on native. */}
      <Head>
        <title>ByteShards — Data & AI interview prep</title>
      </Head>
      <View
        style={
          isWeb
            ? {
                flex: 1,
                width: '100%',
                maxWidth: 440,
                alignSelf: 'center',
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: 0.45,
                shadowRadius: 40,
                shadowOffset: { width: 0, height: 0 },
              }
            : { flex: 1 }
        }>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* Web: no push/modal animation — the transition is what flashed a dimmed/blank frame
              on every navigation (and swallowed taps mid-flight). Native keeps the platform feel. */}
          <Stack screenOptions={{ headerShown: false, ...(isWeb && { animation: 'none' as const }) }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="track/[slug]" />
            <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
            <Stack.Screen name="debrief" options={{ presentation: 'modal' }} />
            <Stack.Screen name="share" options={{ presentation: 'modal' }} />
            <Stack.Screen name="jd" options={{ presentation: 'modal' }} />
            <Stack.Screen name="league" options={{ presentation: 'modal' }} />
            <Stack.Screen name="friends" options={{ presentation: 'modal' }} />
            <Stack.Screen name="certificate" options={{ presentation: 'modal' }} />
            <Stack.Screen name="contest" options={{ presentation: 'modal' }} />
            <Stack.Screen name="code" options={{ presentation: 'modal' }} />
            <Stack.Screen name="company" options={{ presentation: 'modal' }} />
            <Stack.Screen name="mock" options={{ presentation: 'modal' }} />
            <Stack.Screen name="checkpoint" options={{ presentation: 'modal' }} />
            <Stack.Screen name="audio-session" />
            <Stack.Screen name="incidents" />
          </Stack>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {/* Web-only in-app confirm/alert renderer (see lib/dialog.ts) — native is a no-op. */}
          <DialogHost />
        </ThemeProvider>
      </View>
    </GestureHandlerRootView>
  );
}
