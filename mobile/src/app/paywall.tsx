import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';

import { track as logEvent } from '../lib/analytics';
import { ENV } from '../lib/env';
import {
  BASE_PRODUCT_ID,
  LIFETIME_ANCHOR,
  LIFETIME_PRICE,
  packById,
  SUB_MONTHLY_ID,
  SUB_MONTHLY_PRICE,
  SUB_YEARLY_ID,
  SUB_YEARLY_PER_MONTH,
  SUB_YEARLY_PRICE,
  SUB_YEARLY_SAVINGS,
} from '../lib/products';
import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Btn, H2, Row, Screen, T } from '../ui/kit';
import { FreshProof } from '../components/fresh-proof';
import { HowProWorks } from '../components/how-pro-works';
import { buildCramPlan, daysUntil } from '../lib/cramPlan';

// Honest Free vs Pro: '✓' live, '—' not in tier, 'soon' = built-but-not-shipped (don't sell as live).
const ROWS: [string, string, string][] = [
  ['Browse every track & read every answer', '✓', '✓'],
  ['Stage 0 · Fundamentals primer', '✓', '✓'],
  ['Spaced review — cards resurface when due', '✓', '✓'],
  ['"Explain it out loud" scenarios · streak · offline', '✓', '✓'],
  ['Weekly "stay current" fresh drops', 'taste', '✓'],
  ['New cards per day', '15', 'unlimited'],
  ['Interview-aware scheduling — ramps to your date', '—', '✓'],
  ['JD analyzer — tracks to prep + your gaps', '—', '✓'],
  ['Most-asked-at-company lists', 'soon', 'soon'],
];

type PlanId = typeof SUB_YEARLY_ID | typeof SUB_MONTHLY_ID | typeof BASE_PRODUCT_ID;

