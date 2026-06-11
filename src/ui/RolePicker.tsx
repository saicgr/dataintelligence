/**
 * The role catalog picker — ROLES grouped by family as selectable chips.
 * Reused by onboarding (first run) and the Learn settings panel.
 */
import { Pressable, View } from 'react-native';

import { haptic } from '../lib/feedback';
import { ROLE_FAMILIES, ROLES } from '../lib/roles';
import { useTheme } from '../lib/theme';
import { T } from './kit';

export function RolePicker({ value, onChange, query = '' }: { value: string; onChange: (key: string) => void; query?: string }) {
  const { c, track } = useTheme();
  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const families = ROLE_FAMILIES.filter((f) => ROLES.some((r) => r.family === f && matches(r.name)));
  if (families.length === 0) {
    return <T muted size={13}>No roles match “{query.trim()}”.</T>;
  }
  return (
    <View style={{ gap: 14 }}>
      {families.map((fam) => (
        <View key={fam} style={{ gap: 7 }}>
          <T weight="800" size={11} color={c.muted} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {fam}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {ROLES.filter((r) => r.family === fam && matches(r.name)).map((r) => {
              const on = r.key === value;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => {
                    haptic.selection();
                    onChange(r.key);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    borderWidth: 1.5,
                    borderColor: on ? c.fg : c.border,
                    backgroundColor: on ? c.fg : c.card,
                    borderRadius: 999,
                    paddingVertical: 7,
                    paddingHorizontal: 11,
                  }}>
                  <T size={13}>{r.emoji}</T>
                  <T weight="700" size={12} color={on ? c.card : c.fg}>
                    {r.name}
                  </T>
                  {r.tag ? (
                    <T size={8.5} weight="900" color={on ? c.card : track('rag')}>
                      {r.tag === 'rising' ? '↑' : 'NEW'}
                    </T>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
