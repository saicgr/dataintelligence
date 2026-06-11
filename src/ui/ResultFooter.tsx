import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { haptic } from '../lib/feedback';
import { radius, space, useTheme } from '../lib/theme';
import { Pop } from './anim';
import { Btn, Row, T } from './kit';
import { Mascot } from './Mascot';

/**
 * D2 RESULTFOOTER — the Duolingo "Nice job!" acknowledge bar.
 *
 * A color-washed footer that closes out a graded card: a filled check-circle (correct,
 * `c.success` wash) or x-circle (`c.danger` wash), a big title + optional message, optional
 * share/flag icon buttons, and a chunky full-width Continue <Btn> (variant `green` when ok,
 * `danger` when not). The icon springs in via <Pop> (reduce-motion friendly — Pop no-ops when
 * the OS reduce-motion setting is on, and falls back to a static icon).
 *
 * Drop-in replacement for the inline "🎉 Nailed it" / "✗ Common trap" + Continue blocks in the
 * card players (SessionView ChoiceBlock, OrderView, DiagView, ScenarioView, etc.).
 */
export function ResultFooter({
  ok,
  title,
  message,
  onContinue,
  continueLabel = 'Continue',
  onShare,
  onFlag,
}: {
  ok: boolean;
  title?: string;
  message?: string;
  onContinue: () => void;
  continueLabel?: string;
  onShare?: () => void;
  onFlag?: () => void;
}) {
  const { c, scheme } = useTheme();
  const tone = ok ? c.success : c.danger;
  // Soft tonal wash behind the footer — translucent so it reads on both light & dark surfaces.
  const wash = scheme === 'dark' ? tone + '1f' : tone + '14';
  const heading = title ?? (ok ? 'Nice job!' : 'Not quite');

  return (
    <View
      style={{
        marginTop: 4,
        backgroundColor: wash,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: tone + (scheme === 'dark' ? '4d' : '33'),
        padding: space.md,
        gap: 12,
      }}>
      <Row style={{ alignItems: 'center', gap: 12 }}>
        <Pop trigger={ok}>
          <Mascot mood={ok ? 'celebrate' : 'sad'} size={52} />
        </Pop>
        <View style={{ flex: 1 }}>
          <T size={20} weight="900" color={tone}>
            {heading}
          </T>
          {message ? (
            <T size={13} weight="600" style={{ marginTop: 3, lineHeight: 19 }}>
              {message}
            </T>
          ) : null}
        </View>
        {onShare ? <IconBtn name="share-social" color={tone} label="Share" onPress={onShare} /> : null}
        {onFlag ? <IconBtn name="flag" color={c.muted} label="Flag" onPress={onFlag} /> : null}
      </Row>

      <Btn label={continueLabel} variant={ok ? 'green' : 'danger'} onPress={onContinue} />
    </View>
  );
}

/** Round, bordered icon button for the optional share / flag actions. */
function IconBtn({
  name,
  color,
  label,
  onPress,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: c.border,
        backgroundColor: c.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={name} size={19} color={color} />
    </Pressable>
  );
}
