import { Text, View } from 'react-native';

import { mono, useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';

/**
 * Renders an answer authored in a light markdown subset so answers SCAN instead of
 * reading as a wall of prose:
 *   - blank-line-separated paragraphs
 *   - bullet lines ("- " / "• " / "* ")
 *   - numbered lines ("1. ")
 *   - fenced code blocks (```lang … ```) → real CodeBlock panel
 * Inline: `code` (backticks) and **highlight** (author-marked key terms — the only thing
 * highlighted, so the old CSV/URL/HTTP auto-highlight noise is gone).
 */
type Inline = { t: string; kind: 'plain' | 'code' | 'hl' };

const INLINE_RE = /(`[^`]+`|\*\*[^*]+\*\*)/g;

function inlineParts(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index), kind: 'plain' });
    const tok = m[0];
    if (tok.startsWith('`')) parts.push({ t: tok.slice(1, -1), kind: 'code' });
    else parts.push({ t: tok.slice(2, -2), kind: 'hl' });
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ t: text.slice(last), kind: 'plain' });
  return parts;
}

function InlineText({ text, size, base }: { text: string; size: number; base: string }) {
  const { track, scheme } = useTheme();
  const hl = track('rag');
  const tint = scheme === 'dark' ? hl + '2b' : hl + '1c';
  return (
    <Text style={{ color: base, fontSize: size, lineHeight: size * 1.6, fontWeight: '400' }}>
      {inlineParts(text).map((p, i) => {
        if (p.kind === 'code')
          return (
            <Text key={i} style={{ fontFamily: mono, color: hl, fontSize: size - 0.5 }}>
              {p.t}
            </Text>
          );
        if (p.kind === 'hl')
          return (
            <Text key={i} style={{ color: hl, fontWeight: '700', backgroundColor: tint }}>
              {p.t}
            </Text>
          );
        return <Text key={i}>{p.t}</Text>;
      })}
    </Text>
  );
}

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; lines: string[] };

const BULLET_RE = /^\s*[-•*]\s+(.*)$/;
const NUM_RE = /^\s*\d+[.)]\s+(.*)$/;
const FENCE_RE = /^\s*```/;

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ').trim() });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_RE.test(line)) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      if (code.length) blocks.push({ kind: 'code', lines: code });
      continue;
    }
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      flushPara();
      const last = blocks[blocks.length - 1];
      if (last && last.kind === 'ul') last.items.push(bullet[1]);
      else blocks.push({ kind: 'ul', items: [bullet[1]] });
      continue;
    }
    const num = line.match(NUM_RE);
    if (num) {
      flushPara();
      const last = blocks[blocks.length - 1];
      if (last && last.kind === 'ol') last.items.push(num[1]);
      else blocks.push({ kind: 'ol', items: [num[1]] });
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

export function RichAnswer({ text, size = 13, color }: { text: string; size?: number; color?: string }) {
  const { c } = useTheme();
  const base = color ?? c.fg;
  const blocks = parseBlocks(text || '');
  return (
    <View style={{ gap: 9 }}>
      {blocks.map((b, bi) => {
        if (b.kind === 'code') return <CodeBlock key={bi} lines={b.lines} />;
        if (b.kind === 'ul' || b.kind === 'ol')
          return (
            <View key={bi} style={{ gap: 6 }}>
              {b.items.map((it, ii) => (
                <View key={ii} style={{ flexDirection: 'row', gap: 8, paddingRight: 4 }}>
                  <Text style={{ color: c.muted, fontSize: size, lineHeight: size * 1.6, fontWeight: '700', minWidth: 16 }}>
                    {b.kind === 'ol' ? `${ii + 1}.` : '•'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <InlineText text={it} size={size} base={base} />
                  </View>
                </View>
              ))}
            </View>
          );
        return <InlineText key={bi} text={b.text} size={size} base={base} />;
      })}
    </View>
  );
}