export default function Paywall() {
  const { c, track, scheme } = useTheme();
  const router = useRouter();
  const { pack: packId } = useLocalSearchParams<{ pack?: string }>();
  const pack = packId ? packById(packId) : undefined;
  const ownsThisPack = useStore((s) => (packId ? !!s.owned[packId] : false));
  const purchase = useStore((s) => s.purchase);
  const restore = useStore((s) => s.restore);
  const interviewIn = useStore((s) => s.interviewIn);
  const interviewDate = useStore((s) => s.interviewDate);
  const role = useStore((s) => s.role);
  const company = useStore((s) => s.targetCompany).split(',')[0]?.trim();
  const [plan, setPlan] = useState<PlanId>(SUB_YEARLY_ID); // yearly is the default (best value)

  useEffect(() => {
    logEvent('paywall_viewed', { pack: packId ?? 'base' });
  }, [packId]);

  // ── One-off track pack view ────────────────────────────────────────────────
  if (pack) {
    return (
      <Screen>
        <Pressable onPress={() => safeBack(router)} accessibilityRole="button" accessibilityLabel="Close paywall">
          <T muted weight="700" size={13}>‹ Close</T>
        </Pressable>
        <View style={{ borderRadius: radius.xl, padding: 22, backgroundColor: track('rag'), alignItems: 'center' }}>
          <T color="#fff" weight="800" size={13} style={{ letterSpacing: 1 }}>ONE-OFF PACK</T>
          <T color="#fff" size={20} weight="900" style={{ marginTop: 6, textAlign: 'center' }}>{pack.title}</T>
          <T color="#fff" size={34} weight="900" style={{ marginTop: 8 }}>{pack.priceLabel}</T>
          <View style={{ marginTop: 9, backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
            <T color="#fff" weight="800" size={12}>one payment · yours forever · no subscription</T>
          </View>
        </View>
        <T size={13.5} style={{ lineHeight: 20 }}>{pack.blurb}</T>
        {ownsThisPack ? (
          <View style={{ backgroundColor: scheme === 'dark' ? 'rgba(63,185,80,.12)' : '#e3f7ec', borderRadius: radius.md, padding: 12 }}>
            <T weight="800" color={c.success} style={{ textAlign: 'center' }}>✓ Owned</T>
          </View>
        ) : (
          <Btn
            label={`Unlock ${pack.title} — ${pack.priceLabel}`}
            onPress={async () => {
              await purchase(pack.id);
              safeBack(router);
            }}
          />
        )}
        <Btn label="Restore purchases" variant="ghost" onPress={async () => { await restore(); safeBack(router); }} />
        <LegalLinks />
      </Screen>
    );
  }

  // ── Pro view (subscription, with a lifetime escape hatch) ───────────────────
  // Interview-aware urgency: when a date is set, show the REAL ramp the plan would run
  // (buildCramPlan already exists for the home plan card — same math, honest claim).
  const planDays = daysUntil(interviewDate);
  const cram = planDays != null && planDays > 0 ? buildCramPlan(interviewDate, role) : null;
  const urgent = cram
    ? `⏳ ${company || 'Your interview'} in ${planDays}d — Pro ramps ~${cram.totalCards} cards toward it, then tapers to a warm-up`
    : interviewIn != null && interviewIn <= 7
      ? `⏳ ${company || 'Your interview'} is ~${interviewIn} days out — go in current`
      : '🆕 New cards every week — the deck never goes stale';

  const cta =
    plan === BASE_PRODUCT_ID
      ? `Unlock Lifetime — ${LIFETIME_PRICE}`
      : plan === SUB_YEARLY_ID
        ? `Start yearly — ${SUB_YEARLY_PRICE}/yr`
        : `Start monthly — ${SUB_MONTHLY_PRICE}/mo`;

  return (
    <Screen>
      <Pressable onPress={() => safeBack(router)} accessibilityRole="button" accessibilityLabel="Close paywall">
        <T muted weight="700" size={13}>‹ Close</T>
      </Pressable>

      <View style={{ borderRadius: radius.xl, padding: 22, backgroundColor: '#3b2da8', alignItems: 'center' }}>
        <T color="#dcd7ff" weight="800" size={13} style={{ letterSpacing: 1 }}>FIELDNOTES PRO</T>
        <T color="#fff" size={18} weight="900" style={{ marginTop: 6, textAlign: 'center' }}>
          Stay current. Every week.
        </T>
        <T color="#dcd7ff" size={12.5} style={{ marginTop: 4, textAlign: 'center', lineHeight: 18 }}>
          Hand-verified cards on what shipped this week — dated, source-linked, retired when stale.
          Plus interview-date ramp scheduling.
        </T>
      </View>

      {/* Proof before price: the actual latest fresh rows, not a claim. */}
      <View style={{ backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: 14 }}>
        <FreshProof />
      </View>

      <View
        style={{ backgroundColor: scheme === 'dark' ? 'rgba(255,212,59,.08)' : '#fdf2dd', borderRadius: radius.md, padding: 9 }}>
        <T weight="800" size={12} color={c.warn} style={{ textAlign: 'center' }}>{urgent}</T>
      </View>

      {/* Plan picker */}
      <View style={{ gap: 9 }}>
        <PlanCard
          selected={plan === SUB_YEARLY_ID}
          onPress={() => setPlan(SUB_YEARLY_ID)}
          title="Yearly"
          price={`${SUB_YEARLY_PRICE}/yr`}
          sub={`${SUB_YEARLY_PER_MONTH}/mo · billed yearly`}
          badge={SUB_YEARLY_SAVINGS}
        />
        <PlanCard
          selected={plan === SUB_MONTHLY_ID}
          onPress={() => setPlan(SUB_MONTHLY_ID)}
          title="Monthly"
          price={`${SUB_MONTHLY_PRICE}/mo`}
          sub="Cancel anytime"
        />
        <PlanCard
          selected={plan === BASE_PRODUCT_ID}
          onPress={() => setPlan(BASE_PRODUCT_ID)}
          title="Lifetime"
          price={LIFETIME_PRICE}
          sub={`one payment · yours forever`}
          anchor={LIFETIME_ANCHOR}
        />
      </View>

      <Btn
        label={cta}
        onPress={async () => {
          await purchase(plan);
          safeBack(router);
        }}
      />
      <Row style={{ gap: 6, justifyContent: 'center', marginTop: 2 }}>
        <T size={12}>🔓</T>
        <T muted size={11.5} weight="700" style={{ textAlign: 'center', lineHeight: 16 }}>
          No surprises — your exact renewal date shows before you&apos;re charged · cancel anytime ·
          prefer no renewals? Lifetime is one-and-done.
        </T>
      </Row>

      <View style={{ backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: 16 }}>
        <HowProWorks />
      </View>

      <H2>Free vs Pro</H2>
      <View>
        <Row style={{ paddingVertical: 8 }}>
          <View style={{ flex: 1 }} />
          <T muted weight="800" size={11} style={{ width: 64, textAlign: 'center' }}>FREE</T>
          <T weight="800" size={11} color={track('rag')} style={{ width: 64, textAlign: 'center' }}>PRO</T>
        </Row>
        {ROWS.map(([label, free, pro], i) => (
          <Row key={i} style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.border }}>
            <T size={12.5} style={{ flex: 1 }}>{label}</T>
            <Cell v={free} />
            <Cell v={pro} pro />
          </Row>
        ))}
      </View>

      <Btn
        label="Restore purchase"
        variant="ghost"
        onPress={async () => {
          await restore();
          safeBack(router);
        }}
      />
      <T muted size={11} style={{ textAlign: 'center', lineHeight: 16 }}>
        Subscriptions auto-renew until cancelled — manage in your {` `}store account. Lifetime is a one-time
        purchase. The web workbench (live coding + AI coach) is a separate plan.
      </T>
      <LegalLinks />
    </Screen>
  );
}

