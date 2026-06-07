import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { identify, initAnalytics, track } from '../lib/analytics';
import { initAttribution } from '../lib/attribution';
import { getSession, onAuth } from '../lib/auth';
import { initContentSync } from '../lib/contentSync';
import { initFeedback } from '../lib/feedback';
import { initIAP } from '../lib/iap';
import { setDailyReminder } from '../lib/reminders';
import { useStore } from '../lib/store';

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

export default function RootLayout() {
  const scheme = useColorScheme();
  useBootstrap();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="track/[slug]" />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
          <Stack.Screen name="debrief" options={{ presentation: 'modal' }} />
          <Stack.Screen name="share" options={{ presentation: 'modal' }} />
          <Stack.Screen name="jd" options={{ presentation: 'modal' }} />
          <Stack.Screen name="league" options={{ presentation: 'modal' }} />
          <Stack.Screen name="mock" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkpoint" options={{ presentation: 'modal' }} />
          <Stack.Screen name="audio-session" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
