import { Pressable, View } from 'react-native';

import { ChoiceOption } from '../lib/content';
import { answerFeedback } from '../lib/feedback';
import { radius, useTheme } from '../lib/theme';
import { T } from './kit';

/**
 * Shared A/B/C option list with reveal coloring + per-distractor "why".
 * Reused by EvidenceView, DiagView, QueryBuildView, and the extended choice card.
 */
export function OptionList({
  opts,
  chosen,
  revealed,
  onChoose,
}: {
  opts: ChoiceOption[];
  chosen: number | null;
  revealed: boolean;
  onChoose: (i: number) => void;
}) {
  const { c, scheme } = useTheme();
  return (
    <View style={{ gap: 9, marginTop: 4 }}>
      {opts.map((o, i) => {
        let bd = c.border;
        let bg = c.card;
        if (revealed) {
          if (o.ok) {
            bd = c.success;
            bg = scheme === 'dark' ? 'rgba(63,185,80,.10)' : 'rgba(26,158,87,.10)';
          } else if (i === chosen) {
            bd = c.danger;
            bg = scheme === 'dark' ? 'rgba(248,81,73,.10)' : 'rgba(232,69,60,.09)';
          }
        }
        const dim = revealed && !o.ok && i !== chosen;
        return (
          <View key={i}>
            <Pressable
              disabled={revealed}
              onPress={() => {
                answerFeedback(!!o.ok);
                onChoose(i);
              }}
              style={{
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
                borderWidth: 2,
                borderColor: bd,
                backgroundColor: bg,
                borderRadius: radius.md,
                padding: 12,
                opacity: dim ? 0.5 : 1,
              }}>
              <View
                style={{
                  width: 23,
                  height: 23,
                  borderRadius: 7,
                  backgroundColor: c.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <T weight="800" size={12}>
                  {String.fromCharCode(65 + i)}
                </T>
              </View>
              <T size={13} style={{ flex: 1, lineHeight: 18 }}>
                {o.t}
              </T>
            </Pressable>
            {revealed && o.why ? (
              <T size={11.5} color={c.muted} style={{ marginTop: 4, marginLeft: 6, lineHeight: 16 }}>
                {o.why}
              </T>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
