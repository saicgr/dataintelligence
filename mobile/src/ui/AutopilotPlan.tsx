/**
 * Interview Autopilot — the home-path surface (replaces InterviewPlanCard + the generic
 * PlanList while an interview date is set). The plan itself is DERIVED on every render
 * (lib/autopilot.ts); this file renders it and routes plan items into real sessions.
 *
 * Free tier sees today's plan fully tappable (the conversion taste); days 1+ collapse to
 * locked rows → paywall. Pro gets the whole recalibrating run-up.
 */
import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { type AutopilotPlan as Plan, buildAutopilot, type PlanItem } from '../lib/autopilot';
import { buildCheatSheet } from '../lib/cheatsheet';
import { alertInfo } from '../lib/dialog';
import { exportSheet } from '../lib/exportPdf';
import { haptic } from '../lib/feedback';
import { isProActive, useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Row, T } from './kit';

const dayIso = () => new Date().toISOString().slice(0, 10);

/** The derived plan, memoized on its real inputs. Shared by the plan card AND the hero override. */
export function useAutopilot(): Plan {
  const role = useStore((s) => s.role);
  const userLevel = useStore((s) => s.userLevel);
  const interviewDate = useStore((s) => s.interviewDate);
  const progress = useStore((s) => s.progress);
  const targetCompanyKey = useStore((s) => s.targetCompanyKey);
  const jdGapTracks = useStore((s) => s.jdGapTracks);
  const autopilotDone = useStore((s) => s.autopilotDone);
  const today = dayIso();
  return useMemo(
    () =>
      buildAutopilot({
        role,
        userLevel,
        interviewDate,
        progress,
        targetCompanyKey,
        jdGapTracks,
        doneToday: autopilotDone[today] ?? [],
      }),
    [role, userLevel, interviewDate, progress, targetCompanyKey, jdGapTracks, autopilotDone, today]
  );
}

/** Route a plan item into the session that fulfills it. */
export function useStartPlanItem(): (item: PlanItem) => void {
  const router = useRouter();
  const beginAutopilotItem = useStore((s) => s.beginAutopilotItem);
  const markAutopilotItem = useStore((s) => s.markAutopilotItem);
  const startLesson = useStore((s) => s.startLesson);
  const startWeakspot = useStore((s) => s.startWeakspot);
  const startCompany = useStore((s) => s.startCompany);
  const startDaily = useStore((s) => s.startDaily);
  const progress = useStore((s) => s.progress);

  return (item: PlanItem) => {
    haptic.light();
    // Plan items carry a card budget — the launched session must honor it. "TODAY · ~10 cards"
    // followed by a 40-card session is a broken promise (the Pro default deck size is 40).
    const cap = item.cards > 0 ? item.cards : undefined;
    switch (item.kind) {
      case 'lesson':
        beginAutopilotItem(item.id);
        startLesson(item.track!, item.lessonIdx ?? 0);
        return;
      case 'weakspot':
      case 'warmup':
        beginAutopilotItem(item.id);
        startWeakspot(cap);
        return;
      case 'company':
        beginAutopilotItem(item.id);
        startCompany(item.companyKey!, cap);
        return;
      case 'review':
        beginAutopilotItem(item.id);
        startDaily(cap);
        return;
      case 'mock':
        // The mock screen self-marks via recordMock (separate route, not a SessionView session).
        router.push('/mock' as Href);
        return;
      case 'cheatsheet': {
        // A view/export, not a session — mark immediately, then export.
        markAutopilotItem(dayIso(), item.id);
        const sheet = item.track ? buildCheatSheet(item.track, progress) : null;
        if (!sheet) {
          alertInfo('Nothing to export yet', 'Drill a few cards in this track first — the sheet covers what you’ve studied.');
          return;
        }
        void exportSheet(sheet.html).then((r) => {
          if (!r.ok && r.error) alertInfo('Couldn’t export', r.error);
        });
        return;
      }
    }
  };
}

