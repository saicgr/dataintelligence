import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, space, useTheme } from '../lib/theme';
import { PressableScale } from './anim';

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
    amber: { bg: scheme === 'dark' ? 'rgba(255,212,59,.12)' : '#fdf2dd', fg: c.accent, bd: 'transparent' },
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

type BtnVariant = 'primary' | 'navy' | 'ghost' | 'green';
export function Btn({
  label,
  onPress,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const styles: Record<BtnVariant, { bg: string; fg: string; bd?: string }> = {
    primary: { bg: '#f76707', fg: '#fff' },
    navy: { bg: c.navy, fg: '#fff' },
    green: { bg: c.success, fg: '#fff' },
    ghost: { bg: c.card, fg: c.fg, bd: c.border },
  };
  const s = styles[variant];
  // Subtle press-scale (timing, no spring overshoot) so every button has a quiet, alive press.
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      hapticStyle="none"
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
        style,
      ]}>
      <Text style={{ color: s.fg, fontWeight: '800', fontSize: 14.5 }}>{label}</Text>
    </PressableScale>
  );
}

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
