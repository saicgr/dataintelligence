/**
 * Headless bridge: turns store-owned feedback events (session complete, streak up,
 * level up) into sound + haptics, and renders a self-dismissing Level-Up overlay.
 * Mounted once in the (tabs) layout so it overlays every tab + the session player.
 */
import { useEffect } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { haptic, sfx } from '../lib/feedback';
import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { T } from './kit';

export function FeedbackBridge() {
  const ev = useStore((s) => s.lastEvent);
  const clear = useStore((s) => s.clearEvent);
  const levelUpTo = useStore((s) => s.levelUpTo);

  useEffect(() => {
    if (!ev) return;
    switch (ev.kind) {
      case 'complete':
        sfx.complete();
        haptic.success();
        break;
      case 'streak':
        sfx.streak();
        haptic.success();
        break;
      case 'levelUp':
        sfx.levelUp();
        haptic.success();
        break;
      default:
        break;
    }
    clear();
  }, [ev, clear]);

  if (levelUpTo == null) return null;
  return <LevelUpOverlay level={levelUpTo} />;
}

function LevelUpOverlay({ level }: { level: number }) {
  const { c } = useTheme();
  const clearLevelUp = useStore((s) => s.clearLevelUp);
  const playful = useStore((s) => s.playful);

  useEffect(() => {
    const id = setTimeout(clearLevelUp, 2000);
    return () => clearTimeout(id);
  }, [clearLevelUp]);

  const { width, height } = Dimensions.get('window');
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(220)}
      style={{
        position: 'absolute',
        width,
        height,
        top: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(8,12,20,0.55)',
        zIndex: 1000,
      }}>
      <Pressable style={{ position: 'absolute', width, height }} onPress={clearLevelUp} />
      <Animated.View
        entering={ZoomIn.springify().damping(11)}
        style={{
          backgroundColor: c.card,
          borderRadius: radius.xl,
          paddingVertical: 30,
          paddingHorizontal: 34,
          alignItems: 'center',
          gap: 6,
        }}>
        <T size={playful ? 60 : 44}>{playful ? '🎉' : '⭐️'}</T>
        <T weight="900" size={26}>Level {level}!</T>
        <T muted size={13.5} style={{ textAlign: 'center' }}>You leveled up — keep the streak alive.</T>
        <View style={{ marginTop: 10, backgroundColor: '#4263eb', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 }}>
          <T color="#fff" weight="900" size={14}>Lv {level}</T>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
