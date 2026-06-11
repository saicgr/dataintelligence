/**
 * Company Pack screen (the "LeetCode company tags" play) — role-aware, frequency-ranked.
 *
 * Free: the pack overview + the top 2 ranked cards are open; the rest render locked → paywall.
 * Pro: drill the full ranked pack, run a company-shaped mock, export the company cheat sheet,
 * and pin the company as your target (feeds Interview Autopilot's daily company drill).
 *
 * Frequency bars blend two signals: curated topicWeights (manual-first, day-one, offline) and
 * the crowdsourced most-asked aggregate once a company crosses the 20-debrief threshold.
 */
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { buildCheatSheetFromCards } from '../lib/cheatsheet';
import { COMPANY_SETS, packTopicBars, rankCompanyCards } from '../lib/companySets';
import { confirmAsync, alertInfo } from '../lib/dialog';
import { exportSheet } from '../lib/exportPdf';
import { haptic } from '../lib/feedback';
import { safeBack } from '../lib/nav';
import { type MostAskedTopic, mostAskedAtCompany } from '../lib/peerAnswers';
import { roleByKey } from '../lib/roles';
import { isProActive, useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { Btn, Card, Chip, H2, Row, Screen, T } from '../ui/kit';

export default function CompanyPack() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const { c, track } = useTheme();
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const unlocked = useStore(isProActive);
  const startCompany = useStore((s) => s.startCompany);
  const startSingle = useStore((s) => s.startSingle);
  const targetCompanyKey = useStore((s) => s.targetCompanyKey);
  const setTargetCompanyKey = useStore((s) => s.setTargetCompanyKey);

  const set = key ? COMPANY_SETS[key] : undefined;

  // Crowd signal — optional, behind the 20-debrief privacy gate; packs work fully offline without it.
  const [remote, setRemote] = useState<MostAskedTopic[]>([]);
  useEffect(() => {
    if (set) mostAskedAtCompany(set.label).then(setRemote).catch(() => {});
  }, [set]);

  const ranked = useMemo(
    () => (key ? rankCompanyCards(key, role, progress, Date.now(), remote) : []),
    [key, role, progress, remote]
  );

  if (!key || !set) return null;
  const bars = packTopicBars(key, role, remote);
  const isTarget = targetCompanyKey === key;
  const roleName = roleByKey(role)?.name ?? 'your role';

  const gate = (go: () => void) => () => {
    if (unlocked) return go();
    router.push('/paywall');
  };

  const exportPack = gate(() => {
    const sheet = buildCheatSheetFromCards(`${set.label} pack`, ranked.map((r) => r.card), progress);
    if (!sheet) return alertInfo('Nothing to export yet', 'Drill a few pack cards first — the sheet covers what you’ve studied.');
    void exportSheet(sheet.html).then((r) => {
      if (!r.ok && r.error) alertInfo('Couldn’t export', r.error);
    });
  });

  return (
    <Screen>
      <Pressable onPress={() => safeBack(router)}>
        <T muted weight="700" size={13}>‹ Back</T>
      </Pressable>

      <Row style={{ gap: 12 }}>
        <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <T size={25}>{set.emoji}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={21} weight="900">{set.label}</T>
          <T muted size={12}>{set.blurb}</T>
        </View>
      </Row>
      {/* Role-aware: this pack is filtered through the active role — no separate picker step. */}
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Chip label={`for ${roleName}`} />
        <Pressable onPress={() => router.push('/library')} hitSlop={6}>
          <T size={12} weight="800" color={c.muted}>change role ›</T>
        </Pressable>
      </Row>

      <H2>What {set.label} asks</H2>
      <Card style={{ gap: 9 }}>
        {bars.map((b) => (
          <View key={b.topic} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={12.5} weight="700">{b.topic}</T>
              <Row style={{ gap: 6 }}>
                {typeof b.recent === 'number' && b.recent > 0 && <Chip label="asked recently" kind="green" />}
                <T muted size={11.5}>
                  {typeof b.share === 'number' ? `${Math.round(b.share * 100)}% of debriefs` : 'curated'}
                </T>
              </Row>
            </Row>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: c.border, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(b.weight * 100)}%`, height: '100%', backgroundColor: track('sql') }} />
            </View>
          </View>
        ))}
        <T muted size={10.5} style={{ lineHeight: 15 }}>
          {remote.length > 0
            ? 'Bars are curated emphasis; percentages come from anonymized interview debriefs.'
            : 'Curated emphasis — community percentages appear once 20+ debriefs are logged for this company.'}
        </T>
      </Card>

      <Btn
        label={unlocked ? `▶ Drill the ${set.label} pack · ${ranked.length} cards` : '▶ Drill the full pack (Pro)'}
        variant="navy"
        onPress={gate(() => {
          startCompany(key);
          router.replace('/');
        })}
      />
      <Row style={{ gap: 9 }}>
        <Btn
          label="⏱ Company mock"
          variant="ghost"
          style={{ flex: 1 }}
          onPress={gate(() => router.push(`/mock?company=${key}` as Href))}
        />
        <Btn label="📄 Cheat sheet" variant="ghost" style={{ flex: 1 }} onPress={exportPack} />
      </Row>
      <Btn
        label={isTarget ? '🎯 Target company ✓ (feeds your Autopilot)' : '🎯 Make this my target company'}
        variant={isTarget ? 'green' : 'neutral'}
        onPress={() => {
          haptic.selection();
          if (isTarget) {
            setTargetCompanyKey(null);
            return;
          }
          void confirmAsync(
            'Set target company?',
            `Your prep plan (and Interview Autopilot) will add a daily ${set.label} drill.`,
            'Set target'
          ).then((ok) => ok && setTargetCompanyKey(key));
        }}
      />

      <H2>Ranked by asked-frequency</H2>
      {ranked.map((r, i) => {
        const open = unlocked || i < 2; // free taste: top 2 cards
        return (
          <Pressable
            key={r.card.id}
            accessibilityRole="button"
            accessibilityLabel={open ? `Open: ${r.card.q}` : `Pro card: ${r.card.q}`}
            onPress={() => {
              if (!open) return router.push('/paywall');
              startSingle(r.card.id);
              router.replace('/');
            }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, opacity: open ? 1 : 0.62 }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: track(r.card.tk) + '29', alignItems: 'center', justifyContent: 'center' }}>
                <T weight="800" size={10.5} color={track(r.card.tk)}>{i + 1}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T size={13} weight="600" numberOfLines={2} style={{ lineHeight: 17 }}>{r.card.q}</T>
                {r.topic ? <T muted size={10.5} style={{ marginTop: 1 }}>{r.topic}{(progress[r.card.id]?.reps ?? 0) > 0 ? ' · studied ✓' : ''}</T> : null}
              </View>
              {open ? <T muted weight="800">›</T> : <T weight="800" size={10} color={track('rag')}>🔒 Pro</T>}
            </Card>
          </Pressable>
        );
      })}
      {!unlocked && ranked.length > 2 && (
        <Btn label={`Unlock all ${ranked.length} ranked cards →`} onPress={() => router.push('/paywall')} />
      )}
    </Screen>
  );
}
