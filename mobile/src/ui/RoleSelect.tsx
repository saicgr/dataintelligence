/**
 * Searchable role combobox — a compact field that shows the current role and, when
 * tapped, expands into a search box + filtered list. Used by onboarding so first-run
 * doesn't dump the whole ~40-role catalog as a long scroll of chips.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { haptic } from '../lib/feedback';
import { ROLES, roleByKey } from '../lib/roles';
import { radius, useTheme } from '../lib/theme';
import { T } from './kit';

export function RoleSelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const { c, scheme } = useTheme();
  const dark = scheme === 'dark';
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = roleByKey(value);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ROLES;
    return ROLES.filter(
      (r) => r.name.toLowerCase().includes(needle) || r.family.toLowerCase().includes(needle) || r.blurb.toLowerCase().includes(needle),
    );
  }, [q]);

  const fieldBg = dark ? 'rgba(255,255,255,0.06)' : '#fff';

  return (
    <View style={{ gap: 8 }}>
      {/* The field */}
      <Pressable
        onPress={() => {
          haptic.selection();
          setOpen((o) => !o);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          borderWidth: 1.5,
          borderColor: open ? c.fg : c.border,
          backgroundColor: fieldBg,
          borderRadius: radius.md,
          paddingVertical: 13,
          paddingHorizontal: 13,
        }}>
        <T size={17}>{selected?.emoji ?? '🌐'}</T>
        <View style={{ flex: 1 }}>
          <T weight="800" size={14.5}>
            {selected?.name ?? 'Pick a role'}
          </T>
          {selected ? (
            <T muted size={11.5} style={{ marginTop: 1 }}>
              {selected.family} · {selected.blurb}
            </T>
          ) : null}
        </View>
        <T size={13} color={c.muted}>
          {open ? '▲' : '▼'}
        </T>
      </Pressable>

      {/* The dropdown */}
      {open ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingHorizontal: 11,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}>
            <T size={13} color={c.muted}>
              🔍
            </T>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search roles…"
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              clearButtonMode="while-editing"
              style={{ flex: 1, paddingVertical: 11, color: c.fg, fontSize: 14 }}
            />
          </View>
          <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <T muted size={13} style={{ padding: 14 }}>
                No roles match “{q.trim()}”.
              </T>
            ) : (
              results.map((r) => {
                const on = r.key === value;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => {
                      haptic.selection();
                      onChange(r.key);
                      setQ('');
                      setOpen(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 11,
                      paddingHorizontal: 13,
                      backgroundColor: on ? (dark ? 'rgba(255,255,255,0.07)' : '#f1f3f5') : 'transparent',
                    }}>
                    <T size={16}>{r.emoji}</T>
                    <View style={{ flex: 1 }}>
                      <T weight={on ? '800' : '700'} size={13.5}>
                        {r.name}
                        {r.tag ? (
                          <T size={9} weight="900" color={c.accentInk}>
                            {'  '}
                            {r.tag === 'rising' ? '↑ RISING' : 'NEW'}
                          </T>
                        ) : null}
                      </T>
                      <T muted size={11} style={{ marginTop: 1 }}>
                        {r.family} · {r.blurb}
                      </T>
                    </View>
                    {on ? (
                      <T size={14} color={c.success}>
                        ✓
                      </T>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
