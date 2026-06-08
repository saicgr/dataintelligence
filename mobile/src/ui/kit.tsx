import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { haptic } from '../lib/feedback';
import { radius, shade, space, useTheme } from '../lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { c } = useTheme();
  const body = (
    <View style={{ padding: space.md, gap: space.md, paddingBottom: 120 }}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false}>{body}</ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: space.md,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return (
    <Text
      style={[
        { color: c.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
        style,
      ]}>
      {children}
    </Text>
  );
}

export function T({
  children,
  muted,
  weight = '600',
  size = 14,
  color,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  weight?: TextStyle['fontWeight'];
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  return (
    <Text style={[{ color: color ?? (muted ? c.muted : c.fg), fontWeight: weight, fontSize: size }, style]}>
      {children}
    </Text>
  );
}

export function Spill({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 11,
      }}>
      <Text style={{ color: c.fg, fontWeight: '800', fontSize: 12 }}>{children}</Text>
    </View>
  );
}

export function TrackBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

export function Chip({ label, kind = 'ghost' }: { label: string; kind?: 'ghost' | 'green' | 'amber' }) {
  const { c, scheme } = useTheme();
  const map = {
    ghost: { bg: 'transparent', fg: c.muted, bd: c.border },
    green: { bg: scheme === 'dark' ? 'rgba(63,185,80,.14)' : '#e3f7ec', fg: c.success, bd: 'transparent' },
    amber: { bg: scheme === 'dark' ? 'rgba(255,212,59,.12)' : '#fdf2dd', fg: c.warn, bd: 'transparent' },
  }[kind];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderColor: map.bd,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
      }}>
      <Text style={{ color: map.fg, fontWeight: '800', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

type BtnVariant = 'primary' | 'navy' | 'ghost' | 'green' | 'danger' | 'neutral';
/**
 * Chunky 3D pill (Duolingo feel): a solid darker bottom "edge" that the face presses
 * down onto when tapped. The de-facto button across the app. `primary` is keylime with
 * ink text (never white — keylime fails contrast under white). Honors reduce-motion.
 */
export function Btn({
  label,
  onPress,
  variant = 'primary',
  style,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const v: Record<BtnVariant, { bg: string; fg: string; edge: string; bd?: string }> = {
    primary: { bg: c.accent, fg: c.onAccent, edge: shade(c.accent, 0.74) },
    navy: { bg: c.navy, fg: '#fff', edge: shade(c.navy, 0.62) },
    green: { bg: c.success, fg: '#fff', edge: shade(c.success, 0.72) },
    danger: { bg: c.danger, fg: '#fff', edge: shade(c.danger, 0.72) },
    neutral: { bg: c.card, fg: c.fg, edge: c.border, bd: c.border },
    ghost: { bg: 'transparent', fg: c.fg, edge: 'transparent', bd: c.border },
  };
  const s = v[variant];
  const flat = variant === 'ghost'; // ghost reads as a flat secondary action
  const DEPTH = flat ? 0 : 4;

  // Layout props stay on the 3D wrapper; everything else (padding/sizing overrides) reaches the face,
  // preserving the old `style` override semantics for compact buttons.
  const f = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const faceOverride: Record<string, unknown> = {};
  for (const k of Object.keys(f)) {
    (OUTER_STYLE_KEYS.has(k) ? outer : faceOverride)[k] = f[k];
  }

  const ty = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPressIn={() => {
        if (!reduced && !flat) ty.value = withTiming(DEPTH, { duration: 55, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        if (!reduced && !flat) ty.value = withTiming(0, { duration: 90, easing: Easing.out(Easing.quad) });
      }}
      onPress={() => {
        if (disabled) return;
        haptic.light();
        onPress?.();
      }}
      style={[{ borderRadius: radius.md, backgroundColor: s.edge, paddingBottom: DEPTH, opacity: disabled ? 0.5 : 1 }, outer]}>
      <Animated.View
        style={[
          {
            backgroundColor: s.bg,
            borderColor: s.bd ?? 'transparent',
            borderWidth: s.bd ? 1.5 : 0,
            borderRadius: radius.md,
            paddingVertical: 14,
            paddingHorizontal: 16,
            alignItems: 'center',
          },
          faceOverride,
          faceStyle,
        ]}>
        <Text style={{ color: s.fg, fontWeight: '800', fontSize: 14.5 }}>{label}</Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

/** `style` keys that affect outer layout (kept on the 3D wrapper, not the pressable face). */
const OUTER_STYLE_KEYS = new Set([
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'alignSelf', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth',
  'position', 'top', 'left', 'right', 'bottom', 'zIndex',
]);

/** Segmented control (role + mode toggles). */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, backgroundColor: c.border, borderRadius: 13, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              backgroundColor: on ? c.card : 'transparent',
              borderRadius: 10,
              paddingVertical: 9,
              alignItems: 'center',
            }}>
            <Text style={{ color: on ? c.fg : c.muted, fontWeight: '800', fontSize: 12.5 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrapping chip selector — used for the level ladder (All + Junior…Principal), where 6 options
 *  don't fit a Segmented on a phone, so they wrap. Generic over the value (string or null). */
export function LevelPicker<T extends string | null>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              borderWidth: 1.5,
              borderColor: on ? c.fg : c.border,
              backgroundColor: on ? c.fg : c.card,
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 13,
            }}>
            <Text style={{ color: on ? c.card : c.muted, fontWeight: '800', fontSize: 12.5 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

/** Junior-vs-senior "tell" block, reused by every reveal. */
export function RedFlag({ fj, fs }: { fj: string; fs: string }) {
  const { c } = useTheme();
  if (!fj && !fs) return null;
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: c.danger, paddingLeft: 12, marginTop: 11 }}>
      {fj ? (
        <Text style={{ fontSize: 12.5, lineHeight: 19, color: c.fg }}>
          <Text style={{ color: c.danger, fontWeight: '800' }}>Junior: </Text>
          {fj}
        </Text>
      ) : null}
      {fs ? (
        <Text style={{ fontSize: 12.5, lineHeight: 19, color: c.fg }}>
          <Text style={{ color: c.success, fontWeight: '800' }}>Senior: </Text>
          {fs}
        </Text>
      ) : null}
    </View>
  );
}
