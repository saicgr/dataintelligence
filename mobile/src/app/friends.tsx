import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, TextInput, View } from 'react-native';

import { alertInfo, confirmAsync } from '../lib/dialog';
import { acceptInvite, Friend, inviteCodeFor, listFriends, removeFriend } from '../lib/friends';
import { hasSupabase } from '../lib/env';
import { haptic } from '../lib/feedback';
import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Btn, Card, Chip, H2, Row, Screen, T } from '../ui/kit';

const REASON_COPY: Record<string, string> = {
  unconfigured: 'Sync isn’t configured on this build.',
  'not-signed-in': 'Sign in first to add friends.',
  self: 'That’s your own code — share it with a friend instead.',
  'not-found': 'No one matches that code. Double-check it.',
  already: 'You’re already friends with them.',
  error: 'Something went wrong. Try again.',
};

export default function Friends() {
  const { c } = useTheme();
  const router = useRouter();
  const userId = useStore((s) => s.userId);
  const signedIn = Boolean(userId);
  const myCode = inviteCodeFor(userId);

  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [code, setCode] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listFriends(userId);
    setFriends(list);
  }, [userId]);

  useEffect(() => {
    if (signedIn) void refresh();
    else setFriends([]);
  }, [signedIn, refresh]);

  async function shareCode() {
    if (!myCode) return;
    try {
      await Share.share({
        message: `Add me on FieldNotes — we’ll keep a study streak going. My invite code: ${myCode}`,
      });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  async function add() {
    const clean = code.trim().toUpperCase();
    if (!clean || adding) return;
    setAdding(true);
    const res = await acceptInvite(userId, clean);
    setAdding(false);
    if (res.ok) {
      haptic.success();
      setCode('');
      await refresh();
    } else {
      alertInfo('Couldn’t add friend', REASON_COPY[res.reason] ?? REASON_COPY.error);
    }
  }

  function confirmRemove(f: Friend) {
    void confirmAsync(
      'Remove friend?',
      `This ends your ${f.friendStreak}-day shared streak with ${f.name}.`,
      'Remove'
    ).then(async (ok) => {
      if (!ok) return;
      await removeFriend(userId, f.friendId);
      await refresh();
    });
  }

  return (
    <Screen>
      <Pressable onPress={() => safeBack(router)}>
        <T muted weight="700" size={13}>
          ‹ Close
        </T>
      </Pressable>

      <H2>Friends</H2>

      {!signedIn ? (
        <Card style={{ gap: 12, alignItems: 'center' }}>
          <T size={34}>👥</T>
          <T size={15} weight="800" style={{ textAlign: 'center' }}>
            Study with friends
          </T>
          <T muted size={12.5} style={{ textAlign: 'center', lineHeight: 18 }}>
            Sign in to swap invite codes and grow a shared streak — you both keep it alive by
            studying on the same day. Sign-in lives in the Account section of your Profile.
          </T>
          <Btn label="Open Account settings →" onPress={() => router.push('/profile')} style={{ alignSelf: 'stretch' }} />
        </Card>
      ) : (
        <>
          {/* Your invite code */}
          <Card style={{ gap: 10 }}>
            <T muted size={11.5} weight="800" style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Your invite code
            </T>
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={26} weight="900" style={{ letterSpacing: 3 }} color={c.accentInk}>
                {myCode}
              </T>
              <Btn label="Share" variant="navy" onPress={shareCode} style={{ paddingVertical: 9, paddingHorizontal: 18 }} />
            </Row>
            <T muted size={11.5} style={{ lineHeight: 16 }}>
              Send this to a friend. When you both study on the same day, your shared streak grows.
            </T>
          </Card>

          {/* Add by code */}
          <Card style={{ gap: 10 }}>
            <T muted size={11.5} weight="800" style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Add a friend
            </T>
            <Row style={{ gap: 8 }}>
              <TextInput
                placeholder="Enter their code"
                placeholderTextColor={c.muted}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                onSubmitEditing={add}
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: c.border,
                  borderRadius: radius.md,
                  padding: 12,
                  color: c.fg,
                  backgroundColor: c.surface,
                  fontWeight: '800',
                  letterSpacing: 2,
                }}
              />
              <Btn label={adding ? '…' : 'Add'} onPress={add} disabled={!code.trim() || adding} style={{ paddingHorizontal: 20 }} />
            </Row>
            {!hasSupabase && (
              <T muted size={11} style={{ textAlign: 'center' }}>
                Sync isn’t configured on this build — friends won’t persist.
              </T>
            )}
          </Card>

          {/* Friend list */}
          <H2>Your streaks</H2>
          {friends === null ? (
            <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator color={c.muted} />
            </Card>
          ) : friends.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
              <T size={26}>🤝</T>
              <T muted size={12.5} style={{ textAlign: 'center' }}>
                No friends yet. Share your code to get started.
              </T>
            </Card>
          ) : (
            <Card style={{ gap: 0, padding: 0 }}>
              {friends.map((f, i) => (
                <Row
                  key={f.friendId}
                  style={{ paddingVertical: 13, paddingHorizontal: 15, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: c.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <T size={15} weight="900">
                      {f.name.slice(0, 2)}
                    </T>
                  </View>
                  <View style={{ flex: 1, marginLeft: 4 }}>
                    <T size={14} weight="800">
                      {f.name}
                    </T>
                    <T muted size={11.5}>
                      🔥 {f.friendStreak}-day shared streak
                    </T>
                  </View>
                  {f.activeToday ? <Chip label="Kept today ✓" kind="green" /> : <Chip label="Waiting on today" kind="amber" />}
                  <Pressable onPress={() => confirmRemove(f)} hitSlop={10} style={{ paddingLeft: 6 }}>
                    <T muted size={16} weight="800">
                      ×
                    </T>
                  </Pressable>
                </Row>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
