import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CERT_PROVIDER_LABEL,
  certById,
  certTotalCards,
  CertDomain,
} from '../../lib/certs';
import { safeBack } from '../../lib/nav';
import { useStore } from '../../lib/store';
import { radius, space, useTheme } from '../../lib/theme';
import { Btn, H2, Row, Screen, T } from '../../ui/kit';

export default function CertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c, track } = useTheme();
  const startTrack = useStore((s) => s.startTrack);

  const cert = certById(id ?? '');

  if (!cert) {
    return (
      <Screen>
        <Pressable onPress={() => safeBack(router)}>
          <T muted weight="700" size={13}>‹ Library</T>
        </Pressable>
        <T muted size={14} style={{ marginTop: 16 }}>Certification not found.</T>
      </Screen>
    );
  }

  const col = track(cert.color);
  const totalCards = certTotalCards(cert.id);
  const levelLabel = cert.level.charAt(0).toUpperCase() + cert.level.slice(1);

  const handleStudyAll = () => {
    if (totalCards === 0) {
      Alert.alert('Content coming soon', 'Cards for this certification are being prepared — check back soon.');
      return;
    }
    startTrack(cert.id);
    router.push('/');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
      <View
        style={{
          paddingHorizontal: space.md,
          paddingTop: space.md,
          paddingBottom: space.sm,
          gap: space.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}>
        <Pressable onPress={() => safeBack(router)}>
          <T muted weight="700" size={13}>‹ Library</T>
        </Pressable>

        {/* Cert header */}
        <Row style={{ gap: 12 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              backgroundColor: col,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <T size={22}>{cert.icon}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T size={20} weight="900">{cert.name}</T>
            <Row style={{ gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <View
                style={{
                  backgroundColor: col + '22',
                  borderRadius: 999,
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                }}>
                <T size={11} weight="800" color={col}>{CERT_PROVIDER_LABEL[cert.provider]}</T>
              </View>
              <View
                style={{
                  backgroundColor: c.card,
                  borderColor: c.border,
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                }}>
                <T size={11} weight="700" muted>{levelLabel}</T>
              </View>
              {cert.tag ? (
                <View
                  style={{
                    backgroundColor: cert.tag === 'new' ? c.success + '22' : '#fdf2dd',
                    borderRadius: 999,
                    paddingVertical: 3,
                    paddingHorizontal: 9,
                  }}>
                  <T size={11} weight="800" color={cert.tag === 'new' ? c.success : c.warn}>
                    {cert.tag === 'new' ? 'New' : 'Updated'}
                  </T>
                </View>
              ) : null}
            </Row>
          </View>
        </Row>

        {/* Action row */}
        <Row style={{ gap: 10 }}>
          <Btn
            label="▶ Study all"
            onPress={handleStudyAll}
            style={{ flex: 1 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open official exam page"
            onPress={() => void Linking.openURL(cert.examUrl)}
            style={{
              borderWidth: 1.5,
              borderColor: c.border,
              borderRadius: radius.md,
              paddingVertical: 14,
              paddingHorizontal: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <T size={13} weight="800">Official exam →</T>
          </Pressable>
        </Row>
      </View>

      {/* Domain list */}
      <View style={{ flex: 1, paddingHorizontal: space.md, paddingTop: space.md, gap: 10 }}>
        <H2>Exam domains · {cert.guideVersion}</H2>
        {cert.domains.length === 0 ? (
          <T muted size={13} style={{ marginTop: 8 }}>Domain breakdown coming soon.</T>
        ) : (
          cert.domains.map((domain) => (
            <DomainRow
              key={domain.id}
              domain={domain}
              certId={cert.id}
              accentColor={col}
              onPress={() => router.push(`/cert/${cert.id}/domain/${domain.id}`)}
            />
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

function DomainRow({
  domain,
  certId,
  accentColor,
  onPress,
}: {
  domain: CertDomain;
  certId: string;
  accentColor: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const totalCards = certTotalCards(certId);
  const approxCards = domain.weight > 0 && totalCards > 0
    ? Math.round((domain.weight / 100) * totalCards)
    : 0;
  const cardLabel = approxCards > 0
    ? `${approxCards} card${approxCards === 1 ? '' : 's'}`
    : '–';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${domain.name}, ${domain.weight}% of exam`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: c.card,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: 12,
      }}>
      <T size={20}>{domain.icon}</T>
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="800" size={13}>{domain.name}</T>
        <T muted size={11.5}>{cardLabel}</T>
      </View>
      <View
        style={{
          backgroundColor: accentColor + '22',
          borderRadius: 999,
          paddingVertical: 3,
          paddingHorizontal: 9,
          marginRight: 4,
        }}>
        <T size={11} weight="800" color={accentColor}>{domain.weight}%</T>
      </View>
      <T muted weight="800" size={16}>›</T>
    </Pressable>
  );
}
