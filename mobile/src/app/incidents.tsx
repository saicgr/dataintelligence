import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { INCIDENTS } from '../lib/incidents';
import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Card, Row, Screen, T } from '../ui/kit';

/** Pick a real production incident (on-call/diagnostic scenario) and work it end to end. */
export default function Incidents() {
  const router = useRouter();
  const { c, track } = useTheme();
  const startIncident = useStore((s) => s.startIncident);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = INCIDENTS.filter(
    (i) => !query || i.title.toLowerCase().includes(query) || i.tool.toLowerCase().includes(query) || i.blurb.toLowerCase().includes(query)
  );
  const open = (id: string) => {
    startIncident(id);
    router.replace('/');
  };
  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
        <T muted weight="700" size={13}>‹ Back</T>
      </Pressable>

      <Row style={{ gap: 10 }}>
        <T size={24}>🚨</T>
        <View style={{ flex: 1 }}>
          <T size={20} weight="900">Production incidents</T>
          <T muted size={12.5} style={{ lineHeight: 17 }}>Pick a real on-call scenario and work it: inspect → fix → verify.</T>
        </View>
      </Row>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          borderRadius: radius.md,
          paddingHorizontal: 11,
        }}>
        <T size={13} color={c.muted}>🔍</T>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search incidents…"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={{ flex: 1, paddingVertical: 9, color: c.fg, fontSize: 13.5 }}
        />
      </View>

      {list.map((inc) => {
        const col = track(inc.tk);
        return (
          <Pressable key={inc.id} accessibilityRole="button" accessibilityLabel={`Diagnose: ${inc.title}`} onPress={() => open(inc.id)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
                <T size={21}>{inc.icon}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T weight="900" size={15}>{inc.title}</T>
                <T muted size={12} style={{ lineHeight: 17, marginTop: 2 }}>{inc.blurb}</T>
              </View>
              <T weight="800" size={12.5} color={c.accentInk}>diagnose ▶</T>
            </Card>
          </Pressable>
        );
      })}
      {list.length === 0 && <T muted size={13} style={{ textAlign: 'center' }}>No incidents match “{q}”.</T>}
    </Screen>
  );
}