/** Apple's standard EULA covers auto-renewing subs sold through the App Store. */
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * Terms / Privacy (+ iOS EULA) — store guidelines and consumer law require these
 * anywhere we sell auto-renewing subscriptions. URLs come from ENV.webUrl
 * (EXPO_PUBLIC_WEB_URL), which must point at the deployed web app.
 */
function LegalLinks() {
  const { c } = useTheme();
  const open = (url: string) => () => {
    Linking.openURL(url).catch(() => {}); // offline / no handler → silently no-op, never crash the paywall
  };
  const links: { label: string; url: string }[] = [
    { label: 'Terms', url: `${ENV.webUrl}/terms` },
    { label: 'Privacy', url: `${ENV.webUrl}/privacy` },
    ...(Platform.OS === 'ios' ? [{ label: 'EULA', url: APPLE_EULA_URL }] : []),
  ];
  return (
    <Row style={{ justifyContent: 'center', gap: 6, paddingBottom: 4 }}>
      {links.map((l, i) => (
        <Row key={l.label} style={{ gap: 6 }}>
          {i > 0 && <T muted size={11}>·</T>}
          <Pressable onPress={open(l.url)} accessibilityRole="link" accessibilityLabel={`Open ${l.label}`} hitSlop={8}>
            <T size={11.5} weight="700" style={{ textDecorationLine: 'underline' }} color={c.muted}>
              {l.label}
            </T>
          </Pressable>
        </Row>
      ))}
    </Row>
  );
}

function PlanCard({
  selected,
  onPress,
  title,
  price,
  sub,
  badge,
  anchor,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  price: string;
  sub: string;
  badge?: string;
  anchor?: string;
}) {
  const { c, track } = useTheme();
  const accent = track('rag');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${title} plan — ${price}, ${sub}`}
      accessibilityState={{ checked: selected }}>
      <Row
        style={{
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: selected ? accent : c.border,
          backgroundColor: selected ? (track('rag') + '14') : c.card,
          paddingVertical: 13,
          paddingHorizontal: 14,
          gap: 12,
        }}>
        {/* radio */}
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: selected ? accent : c.muted,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} />}
        </View>
        <View style={{ flex: 1 }}>
          <Row style={{ gap: 8 }}>
            <T weight="800" size={14}>{title}</T>
            {badge && (
              <View style={{ backgroundColor: accent, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
                <T color="#fff" weight="900" size={10}>{badge}</T>
              </View>
            )}
          </Row>
          <T muted size={11.5} style={{ marginTop: 2 }}>{sub}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {anchor && (
            <T muted size={11} style={{ textDecorationLine: 'line-through' }}>{anchor}</T>
          )}
          <T weight="900" size={15}>{price}</T>
        </View>
      </Row>
    </Pressable>
  );
}

function Cell({ v, pro }: { v: string; pro?: boolean }) {
  const { c } = useTheme();
  const color = v === '✓' ? c.success : v === '—' ? c.muted : pro ? c.fg : c.accentInk;
  return (
    <T weight="800" size={12.5} color={color} style={{ width: 64, textAlign: 'center' }}>
      {v}
    </T>
  );
}
