import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import { buildCheatSheetFromCards } from '../lib/cheatsheet';
import { matchCompanyKey } from '../lib/companySets';
import { findCardById, type SessionCard, tracksForRole } from '../lib/content';
import { daysUntil } from '../lib/cramPlan';
import { alertInfo } from '../lib/dialog';
import { exportSheet } from '../lib/exportPdf';
import { analyzeJd, extractSkills, jdCardPool, JdResult, type JdSkill } from '../lib/jd';
import { isProActive, useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { InterviewPlanCard } from '../ui/InterviewPlanCard';
import { Btn, Card, H2, Row, Screen, T } from '../ui/kit';

const WEB_URL = 'https://fieldnotes.dev/jd';

/** Paste a JD → recommended tracks ranked by fit + coverage gaps. Free teaser, Pro full plan. */
export default function JD() {
  const router = useRouter();
  const { c, track } = useTheme();
  const unlocked = useStore(isProActive);
  const progress = useStore((s) => s.progress);
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const interviewDate = useStore((s) => s.interviewDate);
  const setInterviewDate = useStore((s) => s.setInterviewDate);
  const startDaily = useStore((s) => s.startDaily);
  const startSingle = useStore((s) => s.startSingle);
  const applyJdPlan = useStore((s) => s.applyJdPlan);
  const createMyTrack = useStore((s) => s.createMyTrack);
  const [text, setText] = useState('');
  const [result, setResult] = useState<JdResult | null>(null);
  const [skills, setSkills] = useState<JdSkill[]>([]);
  const [dateText, setDateText] = useState(interviewDate ?? '');

  const analyze = () => {
    if (text.trim().length < 20) return;
    setResult(analyzeJd(text, progress));
    setSkills(extractSkills(text, progress));
  };

  // Pro: one tap → role + date + target company + gap tracks land in Autopilot.
  const buildPlan = () => {
    if (!result) return;
    applyJdPlan({
      role: result.bestRole,
      dateIso: interviewDate,
      companyKey: matchCompanyKey(text),
      gapTracks: result.gaps.map((t) => t.slug),
    });
    router.replace('/');
  };

  const createDeck = () => {
    if (!result) return;
    const ids = jdCardPool(text, progress);
    if (ids.length === 0) return alertInfo('No matching cards', 'Paste more of the JD (the skills/requirements section).');
    const company = matchCompanyKey(text);
    const name = `${company ? company[0].toUpperCase() + company.slice(1) : result.bestRoleName} JD · gaps`;
    const id = createMyTrack(name, ids, 'jd');
    if (!id) return router.push('/paywall'); // free cap (1 deck) reached
    const n = Math.min(ids.length, 200);
    alertInfo('My Track created', `“${name}” is in your Library → My Tracks (${n} card${n === 1 ? '' : 's'}).`);
  };

  const exportJdSheet = () => {
    const ids = jdCardPool(text, progress, 60);
    const cards = ids.map((id) => findCardById(id)).filter((cd): cd is SessionCard => !!cd);
    const sheet = buildCheatSheetFromCards('JD prep', cards, progress);
    if (!sheet) return alertInfo('Nothing to export yet', 'The sheet covers JD skills you’ve already studied — drill a few first.');
    void exportSheet(sheet.html).then((r) => {
      if (!r.ok && r.error) alertInfo('Couldn’t export', r.error);
    });
  };

  const onDateChange = (v: string) => {
    setDateText(v);
    // Save only a valid, parseable future-ish date; clear when emptied.
    if (v.trim() === '') setInterviewDate(null);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && daysUntil(v.trim()) != null) setInterviewDate(v.trim());
  };

  return (
    <Screen>
      <Pressable onPress={() => safeBack(router)}>
        <T muted weight="700" size={13}>‹ Close</T>
      </Pressable>

      {/* One screen, one name. Two entry points land here ("Interview Autopilot" on the role
          sheet, "Paste a job description" on Practice) — the header makes clear they're the
          same feature: date → plan, JD → tracks/gaps. */}
      <T size={22} weight="900">⚡ Interview Autopilot</T>
      <T muted size={12.5} style={{ lineHeight: 18 }}>
        Set your interview date for a day-by-day plan, and paste the job description to aim it.
      </T>

      <H2>When&apos;s your interview?</H2>
      <Card style={{ gap: 10 }}>
        <T muted size={12.5} style={{ lineHeight: 18 }}>
          Add the date and we&apos;ll build a ramping cram plan + a morning-of warm-up.
        </T>
        <TextInput
          value={dateText}
          onChangeText={onDateChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          style={{
            borderWidth: 1.5,
            borderColor: c.border,
            borderRadius: radius.md,
            padding: 12,
            color: c.fg,
            backgroundColor: c.surface,
            fontSize: 15,
          }}
        />
      </Card>
      <InterviewPlanCard dateIso={interviewDate} onStart={(target) => { startDaily(target); router.replace('/'); }} />

      <H2>Paste a job description</H2>
      <T muted size={12.5} style={{ lineHeight: 18 }}>
        We&apos;ll match it to the tracks you should prep — and flag what you&apos;re missing.
      </T>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Paste the full JD here…"
        placeholderTextColor={c.muted}
        multiline
        style={{
          borderWidth: 1.5,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: 12,
          color: c.fg,
          backgroundColor: c.surface,
          minHeight: 150,
          textAlignVertical: 'top',
          fontSize: 13.5,
        }}
      />
      <Btn label="Analyze ▶" onPress={analyze} />

      {result && result.recommended.length === 0 && (
        <T muted size={12.5} style={{ textAlign: 'center' }}>
          No tracks matched — paste more of the JD (skills/requirements section).
        </T>
      )}

      {result && result.recommended.length > 0 && (
        <>
          <Card style={{ gap: 6 }}>
            <T muted size={11.5} weight="800" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Best-fit role
            </T>
            <T weight="900" size={18}>{result.bestRoleName}</T>
            {unlocked ? (
              <Btn
                label={`Switch my prep to ${result.bestRoleName} →`}
                variant="navy"
                style={{ marginTop: 6 }}
                onPress={() => {
                  setRole(result.bestRole);
                  safeBack(router);
                }}
              />
            ) : null}
          </Card>

          <H2>Recommended tracks</H2>
          {(unlocked ? result.recommended : result.recommended.slice(0, 3)).map((t) => (
            <Pressable key={t.slug} onPress={() => unlocked && router.push(`/track/${t.slug}`)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: track(t.color), alignItems: 'center', justifyContent: 'center' }}>
                  <T size={15}>{t.icon}</T>
                </View>
                <T weight="700" size={14} style={{ flex: 1 }}>{t.name}</T>
                {unlocked ? <T muted weight="800">›</T> : null}
              </Card>
            </Pressable>
          ))}

          {unlocked && skills.length > 0 && (
            <>
              <H2>Skills in this JD · your coverage</H2>
              <Row style={{ flexWrap: 'wrap', gap: 7 }}>
                {skills.map((sk) => {
                  const covered = sk.cards > 0 && sk.studied >= sk.cards;
                  const none = sk.cards === 0;
                  const col = covered ? c.success : sk.studied === 0 ? c.danger : c.warn;
                  return (
                    <Pressable
                      key={`${sk.trackSlug}-${sk.term}`}
                      disabled={none || !sk.firstUnseenId}
                      accessibilityRole="button"
                      accessibilityLabel={`${sk.term}: ${sk.studied} of ${sk.cards} cards studied${sk.firstUnseenId ? ', tap to drill' : ''}`}
                      onPress={() => {
                        if (!sk.firstUnseenId) return;
                        startSingle(sk.firstUnseenId);
                        router.replace('/');
                      }}>
                      <View style={{ borderWidth: 1.5, borderColor: none ? c.border : col, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, opacity: none ? 0.55 : 1 }}>
                        <T weight="700" size={11.5} color={none ? c.muted : col}>
                          {sk.term} · {none ? 'no cards yet' : `${sk.studied}/${sk.cards}`}
                        </T>
                      </View>
                    </Pressable>
                  );
                })}
              </Row>
              <T muted size={11} style={{ lineHeight: 16 }}>
                Tap a skill to drill its next unstudied card. Red = untouched, amber = partial, green = covered.
              </T>
            </>
          )}

          {unlocked ? (
            <>
              {result.gaps.length > 0 && (() => {
                // A "gap" = matters for this JD, zero cards studied. Some gaps are ALREADY in the
                // user's role plan (e.g. an untouched FOCUS track) — without the chip suffix that
                // read as a contradiction with the home screen.
                const planSlugs = new Set(tracksForRole(role).map((t) => t.slug));
                return (
                  <Card style={{ borderColor: c.danger, gap: 8 }}>
                    <T weight="800" size={14} color={c.danger}>⚠️ Not studied yet</T>
                    <T muted size={12} style={{ lineHeight: 17 }}>
                      These matter for this JD and you haven&apos;t drilled a single card in them — start here:
                    </T>
                    <Row style={{ flexWrap: 'wrap', gap: 7 }}>
                      {result.gaps.map((t) => (
                        <Pressable key={t.slug} onPress={() => router.push(`/track/${t.slug}`)}>
                          <View style={{ borderWidth: 1.5, borderColor: c.danger, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 }}>
                            <T weight="700" size={12} color={c.danger}>
                              {t.icon} {t.name}{planSlugs.has(t.slug) ? ' · in your plan' : ''}
                            </T>
                          </View>
                        </Pressable>
                      ))}
                    </Row>
                  </Card>
                );
              })()}
              {/* The Pro loop: JD → plan → deck → sheet. buildPlan feeds Interview Autopilot. */}
              <Btn label="⚡ Build my Autopilot plan →" variant="navy" onPress={buildPlan} />
              <Row style={{ gap: 9 }}>
                <Btn label="➕ My Track from JD" variant="ghost" style={{ flex: 1 }} onPress={createDeck} />
                <Btn label="📄 JD cheat sheet" variant="ghost" style={{ flex: 1 }} onPress={exportJdSheet} />
              </Row>
              <Btn
                label="🤖 Deeper AI analysis on web →"
                variant="ghost"
                onPress={() => Linking.openURL(WEB_URL)}
              />
            </>
          ) : (
            <Pressable onPress={() => router.push('/paywall')}>
              <Card style={{ backgroundColor: '#3b2da8', gap: 6 }}>
                <T color="#fff" weight="900" size={15}>🔒 Unlock your full prep plan</T>
                <T color="#fff" size={12.5} style={{ opacity: 0.9, lineHeight: 18 }}>
                  Pro shows every matched track, the gaps you&apos;re missing, a one-tap role switch, and deeper AI analysis.
                </T>
                <T color={track('spark')} weight="900" size={13} style={{ marginTop: 4 }}>See Pro →</T>
              </Card>
            </Pressable>
          )}
        </>
      )}
    </Screen>
  );
}
