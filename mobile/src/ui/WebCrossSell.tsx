import { Linking, Pressable, View } from 'react-native';

import { WebX } from '../lib/content';
import { ENV } from '../lib/env';
import { radius, useTheme } from '../lib/theme';
import { T } from './kit';

/**
 * The honest boundary: mobile builds the MOVES; the live "type the query/prompt,
 * Run it against a real DB/model, get AI-graded with follow-ups" rep lives on the
 * web app. Diagnostic + querybuild cards close on this deep-link.
 */
export function WebCrossSell({ webx }: { webx: WebX }) {
  const { c, track, scheme } = useTheme();
  const link = track('rag');
  // Lands on the real web /practice browser (no per-id route exists); the problemId is a
  // hint param the browser can auto-select on. Falls back gracefully to the practice page.
  const open = () =>
    Linking.openURL(`${ENV.webUrl}/practice?problem=${encodeURIComponent(webx.problemId)}&utm=mobile_lesson`);
  return (
    <Pressable
      onPress={open}
      style={{
        marginTop: 14,
        backgroundColor: scheme === 'dark' ? 'rgba(112,72,232,.12)' : 'rgba(112,72,232,.07)',
        borderRadius: radius.md,
        padding: 13,
      }}>
      <T size={12.5} style={{ lineHeight: 19 }}>
        🖥️ {webx.blurb}
      </T>
      <View style={{ marginTop: 7 }}>
        <T weight="800" size={13} color={link}>
          Open in Web →
        </T>
      </View>
    </Pressable>
  );
}
