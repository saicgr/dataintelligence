/**
 * Tiny reanimated micro-interaction kit (Duolingo feel). Dependency-free beyond
 * reanimated. Every component honors the OS "reduce motion" setting.
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { type AccessibilityRole, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic, sfx } from '../lib/feedback';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * "↓ follow-up below" cue — signals there's more content to scroll to after an answer.
 * The arrow bounces gently on a loop; honors reduce-motion (static). Pass `color` (e.g. c.accentInk).
 */
export function FollowUpCue({
  label = 'follow-up below',
  color = '#6b7790',
  style,
  compact = false,
  bg,
}: {
  label?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Icon-only floating chevron dot (no label) — a subtle "scroll for more" hint. */
  compact?: boolean;
  /** Circle fill for compact mode (e.g. c.accent). */
  bg?: string;
}) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [reduced, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  if (compact) {
    return (
      <Animated.View
        accessibilityRole="image"
        accessibilityLabel={label}
        style={[
          {
            alignSelf: 'center',
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bg ?? color,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
          },
          st,
          style,
        ]}>
        <Text style={{ color, fontWeight: '900', fontSize: 14, lineHeight: 16 }}>↓</Text>
      </Animated.View>
    );
  }
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, style]}>
      <Text style={{ color, fontWeight: '800', fontSize: 11.5, letterSpacing: 0.3 }}>{label}</Text>
      <Animated.Text style={[{ color, fontWeight: '900', fontSize: 14 }, st]}>↓</Animated.Text>
    </View>
  );
}

/**
 * A Pressable whose content springs down on press and fires gated haptic/sfx feedback.
 * The de-facto button across the app — replaces raw `Pressable` so every tap feels alive.
 * `haptic`/`sfx` self-gate on the store's settings, so we call them unconditionally.
 */
export function PressableScale({
  onPress,
  children,
  style,
  scaleTo = 0.98,
  hapticStyle = 'light',
  sound = false,
  disabled = false,
  accessibilityRole = 'button',
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticStyle?: 'light' | 'selection' | 'none';
  sound?: boolean;
  disabled?: boolean;
  // Defaults to "button" so every tap target reads as one to screen readers (on web: role="button").
  // Pass a different role for non-button wrappers — never nest two button roles.
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  // Crisp timing (no spring overshoot) so taps feel responsive, not bouncy.
  return (
    <AnimatedPressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPressIn={() => {
        if (!reduced) s.value = withTiming(scaleTo, { duration: 70, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        if (!reduced) s.value = withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) });
      }}
      onPress={() => {
        if (disabled) return;
        if (hapticStyle === 'light') haptic.light();
        else if (hapticStyle === 'selection') haptic.selection();
        if (sound) sfx.tap();
        onPress?.();
      }}
      style={[style, st]}>
      {children}
    </AnimatedPressable>
  );
}

/** Scale-spring "pop" that replays whenever `trigger` changes. */
export function Pop({ trigger, children, style }: { trigger: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    s.value = withSequence(withTiming(1.16, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 220 }));
  }, [trigger, reduced, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}

/** Horizontal shake that replays whenever `trigger` changes (wrong answers). */
export function Shake({ trigger, children, style }: { trigger: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const x = useSharedValue(0);
  const reduced = useReducedMotion();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    x.value = withSequence(
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 45 }),
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
  }, [trigger, reduced, x]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}

/** Slide+fade entrance — key this on the card index so it re-mounts and replays per card.
 *  Pass `delay` (ms) to stagger a list of entering cards. */
export function CardEnter({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(240).delay(delay).easing(Easing.out(Easing.cubic))}
      style={style}>
      {children}
    </Animated.View>
  );
}

/** Floating "+N XP" that rises and fades; replays on `trigger`. Absolutely positioned. */
export function XpPop({ trigger, amount, color, style }: { trigger: unknown; amount: number; color: string; style?: StyleProp<ViewStyle> }) {
  const y = useSharedValue(0);
  const o = useSharedValue(0);
  const reduced = useReducedMotion();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      return;
    }
    o.value = withSequence(withTiming(1, { duration: 120 }), withDelay(450, withTiming(0, { duration: 350 })));
    y.value = withSequence(withTiming(0, { duration: 0 }), withTiming(-34, { duration: 820 }));
  }, [trigger, reduced, o, y]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style, st]}>
      <Text style={{ color, fontWeight: '900', fontSize: 18 }}>+{amount} XP</Text>
    </Animated.View>
  );
}

/** A number that rolls up to `to` (JS-thread rAF, reliable across platforms). */
export function CountUp({ to, style, duration = 850 }: { to: number; style?: StyleProp<TextStyle>; duration?: number }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(to);
  const fromRef = useRef(to);
  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = to;
    if (reduced || from === to) {
      setN(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduced]);
  return <Text style={style}>{n}</Text>;
}

/** One-shot confetti burst for celebrations (session complete, goal hit). Reduce-motion → nothing. */
export function Confetti({ count = 16 }: { count?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const colors = ['#f76707', '#1a9e57', '#1c7ed6', '#e64980', '#ccff00', '#7048e8'];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 0, zIndex: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ConfettiPiece key={i} i={i} color={colors[i % colors.length]} />
      ))}
    </View>
  );
}
function ConfettiPiece({ i, color }: { i: number; color: string }) {
  const y = useSharedValue(0);
  const o = useSharedValue(0);
  const rot = useSharedValue(0);
  useEffect(() => {
    const delay = (i % 6) * 45;
    o.value = withSequence(withTiming(1, { duration: 90 }), withDelay(550, withTiming(0, { duration: 520 })));
    y.value = withDelay(delay, withTiming(240 + (i % 5) * 28, { duration: 1150, easing: Easing.in(Easing.quad) }));
    rot.value = withTiming(360 * (i % 2 ? 1 : -1), { duration: 1150 });
  }, [i, o, y, rot]);
  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { rotate: `${rot.value}deg` }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: `${(i * 17) % 100}%`, width: 8, height: 12, borderRadius: 2, backgroundColor: color },
        st,
      ]}
    />
  );
}

/** Spring-animated progress fill — drop-in for a static progress bar. */
export function AnimatedProgressBar({
  value,
  color,
  track,
  height = 8,
}: {
  value: number;
  color: string;
  track: string;
  height?: number;
}) {
  const w = useSharedValue(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    w.value = reduced ? value : withSpring(value, { damping: 18, stiffness: 140 });
  }, [value, reduced, w]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, w.value)) * 100}%` }));
  return (
    <View style={{ flex: 1, height, borderRadius: 999, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 999, backgroundColor: color }, fill]} />
    </View>
  );
}
