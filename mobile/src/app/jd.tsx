import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import { daysUntil } from '../lib/cramPlan';
import { analyzeJd, JdResult } from '../lib/jd';
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
  const setRole = useStore((s) => s.setRole);
  const interviewDate = useStore((s) => s.interviewDate);
  const setInterviewDate = useStore((s) => s.setInterviewDate);
  const startDaily = useStore((s) => s.startDaily);
  const [text, setText] = useState('');
  const [result, setResult] = useState<JdResult | null>(null);
  const [dateText, setDateText] = useState(interviewDate ?? '');

  const analyze = () => {
    if (text.trim().length < 20) return;
    setResult(analyzeJd(text, progress));
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
      <InterviewPlanCard dateIso={interviewDate} onStart={() => { startDaily(); router.replace('/'); }} />

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

          {unlocked ? (
            <>
              {result.gaps.length > 0 && (
                <Card style={{ borderColor: c.danger, gap: 8 }}>
                  <T weight="800" size={14} color={c.danger}>⚠️ You&apos;re missing</T>
                  <T muted size={12} style={{ lineHeight: 17 }}>
                    These matter for this JD and you haven&apos;t studied them yet — start here:
                  </T>
                  <Row style={{ flexWrap: 'wrap', gap: 7 }}>
                    {result.gaps.map((t) => (
                      <Pressable key={t.slug} onPress={() => router.push(`/track/${t.slug}`)}>
                        <View style={{ borderWidth: 1.5, borderColor: c.danger, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 }}>
                          <T weight="700" size={12} color={c.danger}>{t.icon} {t.name}</T>
                        </View>
                      </Pressable>
                    ))}
                  </Row>
                </Card>
              )}
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
