/**
 * Tiny reanimated micro-interaction kit (Duolingo feel). Dependency-free beyond
 * reanimated. Every component honors the OS "reduce motion" setting.
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic, sfx } from '../lib/feedback';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticStyle?: 'light' | 'selection' | 'none';
  sound?: boolean;
  disabled?: boolean;
}) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  // Crisp timing (no spring overshoot) so taps feel responsive, not bouncy.
  return (
    <AnimatedPressable
      disabled={disabled}
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
