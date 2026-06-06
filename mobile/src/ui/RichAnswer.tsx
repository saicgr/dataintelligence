import { Text } from 'react-native';

import { mono, useTheme } from '../lib/theme';

type Part = { t: string; kind: 'plain' | 'code' | 'bold' | 'term' };

/**
 * Curated high-signal data/AI-engineering terms worth highlighting so answers scan fast
 * and the key concepts stick. Longer phrases are matched first. Case-insensitive.
 * (CamelCase + ALL-CAPS terms — DataFrame, RDD, AQE — are caught separately, below.)
 */
const KEY_TERMS = [
  // data engineering — multi-word first
  'lazy evaluation', 'predicate pushdown', 'partition pruning', 'materialized view',
  'window function', 'broadcast join', 'garbage collection', 'out of memory',
  'slowly changing dimension', 'high-water mark', 'late data', 'consumer group',
  'partition key', 'hot key', 'star schema', 'fact table', 'dimension table',
  'anti-join', 'full table scan', 'write amplification', 'data skew', 'exactly-once',
  'at-least-once', 'not exists', 'not in', 'group by', 'order by',
  // single words
  'catalyst', 'shuffle', 'spill', 'skew', 'broadcast', 'repartition', 'partition',
  'idempotent', 'idempotency', 'watermark', 'backfill', 'overwrite', 'dedup',
  'deduplicate', 'normalization', 'denormalize', 'incremental', 'lookback', 'offset',
  'rebalance', 'throughput', 'latency', 'snowflake', 'kafka', 'airflow', 'databricks',
  'pyspark', 'spark',
  // ai engineering
  'prompt injection', 'structured output', 'json schema', 'few-shot', 'fine-tune',
  'fine-tuning', 'vector database', 'cosine similarity', 'context window',
  'prompt caching', 'tool calling', 're-ranker', 'reranking', 'grounding',
  'faithfulness', 'hallucination', 'embedding', 'chunking', 'retrieval', 'temperature',
  'guardrail', 'relational division',
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TERM_RE = new RegExp(
  `(\`[^\`]+\`|\\*\\*[^*]+\\*\\*|\\b(?:${[...KEY_TERMS].sort((a, b) => b.length - a.length).map(esc).join('|')})\\b)`,
  'gi'
);
// CamelCase (DataFrame, OutOfMemoryError) + ALL-CAPS acronyms (RDD, SQL, AQE, NULL).
const CAPS_RE = /\b(?:[A-Z][a-z]+(?:[A-Z][a-z]+)+|[A-Z]{2,})\b/g;

function pushCaps(seg: string, parts: Part[]) {
  let last = 0;
  let m: RegExpExecArray | null;
  CAPS_RE.lastIndex = 0;
  while ((m = CAPS_RE.exec(seg))) {
    if (m.index > last) parts.push({ t: seg.slice(last, m.index), kind: 'plain' });
    parts.push({ t: m[0], kind: 'term' });
    last = m.index + m[0].length;
  }
  if (last < seg.length) parts.push({ t: seg.slice(last), kind: 'plain' });
}

function tokenize(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TERM_RE.lastIndex = 0;
  while ((m = TERM_RE.exec(text))) {
    if (m.index > last) pushCaps(text.slice(last, m.index), parts);
    const tok = m[0];
    if (tok.startsWith('`')) parts.push({ t: tok.slice(1, -1), kind: 'code' });
    else if (tok.startsWith('**')) parts.push({ t: tok.slice(2, -2), kind: 'bold' });
    else parts.push({ t: tok, kind: 'term' });
    last = m.index + tok.length;
  }
  if (last < text.length) pushCaps(text.slice(last), parts);
  return parts;
}

/**
 * Answer prose at normal weight, with the key concepts highlighted (a soft marker tint)
 * so users can scan and remember — plus inline `code` and **bold** support.
 */
export function RichAnswer({ text, size = 13, color }: { text: string; size?: number; color?: string }) {
  const { c, track, scheme } = useTheme();
  const base = color ?? c.fg;
  const hl = track('rag');
  const tint = scheme === 'dark' ? hl + '2b' : hl + '1c';
  return (
    <Text style={{ color: base, fontSize: size, lineHeight: size * 1.65, fontWeight: '400' }}>
      {tokenize(text).map((p, i) => {
        if (p.kind === 'code')
          return (
            <Text key={i} style={{ fontFamily: mono, color: hl, fontSize: size - 0.5 }}>
              {p.t}
            </Text>
          );
        if (p.kind === 'bold')
          return (
            <Text key={i} style={{ fontWeight: '800' }}>
              {p.t}
            </Text>
          );
        if (p.kind === 'term')
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
