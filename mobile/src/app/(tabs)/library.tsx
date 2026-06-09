import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SKILL_CATEGORY_ORDER, skillCategory, TRACKS, Track } from '../../lib/content';
import { ROLES } from '../../lib/roles';
import { useStore } from '../../lib/store';
import { radius, space, useTheme } from '../../lib/theme';
import { H2, Segmented, T } from '../../ui/kit';
import { RolePicker } from '../../ui/RolePicker';

type Tab = 'tracks' | 'skills';

export default function Library() {
  const router = useRouter();
  const { c } = useTheme();
  const savedCount = useStore((s) => s.savedIds.length);
  const startSaved = useStore((s) => s.startSaved);
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const [tab, setTab] = useState<Tab>('skills');
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const match = (t: Track) =>
    !query || t.name.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query);
  const skills = TRACKS.filter(match);
  const roleHits = ROLES.filter((r) => !query || r.name.toLowerCase().includes(query)).length;

  // Tap a track (role) → make it active and jump to the Learn path built for it.
  const openRole = (key: string) => {
    setRole(key);
    router.push('/');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
      {/* Tabs pinned at the top */}
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { label: `Tracks · ${ROLES.length}`, value: 'tracks' },
            { label: `Skills · ${TRACKS.length}`, value: 'skills' },
          ]}
        />
      </View>

      {/* Scrollable body */}
      <ScrollView
        showsVerticalScrollIndicator
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: 24, gap: space.md }}>
        {savedCount > 0 && !query && (
          <Pressable
            onPress={() => {
              startSaved();
              router.push('/');
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              borderRadius: radius.md,
              padding: 13,
            }}>
            <T size={18}>🔖</T>
            <View style={{ flex: 1 }}>
              <T weight="800" size={14}>Saved</T>
              <T muted size={11.5}>{savedCount} card{savedCount === 1 ? '' : 's'} you bookmarked · tap to review</T>
            </View>
            <T size={16} color={c.muted}>›</T>
          </Pressable>
        )}

        {tab === 'tracks' ? (
          <>
            <T muted size={12}>Pick a role — tap to study its path, tuned to your level.</T>
            {roleHits > 0 ? (
              <RolePicker value={role} onChange={openRole} query={q} />
            ) : (
              <T muted size={13} style={{ marginTop: 8 }}>No roles match “{q}”.</T>
            )}
          </>
        ) : (
          <>
            <T muted size={12}>Browse any single subject — every level, all questions.</T>
            {SKILL_CATEGORY_ORDER.map((cat) => {
              const items = skills.filter((t) => skillCategory(t.slug) === cat);
              if (items.length === 0) return null;
              return (
                <View key={cat} style={{ gap: 11 }}>
                  <H2>{cat}</H2>
                  <Grid tracks={items} onOpen={(s) => router.push(`/track/${s}`)} />
                </View>
              );
            })}
            {skills.length === 0 && <T muted size={13} style={{ marginTop: 8 }}>No skills match “{q}”.</T>}
          </>
        )}
      </ScrollView>

      {/* Search bar pinned to the bottom, above the nav bar */}
      <View
        style={{
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: space.sm,
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            borderRadius: radius.md,
            paddingHorizontal: 13,
          }}>
          <T size={15} color={c.muted}>🔍</T>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={tab === 'tracks' ? 'Search roles…' : 'Search skills…'}
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{ flex: 1, paddingVertical: 11, color: c.fg, fontSize: 14 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Grid({ tracks, onOpen }: { tracks: Track[]; onOpen: (slug: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
      {tracks.map((t) => (
        <Tile key={t.slug} track={t} onPress={() => onOpen(t.slug)} />
      ))}
    </View>
  );
}

function Tile({ track, onPress }: { track: Track; onPress: () => void }) {
  const { track: tint } = useTheme();
  const col = tint(track.color);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        minHeight: 82,
        borderRadius: radius.md,
        padding: 13,
        backgroundColor: col,
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}>
      <T size={30} style={{ position: 'absolute', right: 8, top: 4, opacity: 0.25 }}>
        {track.icon}
      </T>
      <T color="#fff" weight="800" size={15}>
        {track.name}
      </T>
      <T color="#fff" weight="700" size={11.5} style={{ opacity: 0.9 }}>
        {track.q} questions
      </T>
    </Pressable>
  );
}
