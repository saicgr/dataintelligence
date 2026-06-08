import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { track as analytics } from '../lib/analytics';
import { TRACKS } from '../lib/content';
import { readinessForRole, readinessLabel } from '../lib/readiness';
import { ROLES } from '../lib/roles';
import { useStore } from '../lib/store';
import { trackColors, useTheme } from '../lib/theme';
import { CertificateCard, CertificateProps } from '../ui/CertificateCard';
import { Btn, Screen, T } from '../ui/kit';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function today(): string {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function Certificate() {
  const router = useRouter();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ kind?: string; track?: string }>();
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const shotRef = useRef<View>(null);

  const cert = buildCert(params, role, progress);

  async function share() {
    try {
      const uri = await captureRef(shotRef, { format: 'png', quality: 1 });
      analytics('certificate_shared', { kind: params.kind ?? 'readiness' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your certificate' });
      } else {
        Alert.alert('Sharing unavailable', 'This device can’t open the share sheet.');
      }
    } catch (e) {
      Alert.alert('Couldn’t share', String((e as Error).message));
    }
  }

  if (!cert) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()}>
          <T muted weight="700" size={13}>‹ Close</T>
        </Pressable>
        <T muted size={13} style={{ textAlign: 'center', marginTop: 40 }}>
          Nothing to certify yet — master a track or reach interview-ready first.
        </T>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <T muted weight="700" size={13}>‹ Close</T>
      </Pressable>

      {/* the ref'd view is exactly what gets captured */}
      <View ref={shotRef} collapsable={false} style={{ backgroundColor: c.surface, borderRadius: 22 }}>
        <CertificateCard {...cert} />
      </View>

      <T muted size={12} style={{ textAlign: 'center', lineHeight: 18 }}>
        Post it to LinkedIn or X — proof you put in the reps.
      </T>
      <Btn label="📤 Share certificate" onPress={share} />
    </Screen>
  );
}

/** Resolve the route params + store into the certificate content, or null if not yet earned. */
function buildCert(
  params: { kind?: string; track?: string },
  role: string,
  progress: Parameters<typeof readinessForRole>[1]
): CertificateProps | null {
  if (params.kind === 'track' && params.track) {
    const t = TRACKS.find((x) => x.slug === params.track);
    if (!t) return null;
    const seen = Object.keys(progress).filter((k) => k.startsWith(`${t.slug}-`)).length;
    const pct = t.q ? Math.min(100, Math.round((seen / t.q) * 100)) : 0;
    return {
      title: 'Certificate of Mastery',
      subject: t.name,
      detail: `${pct}% track coverage`,
      date: today(),
      accent: trackColors.light[t.color as keyof typeof trackColors.light] ?? undefined,
    };
  }
  // default: role readiness certificate
  const r = readinessForRole(role, progress, Date.now());
  if (r <= 0) return null;
  const roleName = ROLES.find((x) => x.key === role)?.name ?? 'this role';
  return {
    title: r >= 0.8 ? 'Interview-Ready' : 'Readiness Certificate',
    subject: roleName,
    detail: `${Math.round(r * 100)}% readiness · ${readinessLabel(r)}`,
    date: today(),
  };
}
