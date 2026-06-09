import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { TRACKS, Track } from '../../lib/content';
import { ROLES } from '../../lib/roles';
import { useStore } from '../../lib/store';
import { radius, useTheme } from '../../lib/theme';
import { H2, Screen, T } from '../../ui/kit';
import { RolePicker } from '../../ui/RolePicker';

export default function Library() {
  const router = useRouter();
  const { c } = useTheme();
  const savedCount = useStore((s) => s.savedIds.length);
  const startSaved = useStore((s) => s.startSaved);
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const match = (t: Track) =>
    !query || t.name.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query);
  const de = TRACKS.filter((t) => t.domain === 'de' && match(t));
  const ai = TRACKS.filter((t) => t.domain === 'ai' && match(t));
  const total = TRACKS.reduce((n, t) => n + t.q, 0);
  const roleHits = ROLES.filter((r) => !query || r.name.toLowerCase().includes(query)).length;
  const noSkills = de.length === 0 && ai.length === 0;
  const empty = noSkills && roleHits === 0;

  // Tap a track (role) → make it active and jump to the Learn path built for it.
  const openRole = (key: string) => {
    setRole(key);
    router.push('/');
  };

  return (
    <Screen>
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
          placeholder="Search tracks & skills…"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={{ flex: 1, paddingVertical: 11, color: c.fg, fontSize: 14 }}
        />
      </View>
      <T muted size={12}>
        {ROLES.length} career tracks · {TRACKS.length} skills · {total} senior Q&amp;A
      </T>
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

      {roleHits > 0 && (
        <View style={{ gap: 9 }}>
          <Section title="Tracks" sub="Pick a role — tap to study its path" />
          <RolePicker value={role} onChange={openRole} query={q} />
        </View>
      )}

      {!noSkills && (
        <View style={{ gap: 9, marginTop: 6 }}>
          <Section title="Skills" sub="Browse any single subject" />
          {de.length > 0 && (
            <>
              <H2>Data Engineering</H2>
              <Grid tracks={de} onOpen={(s) => router.push(`/track/${s}`)} />
            </>
          )}
          {ai.length > 0 && (
            <>
              <H2 style={{ marginTop: 8 }}>AI Engineering</H2>
              <Grid tracks={ai} onOpen={(s) => router.push(`/track/${s}`)} />
            </>
          )}
        </View>
      )}

      {empty && <T muted size={13} style={{ marginTop: 8 }}>Nothing matches “{q}”.</T>}
    </Screen>
  );
}

function Section({ title, sub }: { title: string; sub: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 1 }}>
      <T weight="800" size={19}>{title}</T>
      <T muted size={12}>{sub}</T>
    </View>
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
