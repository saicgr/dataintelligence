import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { certById } from '../../../../lib/certs';
import { alertInfo } from '../../../../lib/dialog';
import { trackBySlug } from '../../../../lib/content';
import { safeBack } from '../../../../lib/nav';
import { radius, space, useTheme } from '../../../../lib/theme';
import { Card, H2, Row, T } from '../../../../ui/kit';
import { Btn } from '../../../../ui/kit';

export default function DomainDetail() {
  const { id, domainId } = useLocalSearchParams<{ id: string; domainId: string }>();
  const router = useRouter();
  const { c, track } = useTheme();

  const cert = certById(id ?? '');

  if (!cert) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
        <View style={{ padding: space.md, gap: space.md }}>
          <Pressable onPress={() => safeBack(router)}>
            <T muted weight="700" size={13}>‹ Back</T>
          </Pressable>
          <T muted size={14} style={{ marginTop: 16 }}>Certification not found.</T>
        </View>
      </SafeAreaView>
    );
  }

  const domain = cert.domains.find((d) => d.id === domainId);

  if (!domain) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
        <View style={{ padding: space.md, gap: space.md }}>
          <Pressable onPress={() => safeBack(router)}>
            <T muted weight="700" size={13}>‹ {cert.name}</T>
          </Pressable>
          <T muted size={14} style={{ marginTop: 16 }}>Domain not found.</T>
        </View>
      </SafeAreaView>
    );
  }

  const col = track(cert.color);

  const handleStudyDomain = () => {
    alertInfo('Content pipeline running', 'Cards for this domain are being prepared — check back soon.');
  };

  const relatedTracks = domain.trackSlugs
    .map((slug) => trackBySlug(slug))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ flex: 1, paddingHorizontal: space.md, paddingTop: space.md, gap: space.md }}>
        {/* Back nav */}
        <Pressable onPress={() => safeBack(router)}>
          <T muted weight="700" size={13}>‹ {cert.name}</T>
        </Pressable>

        {/* Domain header */}
        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
          <T size={28}>{domain.icon}</T>
          <View style={{ flex: 1, gap: 4 }}>
            <T size={20} weight="900">{domain.name}</T>
            <Row style={{ gap: 6 }}>
              <View
                style={{
                  backgroundColor: col + '22',
                  borderRadius: 999,
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                }}>
                <T size={11} weight="800" color={col}>{domain.weight}% of exam</T>
              </View>
            </Row>
          </View>
        </Row>

        {/* Study CTA */}
        <Btn label="▶ Study this domain" onPress={handleStudyDomain} />

        {/* Objectives */}
        {domain.objectives.length > 0 && (
          <View style={{ gap: 9 }}>
            <H2>Objectives</H2>
            {domain.objectives.map((obj, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  backgroundColor: c.card,
                  borderColor: c.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: 12,
                  alignItems: 'flex-start',
                }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    backgroundColor: col + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                    flexShrink: 0,
                  }}>
                  <T size={11} weight="800" color={col}>{i + 1}</T>
                </View>
                <T size={13} weight="600" style={{ flex: 1, lineHeight: 18 }}>{obj}</T>
              </View>
            ))}
          </View>
        )}

        {/* Community highlights */}
        {domain.communityHighlights && domain.communityHighlights.length > 0 && (
          <View style={{ gap: 9 }}>
            <H2>Community highlights</H2>
            {domain.communityHighlights.map((tip, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  backgroundColor: c.card,
                  borderColor: c.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: 12,
                  alignItems: 'flex-start',
                }}>
                <T size={14} style={{ marginTop: 1, flexShrink: 0 }}>💡</T>
                <T size={13} weight="600" style={{ flex: 1, lineHeight: 18 }}>{tip}</T>
              </View>
            ))}
          </View>
        )}

        {/* Related tracks */}
        {relatedTracks.length > 0 && (
          <View style={{ gap: 9 }}>
            <H2>Browse related tracks</H2>
            {relatedTracks.map((t) => (
              <Pressable
                key={t.slug}
                accessibilityRole="button"
                accessibilityLabel={`Open ${t.name} track`}
                onPress={() => router.push(`/track/${t.slug}`)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: track(t.color) + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <T size={16}>{t.icon}</T>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T weight="800" size={13}>{t.name}</T>
                    <T muted size={11.5}>{t.q} question{t.q === 1 ? '' : 's'}</T>
                  </View>
                  <T muted weight="800" size={16}>›</T>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
