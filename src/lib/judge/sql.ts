/**
 * SQL judge — fully offline, deterministic. Spins up a throwaway in-memory SQLite DB
 * (expo-sqlite, SDK 56 sync API), runs the problem's setup DDL, executes the user's query,
 * serializes the result rows to the canonical form, and output-matches against `expected`.
 *
 * Values are compared (column names ignored, row order preserved) — see judge/index.ts. No AI.
 */
import * as SQLite from 'expo-sqlite';

import type { CodeProblem } from '../codeProblems';
import { type JudgeResult, normalize, serializeRows } from './index';

export function judgeSql(problem: CodeProblem, userSql: string): JudgeResult {
  const code = userSql.trim().replace(/;\s*$/, '');
  if (!code) return { ok: false, error: 'Write a query first.' };

  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = SQLite.openDatabaseSync(':memory:');
    db.execSync(problem.setup);
    const rows = db.getAllSync(code) as Record<string, unknown>[];
    const actual = normalize(serializeRows(rows.map((r) => Object.values(r))));
    const ok = actual === normalize(problem.expected);
    return { ok, actual };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    try {
      db?.closeSync();
    } catch {
      /* ignore */
    }
  }
}
