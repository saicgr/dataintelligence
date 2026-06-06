import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, TextInput, View } from 'react-native';

import { appleAvailable, signInWithApple, signInWithEmail, signInWithGoogle, signOut } from '../../lib/auth';
import { hasSupabase } from '../../lib/env';
import { PACKS, SUB_YEARLY_PER_MONTH } from '../../lib/products';
import { useStore } from '../../lib/store';
import { radius, useTheme } from '../../lib/theme';
import { Btn, Card, H2, Row, Screen, T } from '../../ui/kit';

export default function Profile() {
  const { c } = useTheme();
  const router = useRouter();
  const unlocked = useStore((s) => s.unlocked);
  const owned = useStore((s) => s.owned);
  const userId = useStore((s) => s.userId);
  const playful = useStore((s) => s.playful);
  const setPlayful = useStore((s) => s.setPlayful);
  const sound = useStore((s) => s.sound);
  const setSound = useStore((s) => s.setSound);
  const haptics = useStore((s) => s.haptics);
  const setHaptics = useStore((s) => s.setHaptics);
  const reminders = useStore((s) => s.reminders);
  const setReminders = useStore((s) => s.setReminders);
  const devMode = useStore((s) => s.devMode);
  const setDevMode = useStore((s) => s.setDevMode);
  const restartOnboarding = useStore((s) => s.restartOnboarding);
  const restore = useStore((s) => s.restore);
  const [email, setEmail] = useState('');
  const [apple, setApple] = useState(false);

  useEffect(() => {
    appleAvailable().then(setApple);
  }, []);

  const signedIn = Boolean(userId);

  async function magicLink() {
    if (!hasSupabase) return Alert.alert('Not configured', 'Add your Supabase keys to .env (see SETUP.md).');
    try {
      await signInWithEmail(email);
      Alert.alert('Check your email', `We sent a magic link to ${email}.`);
    } catch (e) {
      Alert.alert('Sign-in failed', String((e as Error).message));
    }
  }
  const wrap = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (e) {
      Alert.alert('Sign-in failed', String((e as Error).message));
    }
  };

  return (
    <Screen>
      <Row style={{ gap: 13, marginVertical: 4 }}>
        <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: '#4263eb', alignItems: 'center', justifyContent: 'center' }}>
          <T size={24}>👤</T>
        </View>
        <View>
          <T size={17} weight="800">{signedIn ? 'Signed in' : 'Guest'}</T>
          <T muted size={12}>{signedIn ? 'Synced across devices ✓' : 'Progress saved on this device'}</T>
        </View>
      </Row>

      <Card style={{ backgroundColor: '#3b2da8', borderColor: 'transparent' }}>
        <Row>
          <T size={20}>💎</T>
          <T color="#fff" weight="800" size={15}>FieldNotes Pro</T>
          <View style={{ flex: 1 }} />
          <T color="#dcd7ff" weight="800" size={11}>{unlocked ? 'Active ✓' : 'Free'}</T>
        </Row>
        {!unlocked && (
          <>
            <T color="#dcd7ff" size={12.5} style={{ marginTop: 8, lineHeight: 18 }}>
              Browse free. Pro adds the weekly &ldquo;stay current&rdquo; fresh stream, unlimited cards,
              and smart weak-spot scheduling.
            </T>
            <Row style={{ marginTop: 10, alignItems: 'baseline', gap: 6 }}>
              <T color="#fff" size={26} weight="900">{SUB_YEARLY_PER_MONTH}</T>
              <T color="#dcd7ff" size={13} weight="700">/mo · billed yearly</T>
            </Row>
            <Btn label="See plans →" style={{ marginTop: 12 }} onPress={() => router.push('/paywall')} />
          </>
        )}
      </Card>

      {PACKS.length > 0 && (
        <>
          <H2>Packs</H2>
          <Card style={{ gap: 0, padding: 0 }}>
            {PACKS.map((p, i) => {
              const has = !!owned[p.id];
              return (
                <Row
                  key={p.id}
                  style={{ paddingVertical: 12, paddingHorizontal: 15, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                  <View style={{ flex: 1 }}>
                    <T size={13.5} weight="700">{p.title}</T>
                    <T muted size={11.5}>{p.blurb}</T>
                  </View>
                  {has ? (
                    <T weight="800" size={12} color={c.success}>Owned ✓</T>
                  ) : (
                    <Btn
                      label={p.priceLabel}
                      variant="ghost"
                      style={{ paddingVertical: 8, paddingHorizontal: 14 }}
                      onPress={() => router.push(`/paywall?pack=${p.id}`)}
                    />
                  )}
                </Row>
              );
            })}
          </Card>
        </>
      )}

      <H2>Account</H2>
      <Card>
        {signedIn ? (
          <Row>
            <T size={15}>✅</T>
            <T size={12.5} weight="600" style={{ flex: 1 }}>Signed in &amp; syncing</T>
            <Btn label="Sign out" variant="ghost" onPress={wrap(signOut)} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
          </Row>
        ) : (
          <View style={{ gap: 10 }}>
            <T muted size={12.5}>Sign in to sync your streak across devices. Optional.</T>
            <TextInput
              placeholder="you@email.com"
              placeholderTextColor={c.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ borderWidth: 2, borderColor: c.border, borderRadius: radius.md, padding: 12, color: c.fg, backgroundColor: c.surface }}
            />
            <Btn label="Email me a magic link" variant="ghost" onPress={magicLink} />
            <Btn label=" Sign in with Apple" variant="navy" onPress={wrap(signInWithApple)} style={{ opacity: apple ? 1 : 0.45 }} />
            <Btn label="G  Sign in with Google" variant="ghost" onPress={wrap(signInWithGoogle)} />
            {!hasSupabase && (
              <T muted size={11} style={{ textAlign: 'center' }}>Add Supabase keys to .env to enable sign-in.</T>
            )}
          </View>
        )}
      </Card>

      <H2>Settings</H2>
      <Card style={{ gap: 0, padding: 0 }}>
        <ToggleRow
          icon="🔔"
          label="Daily reminder"
          sub="One gentle cue — a senior tell, not streak guilt"
          value={reminders}
          onValueChange={setReminders}
          first
        />
        <ToggleRow
          icon="🔊"
          label="Sound effects"
          sub="Tap, correct, and celebration cues"
          value={sound}
          onValueChange={setSound}
        />
        <ToggleRow
          icon="📳"
          label="Haptics"
          sub="Subtle vibration feedback on taps & answers"
          value={haptics}
          onValueChange={setHaptics}
        />
        <ToggleRow
          icon="🎮"
          label="Playful mode"
          sub="Mascot &amp; big celebrations. Off keeps it minimal &amp; senior-focused."
          value={playful}
          onValueChange={setPlayful}
        />
        <NavRow icon="♻️" label="Restore purchase" onPress={() => void restore()} />
        <SettingRow icon="◐" label="Theme" right="System" />
        <SettingRow icon="ℹ️" label="About" right="v1.0" />
        {__DEV__ && (
          <ToggleRow
            icon="🛠️"
            label="Developer view"
            sub="Reveal every stage unlocked &amp; preview all questions. Dev builds only."
            value={devMode}
            onValueChange={setDevMode}
          />
        )}
        {__DEV__ && (
          <NavRow
            icon="🔁"
            label="Restart onboarding"
            onPress={() => {
              restartOnboarding();
              router.replace('/onboarding');
            }}
          />
        )}
      </Card>
      <T muted size={11} style={{ textAlign: 'center' }}>The web workbench (live coding + AI coach) is a separate plan.</T>
    </Screen>
  );
}

function IconBox({ icon }: { icon: string }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
      <T size={15}>{icon}</T>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onValueChange,
  first,
}: {
  icon: string;
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  first?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Row style={{ paddingVertical: 11, paddingHorizontal: 15, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <IconBox icon={icon} />
      <View style={{ flex: 1 }}>
        <T size={13.5} weight="600">{label}</T>
        {sub ? <T muted size={11} style={{ lineHeight: 15 }}>{sub}</T> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </Row>
  );
}

function NavRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Row style={{ paddingVertical: 13, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: c.border }}>
        <IconBox icon={icon} />
        <T size={13.5} weight="600" style={{ flex: 1 }}>{label}</T>
        <T muted size={12.5} weight="700">›</T>
      </Row>
    </Pressable>
  );
}

function SettingRow({ icon, label, right }: { icon: string; label: string; right: string }) {
  const { c } = useTheme();
  return (
    <Row style={{ paddingVertical: 13, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: c.border }}>
      <IconBox icon={icon} />
      <T size={13.5} weight="600" style={{ flex: 1 }}>{label}</T>
      <T muted size={12.5} weight="700">{right}</T>
    </Row>
  );
}
