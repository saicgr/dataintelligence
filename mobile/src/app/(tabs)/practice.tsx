import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { buildCheatSheetFromCards } from '../../lib/cheatsheet';
import { COMPANY_SETS, COMPANY_KEYS } from '../../lib/companySets';
import { findCardById, type SessionCard, tracksForRole } from '../../lib/content';
import { alertInfo, confirmAsync } from '../../lib/dialog';
import { exportSheet } from '../../lib/exportPdf';
import { haptic, sfx } from '../../lib/feedback';
import { FREE_CODE_RUNS, isProActive, useStore } from '../../lib/store';
import { radius, useTheme } from '../../lib/theme';
import { CardEnter, PressableScale, Shake } from '../../ui/anim';
import { Btn, Card, H2, Row, Screen, T } from '../../ui/kit';

export default function Practice() {
  const router = useRouter();
  const { c } = useTheme();
  const role = useStore((s) => s.role);
  const startTrack = useStore((s) => s.startTrack);
  const startWeakspot = useStore((s) => s.startWeakspot);
  const startSaved = useStore((s) => s.startSaved);
  const savedIds = useStore((s) => s.savedIds);
  const savedCount = savedIds.length;
  const unlocked = useStore(isProActive);
  const tracks = tracksForRole(role);
  const progress = useStore((s) => s.progress);
  const myTracks = useStore((s) => s.myTracks);
  const startMyTrack = useStore((s) => s.startMyTrack);
  const deleteMyTrack = useStore((s) => s.deleteMyTrack);
  const createMyTrack = useStore((s) => s.createMyTrack);
  const startMistakes = useStore((s) => s.startMistakes);
  // Mistakes notebook badge: every card you've ever lapsed (auto-collected, zero upkeep).
  const mistakesCount = Object.keys(progress).filter((id) => (progress[id]?.lapses ?? 0) > 0).length;

  const exportMyTrack = (name: string, cardIds: string[]) => {
    if (!unlocked) return router.push('/paywall');
    const cards = cardIds.map((id) => findCardById(id)).filter((cd): cd is SessionCard => !!cd);
    const sheet = buildCheatSheetFromCards(name, cards, progress);
    if (!sheet) return alertInfo('Nothing to export yet', 'Drill a few of this deck’s cards first.');
    void exportSheet(sheet.html).then((r) => {
      if (!r.ok && r.error) alertInfo('Couldn’t export', r.error);
    });
  };

  const drill = (slug: string) => {
    haptic.light();
    sfx.tap();
    startTrack(slug);
    router.push('/');
  };
  // Distinct from the scheduled daily queue: an off-schedule random topic from your prep.
  // Capped at 12 cards — it promises "quick reps", not a full track drill.
  const surprise = () => {
    if (tracks.length === 0) return;
    haptic.light();
    sfx.tap();
    startTrack(tracks[Math.floor(Math.random() * tracks.length)].slug, undefined, 12);
    router.push('/');
  };

  return (
    <Screen>
      <H2>Drill on demand</H2>
      <T muted size={12} style={{ lineHeight: 18 }}>
        Home is your scheduled queue — what&apos;s due today. Here you grind whatever you pick, off-schedule.
        Practising here doesn&apos;t touch your review dates.
      </T>

      {/* Free + in-place: pick any topic and drill it right now (no detour through Library). */}
      <CardEnter>
        <Card style={{ padding: 14, gap: 11 }}>
          <Row style={{ gap: 9 }}>
            <T size={22}>🎯</T>
            <View style={{ flex: 1 }}>
              <T weight="800" size={15}>Drill a topic</T>
              <T muted size={12}>Free-practice any track, right now — just tap one</T>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {tracks.map((t) => (
              <PressableScale key={t.slug} onPress={() => drill(t.slug)} hapticStyle="selection" scaleTo={0.93}>
                <Row
                  style={{
                    gap: 5,
                    borderWidth: 1.5,
                    borderColor: c.border,
                    backgroundColor: c.card,
                    borderRadius: 999,
                    paddingVertical: 7,
                    paddingHorizontal: 11,
                  }}>
                  <T size={13}>{t.icon}</T>
                  <T weight="700" size={12}>{t.name}</T>
                </Row>
              </PressableScale>
            ))}
            {tracks.length === 0 && <T muted size={12}>No tracks for this role yet.</T>}
          </View>
        </Card>
      </CardEnter>

      {/* Company Packs — role-aware, asked-frequency ranked. Tapping opens the pack screen
          (free: overview + top 2 cards; Pro: full drill + company mock + cheat sheet). */}
      <CardEnter delay={30}>
        <Card style={{ padding: 14, gap: 11 }}>
          <Row style={{ gap: 9 }}>
            <T size={22}>🏢</T>
            <View style={{ flex: 1 }}>
              <T weight="800" size={15}>Company packs</T>
              <T muted size={12}>What each company actually asks, ranked — tap one</T>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {COMPANY_KEYS.map((key) => (
              <PressableScale
                key={key}
                onPress={() => router.push(`/company?key=${key}` as Href)}
                hapticStyle="selection"
                scaleTo={0.93}>
                <Row
                  style={{
                    gap: 5,
                    borderWidth: 1.5,
                    borderColor: c.border,
                    backgroundColor: c.card,
                    borderRadius: 999,
                    paddingVertical: 7,
                    paddingHorizontal: 13,
                  }}>
                  <T size={12}>{COMPANY_SETS[key].emoji}</T>
                  <T weight="700" size={12}>{COMPANY_SETS[key].label}</T>
                </Row>
              </PressableScale>
            ))}
          </View>
        </Card>
      </CardEnter>

      {/* Interactive code judge — write & run real SQL/Python/PySpark, graded by output. */}
      <CardEnter delay={35}>
        <Card style={{ padding: 14, gap: 11 }}>
          <Row style={{ gap: 9 }}>
            <T size={22}>💻</T>
            <View style={{ flex: 1 }}>
              <T weight="800" size={15}>Code drills</T>
              <T muted size={12}>Write &amp; run real code — graded by output, not multiple choice</T>
              <T size={11} weight="700" color={c.accentInk} style={{ marginTop: 2 }}>
                {unlocked ? 'Pro · unlimited runs' : `${FREE_CODE_RUNS} free runs/day · Pro = unlimited`}
              </T>
            </View>
          </Row>
          <Row style={{ gap: 7 }}>
            {(['sql', 'python', 'pyspark'] as const).map((lang) => (
              <PressableScale
                key={lang}
                onPress={() => {
                  haptic.light();
                  sfx.tap();
                  router.push(`/code?lang=${lang}` as Href);
                }}
                hapticStyle="selection"
                scaleTo={0.93}
                style={{ flex: 1 }}>
                <View
                  style={{
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: c.border,
                    backgroundColor: c.card,
                    borderRadius: radius.md,
                    paddingVertical: 11,
                  }}>
                  <T weight="800" size={12.5}>{lang === 'sql' ? 'SQL' : lang === 'python' ? 'Python' : 'PySpark'}</T>
                </View>
              </PressableScale>
            ))}
          </Row>
        </Card>
      </CardEnter>

      {/* Free quick mix — genuinely different from Home's scheduled review. */}
      <CardEnter delay={40}>
        <Mode
          icon="🎲"
          title="Surprise me"
          sub="A random topic from your prep — quick off-schedule reps"
          cta="Go ▶"
          onPress={surprise}
        />
      </CardEnter>

      {/* Free, hands-free — answer out loud on a walk/commute. */}
      <CardEnter delay={80}>
        <Mode
          icon="🎧"
          title="Commute mode"
          sub="Hands-free: questions read aloud, answer out loud"
          cta="Listen ▶"
          onPress={() => router.push('/audio-session' as Href)}
        />
      </CardEnter>

      {/* Free — review the cards you bookmarked (also surfaced in Library). Hidden until you save one. */}
      {savedCount > 0 && (
        <CardEnter delay={110}>
          <Mode
            icon="🔖"
            title="Saved cards"
            sub={`${savedCount} card${savedCount === 1 ? '' : 's'} you bookmarked — review them`}
            cta="Review ▶"
            onPress={() => {
              haptic.light();
              sfx.tap();
              startSaved();
              router.push('/');
            }}
          />
        </CardEnter>
      )}

      {/* Mistakes notebook — auto-deck of every lapsed card. Free: first 10 · Pro: all + export. */}
      {mistakesCount > 0 && (
        <CardEnter delay={115}>
          <Mode
            icon="📕"
            title={`Mistakes notebook · ${mistakesCount}`}
            sub={unlocked ? 'Every card you’ve missed, weakest first' : `Your missed cards (first 10 free · Pro = all ${mistakesCount})`}
            cta="Fix ▶"
            onPress={() => {
              haptic.light();
              sfx.tap();
              startMistakes();
              router.push('/');
            }}
          />
        </CardEnter>
      )}

      {/* My Tracks — user-assembled decks (built here from Saved, or from a JD in the analyzer).
          Free: 1 deck of 20 · Pro: unlimited + cheat-sheet export. */}
      <CardEnter delay={118}>
        <Card style={{ padding: 14, gap: 11 }}>
          <Row style={{ gap: 9 }}>
            <T size={22}>🗂️</T>
            <View style={{ flex: 1 }}>
              <T weight="800" size={15}>My Tracks</T>
              <T muted size={12}>Your own decks — from saved cards or a pasted JD</T>
            </View>
          </Row>
          {myTracks.map((mt) => (
            <Row key={mt.id} style={{ gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 11 }}>
              <View style={{ flex: 1 }}>
                <T weight="700" size={13}>{mt.name}</T>
                <T muted size={10.5}>{mt.cardIds.length} cards · {mt.source === 'jd' ? 'from a JD' : mt.source === 'mistakes' ? 'from mistakes' : 'hand-picked'}</T>
              </View>
              <Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel={`Drill ${mt.name}`}
                onPress={() => {
                  haptic.light();
                  startMyTrack(mt.id);
                  router.push('/');
                }}>
                <T weight="800" size={12.5} color={c.accentInk}>▶</T>
              </Pressable>
              <Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel={`Export ${mt.name} cheat sheet`}
                onPress={() => exportMyTrack(mt.name, mt.cardIds)}>
                <T size={13}>📄</T>
              </Pressable>
              <Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel={`Delete ${mt.name}`}
                onPress={() =>
                  void confirmAsync('Delete this deck?', `“${mt.name}” (${mt.cardIds.length} cards) — your card progress is kept.`, 'Delete').then(
                    (ok) => ok && deleteMyTrack(mt.id)
                  )
                }>
                <T size={13} color={c.muted}>🗑</T>
              </Pressable>
            </Row>
          ))}
          {savedCount > 0 && (
            <Btn
              label={`➕ New deck from Saved (${savedCount})`}
              variant="ghost"
              onPress={() => {
                const id = createMyTrack('From saved cards', savedIds, 'manual');
                if (!id) return router.push('/paywall'); // free cap: 1 deck
                haptic.success();
              }}
            />
          )}
          {myTracks.length === 0 && savedCount === 0 && (
            <T muted size={11.5} style={{ lineHeight: 16 }}>
              Bookmark a few cards (🔖) or paste a JD in the analyzer to build your first deck.
            </T>
          )}
          {!unlocked && <T muted size={10.5}>Free: 1 deck of up to 20 cards · Pro: unlimited + PDF export</T>}
        </Card>
      </CardEnter>

      {/* Pro tier, clearly fenced below the free value. */}
      <Row style={{ gap: 10, marginTop: 6, marginBottom: 2 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <T size={10.5} weight="900" color={c.muted} style={{ letterSpacing: 1 }}>PRO</T>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </Row>

      <CardEnter delay={70}>
        <LockedMode
          icon="🚨"
          title="Production incidents"
          sub="Pick a real on-call scenario — inspect → fix → verify"
          unlocked={unlocked}
          unlockedCta="Browse ▶"
          onUnlocked={() => router.push('/incidents' as Href)}
          onLocked={() => router.push('/paywall')}
        />
      </CardEnter>
      <CardEnter delay={80}>
        <LockedMode
          icon="⏱️"
          title="Mock interview"
          sub="Timed rapid-fire round — scored, no peeking"
          unlocked={unlocked}
          unlockedCta="Start ▶"
          onUnlocked={() => router.push('/mock' as Href)}
          onLocked={() => router.push('/paywall')}
        />
      </CardEnter>
      <CardEnter delay={90}>
        <LockedMode
          icon="📝"
          title="Paste a job description"
          sub="Match it to your prep tracks + see what you're missing"
          unlocked={unlocked}
          unlockedCta="Analyze ▶"
          onUnlocked={() => router.push('/jd' as unknown as Href)}
          onLocked={() => router.push('/paywall')}
        />
      </CardEnter>
      <CardEnter delay={120}>
        <LockedMode
          icon="🧠"
          title="Weak-spots drill"
          sub="The cards you keep missing — weakest first (adaptive)"
          unlocked={unlocked}
          unlockedCta="Drill ▶"
          onUnlocked={() => {
            startWeakspot();
            router.push('/');
          }}
          onLocked={() => router.push('/paywall')}
        />
      </CardEnter>
    </Screen>
  );
}

function Mode({
  icon,
  title,
  sub,
  cta,
  onPress,
}: {
  icon: string;
  title: string;
  sub: string;
  cta: string;
  onPress: () => void;
}) {
  const { track } = useTheme();
  return (
    <PressableScale onPress={onPress} sound>
      <Card style={{ padding: 16 }}>
        <Row>
          <T size={26}>{icon}</T>
          <Row style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <T weight="800" size={15}>{title}</T>
            <T muted size={12}>{sub}</T>
          </Row>
          <T weight="800" color={track('spark')}>{cta}</T>
        </Row>
      </Card>
    </PressableScale>
  );
}

/** A Pro-gated card: full Mode when unlocked; otherwise a locked card that shakes + buzzes on tap. */
function LockedMode({
  icon,
  title,
  sub,
  unlocked,
  unlockedCta,
  onUnlocked,
  onLocked,
}: {
  icon: string;
  title: string;
  sub: string;
  unlocked: boolean;
  unlockedCta: string;
  onUnlocked: () => void;
  onLocked: () => void;
}) {
  const { track } = useTheme();
  const [shake, setShake] = useState(0);
  if (unlocked) return <Mode icon={icon} title={title} sub={sub} cta={unlockedCta} onPress={onUnlocked} />;
  return (
    <Shake trigger={shake}>
      <PressableScale
        hapticStyle="none"
        onPress={() => {
          setShake((n) => n + 1);
          haptic.error();
          onLocked();
        }}>
        <Card style={{ padding: 16 }}>
          <Row>
            <T size={26}>{icon}</T>
            <Row style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <T weight="800" size={15}>{title}</T>
              <T muted size={12}>{sub}</T>
            </Row>
            <Row style={{ gap: 3 }}>
              <T size={12}>🔒</T>
              <T weight="900" size={12.5} color={track('spark')}>Pro</T>
            </Row>
          </Row>
        </Card>
      </PressableScale>
    </Shake>
  );
}
