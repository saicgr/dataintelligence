import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { Fragment } from 'react';

import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { FeedbackBridge } from '../../ui/FeedbackBridge';

export default function TabsLayout() {
  const { c } = useTheme();
  const onboarded = useStore((s) => s.onboarded);

  // First run → send to the one-screen onboarding before the tabs mount.
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Fragment>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#f76707',
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Learn', tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="practice"
        options={{ title: 'Practice', tabBarIcon: ({ color, size }) => <Ionicons name="play" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: 'Library', tabBarIcon: ({ color, size }) => <Ionicons name="library" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
      />
    </Tabs>
    <FeedbackBridge />
    </Fragment>
  );
}