function dayLabel(offset: number, date: string, isMockDay: boolean, isWarmUp: boolean): string {
  const base =
    offset === 0
      ? 'TODAY'
      : offset === 1
        ? 'TOMORROW'
        : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  if (isWarmUp) return `${base} · INTERVIEW DAY ☀️`;
  if (isMockDay) return `${base} · MOCK DAY`;
  return base;
}

export function AutopilotPlanCard({
  plan,
  /** Plan item already promoted to the ContinueHero — hidden from today's rows so the same
   *  action ("Clear your due cards") never renders as both the hero AND plan row #1. */
  heroItemId,
}: {
  plan: Plan;
  heroItemId?: string;
}) {
  const { c, track: trackColor } = useTheme();
  const router = useRouter();
  const pro = useStore(isProActive);
  const startItem = useStartPlanItem();
  const setInterviewDate = useStore((s) => s.setInterviewDate);
  const [open, setOpen] = useState(false);

  if (plan.status === 'dormant') return null;

  if (plan.status === 'expired') {
    return (
      <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 14, gap: 9 }}>
        <T weight="800" size={14}>🛬 Your interview date has passed — how did it go?</T>
        <T muted size={12} style={{ lineHeight: 17 }}>
          Log a 2-minute debrief while it’s fresh (it re-ranks your deck), or point Autopilot at the next one.
        </T>
        <Row style={{ gap: 8 }}>
          <Pressable onPress={() => router.push('/debrief')} style={{ flex: 1 }}>
            <T weight="800" size={12.5} color={c.accentInk}>＋ Log a debrief</T>
          </Pressable>
          <Pressable onPress={() => router.push('/jd' as Href)}>
            <T weight="800" size={12.5} color={c.muted}>Set a new date ›</T>
          </Pressable>
          <Pressable onPress={() => setInterviewDate(null)} hitSlop={6}>
            <T weight="800" size={12.5} color={c.muted}>Clear</T>
          </Pressable>
        </Row>
      </View>
    );
  }

  const urgency = plan.daysUntil <= 7;
  const focus = plan.focusTracks.slice(0, 3);
  const todayDone = plan.today ? plan.today.items.filter((i) => i.done).length : 0;
  const todayTotal = plan.today?.items.length ?? 0;

  return (
    <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: urgency ? c.warn : c.border, borderRadius: radius.md }}>
      {/* Header — countdown + focus + today progress */}
      <View style={{ padding: 13, gap: 7 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="900" size={13.5}>
            🛬 {plan.isToday ? 'Interview day' : `Interview in ${plan.daysUntil} day${plan.daysUntil === 1 ? '' : 's'}`}
          </T>
          <T weight="800" size={11.5} color={c.muted}>{todayDone}/{todayTotal} today</T>
        </Row>
        <Row style={{ flexWrap: 'wrap', gap: 5 }}>
          <T muted size={11} weight="800">FOCUS</T>
          {focus.map((f) => (
            <View key={f.slug} style={{ borderWidth: 1, borderColor: f.isGap ? c.warn : c.border, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
              <T size={10.5} weight="700" color={f.isGap ? c.warn : c.fg}>{f.isGap ? '⚠️ ' : ''}{f.name}</T>
            </View>
          ))}
        </Row>
      </View>

      {/* Today — always expanded, fully tappable on both tiers */}
      <View style={{ paddingHorizontal: 13, paddingBottom: 10, gap: 6 }}>
        {plan.today && (() => {
          // The hero card absorbs one plan item — name it (with its card share) in a stub row
          // so the visible rows still reconcile with the "~N cards" label at a glance.
          const heroItem = plan.today.items.find((item) => item.id === heroItemId);
          return (
            <>
              <T muted weight="800" size={10.5} style={{ letterSpacing: 0.4 }}>
                {dayLabel(0, plan.today.date, plan.today.isMockDay, plan.today.isWarmUp)} · ~{plan.today.target} cards
              </T>
              {heroItem && (
                <T muted size={10.5}>
                  ▲ {heroItem.title}{heroItem.cards > 0 ? ` · ${heroItem.cards}` : ''} — the big card above
                </T>
              )}
              {plan.today.items
                .filter((item) => item.id !== heroItemId)
                .map((item) => (
                  <ItemRow key={item.id} item={item} onPress={() => startItem(item)} accent={trackColor(item.isGap ? 'dbt' : 'sql')} />
                ))}
            </>
          );
        })()}

        {/* The run-up — Pro expands it; free sees locked day rows */}
        {plan.days.length > 1 && (
          <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} accessibilityRole="button"
            accessibilityLabel={`${open ? 'Collapse' : 'Expand'} the ${plan.days.length - 1} upcoming plan days`}>
            <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <T weight="800" size={12} color={c.muted}>Next {plan.days.length - 1} days{plan.horizonCapped ? ' (rolling 21-day window)' : ''}</T>
              <T weight="900" size={12} color={c.muted}>{open ? '▾' : '▸'}</T>
            </Row>
          </Pressable>
        )}
        {open &&
          plan.days.slice(1).map((d) =>
            pro ? (
              <View key={d.date} style={{ gap: 5 }}>
                <T muted weight="800" size={10.5} style={{ letterSpacing: 0.4, marginTop: 3 }}>
                  {dayLabel(d.offset, d.date, d.isMockDay, d.isWarmUp)} · ~{d.target} cards
                </T>
                {d.items.map((item) => (
                  <Row key={item.id} style={{ gap: 8, paddingVertical: 3, paddingHorizontal: 4, opacity: 0.75 }}>
                    <T size={12}>{item.icon}</T>
                    <T size={12} weight="600" style={{ flex: 1 }} numberOfLines={1}>{item.title}</T>
                    {item.isGap ? <T size={10.5} color={c.warn} weight="800">gap</T> : null}
                  </Row>
                ))}
              </View>
            ) : (
              <Pressable key={d.date} onPress={() => router.push('/paywall')} accessibilityRole="button"
                accessibilityLabel={`Day ${d.offset} plan — Pro feature, opens the paywall`}>
                <Row
                  style={{
                    gap: 8,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.sm,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    opacity: 0.7,
                  }}>
                  <T size={12}>🔒</T>
                  <T size={12} weight="700" style={{ flex: 1 }}>
                    {dayLabel(d.offset, d.date, d.isMockDay, d.isWarmUp)} · ~{d.target} cards · {d.items.length} steps
                  </T>
                  <View style={{ backgroundColor: trackColor('rag'), borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
                    <T color="#fff" weight="900" size={9}>PRO</T>
                  </View>
                </Row>
              </Pressable>
            )
          )}
        {open && plan.horizonCapped && (
          <T muted size={10.5} style={{ lineHeight: 15 }}>
            Planning the next 21 days — the window slides forward daily and re-ranks as you study.
          </T>
        )}
      </View>
    </View>
  );
}

function ItemRow({ item, onPress, accent }: { item: PlanItem; onPress: () => void; accent: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      disabled={item.done}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} — ${item.done ? 'done' : item.sub}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        borderWidth: 1,
        borderColor: item.done ? c.border : accent,
        borderRadius: radius.sm,
        paddingVertical: 8,
        paddingHorizontal: 10,
        opacity: item.done ? 0.55 : 1,
        backgroundColor: item.done ? 'transparent' : accent + '10',
      }}>
      <T size={14}>{item.done ? '✓' : item.icon}</T>
      <View style={{ flex: 1 }}>
        <T size={12.5} weight="800">{item.title}</T>
        <T muted size={10.5} numberOfLines={1}>{item.sub}</T>
      </View>
      {item.cards > 0 && <T muted size={11} weight="800">{item.cards}</T>}
      <T weight="900" size={12} color={item.done ? c.success : c.muted}>{item.done ? '' : '▶'}</T>
    </Pressable>
  );
}
