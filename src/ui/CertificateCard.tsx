import { forwardRef } from 'react';
import { View } from 'react-native';

import { T } from './kit';

/**
 * Shareable mastery / readiness certificate. Rendered with a FIXED palette (navy + gold +
 * white) — never the live theme — so the captured PNG looks identical regardless of the
 * user's light/dark mode or Pro accent, and always passes contrast in the share sheet.
 *
 * The screen wraps this in a ref'd, non-collapsable View and feeds it to captureRef().
 */
export interface CertificateProps {
  /** Big banner line, e.g. "Certificate of Mastery" or "Interview-Ready". */
  title: string;
  /** What it's for — a track name ("Apache Spark") or role ("Data Engineer"). */
  subject: string;
  /** Supporting line, e.g. "100% track coverage" or "82% readiness". */
  detail: string;
  /** Human date string, e.g. "Jun 7, 2026". */
  date: string;
  /** Accent ring color (track color, falls back to brand orange). */
  accent?: string;
}

const NAVY = '#10192e';
const NAVY_2 = '#1c2a44';
const GOLD = '#ffcf4d';
const BRAND = '#f76707';

export const CertificateCard = forwardRef<View, CertificateProps>(function CertificateCard(
  { title, subject, detail, date, accent = BRAND },
  ref
) {
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        backgroundColor: NAVY,
        borderRadius: 22,
        padding: 26,
        borderWidth: 2,
        borderColor: accent,
        overflow: 'hidden',
      }}>
      {/* header: wordmark + seal */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T color="#fff" weight="800" size={15}>
          Byte<T color={GOLD} weight="800" size={15}>Shards</T>
        </T>
        <T size={26}>🏅</T>
      </View>

      <T color={GOLD} weight="800" size={11} style={{ letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 22 }}>
        {title}
      </T>
      <T color="#fff" weight="900" size={30} style={{ marginTop: 8, lineHeight: 34 }}>
        {subject}
      </T>

      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: NAVY_2,
          borderRadius: 999,
          paddingVertical: 6,
          paddingHorizontal: 14,
          marginTop: 16,
          borderWidth: 1,
          borderColor: accent,
        }}>
        <T color="#fff" weight="800" size={12.5}>
          {detail}
        </T>
      </View>

      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,.14)', marginTop: 22 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
        <View>
          <T color="rgba(255,255,255,.55)" weight="700" size={9.5} style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Awarded
          </T>
          <T color="#fff" weight="800" size={13}>
            {date}
          </T>
        </View>
        <T color="rgba(255,255,255,.7)" weight="700" size={10.5}>
          Senior AI &amp; Data-Engineering prep
        </T>
      </View>
    </View>
  );
});
