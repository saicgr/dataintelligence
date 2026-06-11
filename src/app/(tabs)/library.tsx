import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SKILL_CATEGORY_ORDER, skillCategory, TRACKS, Track } from '../../lib/content';
import { CERT_PROVIDER_LABEL, CERT_PROVIDER_ORDER, CERTS, CertDef, certTotalCards } from '../../lib/certs';
import { confirmAsync } from '../../lib/dialog';
import { ROLES } from '../../lib/roles';
import { useStore } from '../../lib/store';
import { radius, space, useTheme } from '../../lib/theme';
import { H2, Segmented, T } from '../../ui/kit';
import { RolePicker } from '../../ui/RolePicker';

type Tab = 'tracks' | 'skills' | 'certifications';

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
  const certHits = CERTS.filter((c) => !query || c.name.toLowerCase().includes(query) || c.shortName.toLowerCase().includes(query));

  // Tap a track (role) → make it active and jump to the Learn path built for it.
  // Switching is app-wide (it re-ranks Learn, mock, weak-spots…), so confirm before swapping
  // someone's prep context out from under them.
  const openRole = (key: string) => {
    if (key === role) {
      router.push('/');
      return;
    }
    const name = ROLES.find((r) => r.key === key)?.name ?? key;
    void confirmAsync(
      'Switch your prep?',
      `This changes your whole Learn path to “${name}”. Your progress is kept — switch back anytime.`,
      'Switch'
    ).then((ok) => {
      if (!ok) return;
      setRole(key);
      router.push('/');
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
      {/* Heading + tabs pinned at the top — the page previously started mid-content with no title. */}
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm, gap: 10 }}>
        <T size={22} weight="900" accessibilityRole="header">Library</T>
        <Segmented
          value={tab}
          // Clear a leftover search when actually changing tabs — a residual Skills query was
          // silently filtering the cert grid, so "Certify · 38" rendered only ~36 tiles.
          // (Segmented fires onChange on re-taps too; the guard keeps an active search alive.)
          onChange={(v) => {
            if (v !== tab) setQ('');
            setTab(v as Tab);
          }}
          options={[
            // While searching, each label shows the FILTERED count so it always matches the grid.
            { label: `Tracks · ${query ? roleHits : ROLES.length}`, value: 'tracks' },
            { label: `Skills · ${query ? skills.length : TRACKS.length}`, value: 'skills' },
            { label: `Certify · ${query ? certHits.length : CERTS.length}`, value: 'certifications' },
          ]}
        />
      </View>

      {/* Scrollable body */}
      <ScrollView
        showsVerticalScrollIndicator
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: 24, gap: space.md }}>
        {savedCount > 0 && !query && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Saved — ${savedCount} bookmarked card${savedCount === 1 ? '' : 's'}, tap to review`}
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
        ) : tab === 'skills' ? (
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
        ) : (
          <>
            <T muted size={12}>Structured cert prep — domains, objectives, and practice cards.</T>
            {CERTS.length === 0 ? (
              <T muted size={13} style={{ marginTop: 8 }}>Certifications coming soon — check back soon.</T>
            ) : (
              <>
                {CERT_PROVIDER_ORDER.map((provider) => {
                  const items = certHits.filter((c) => c.provider === provider);
                  if (items.length === 0) return null;
                  return (
                    <View key={provider} style={{ gap: 11 }}>
                      <H2>{CERT_PROVIDER_LABEL[provider]}</H2>
                      <CertGrid certs={items} onOpen={(id) => router.push(`/cert/${id}`)} />
                    </View>
                  );
                })}
                {certHits.length === 0 && <T muted size={13} style={{ marginTop: 8 }}>No certifications match “{q}”.</T>}
              </>
            )}
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
            placeholder={tab === 'tracks' ? 'Search roles…' : tab === 'skills' ? 'Search skills…' : 'Search certifications…'}
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

function CertGrid({ certs, onOpen }: { certs: CertDef[]; onOpen: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
      {certs.map((cert) => (
        <CertTile key={cert.id} cert={cert} onPress={() => onOpen(cert.id)} />
      ))}
    </View>
  );
}

function CertTile({ cert, onPress }: { cert: CertDef; onPress: () => void }) {
  const { track: tint } = useTheme();
  const col = tint(cert.color);
  const cardCount = certTotalCards(cert.id);
  const domainCount = cert.domains.length;
  const detail = cardCount > 0
    ? `${cardCount} card${cardCount === 1 ? '' : 's'}`
    : `${domainCount} domain${domainCount === 1 ? '' : 's'}`;
  const levelLabel = cert.level.charAt(0).toUpperCase() + cert.level.slice(1);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${cert.name} — ${levelLabel} certification, ${detail}`}
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
        {cert.icon}
      </T>
      <T color="#fff" weight="800" size={15}>
        {cert.shortName}
      </T>
      <View style={{ gap: 2 }}>
        <T color="#fff" weight="700" size={10} style={{ opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {levelLabel}
        </T>
        <T color="#fff" weight="700" size={11.5} style={{ opacity: 0.9 }}>
          {detail}
        </T>
      </View>
    </Pressable>
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
      accessibilityRole="button"
      accessibilityLabel={`${track.name} — ${track.q} questions`}
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
