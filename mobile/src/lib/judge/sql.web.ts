/**
 * SQL judge — web variant. Same contract as sql.ts, but uses expo-sqlite's ASYNC API:
 * the sync API's web WorkerChannel blocks on SharedArrayBuffer + Atomics, which requires
 * cross-origin isolation (COOP/COEP headers) that neither `expo start --web` nor plain
 * static hosting provides. The async path is ordinary worker postMessage — runs anywhere.
 *
 * Values are compared (column names ignored, row order preserved) — see judge/index.ts. No AI.
 */
import * as SQLite from 'expo-sqlite';

import type { CodeProblem } from '../codeProblems';
import { type JudgeResult, normalize, serializeRows } from './index';

export async function judgeSql(problem: CodeProblem, userSql: string): Promise<JudgeResult> {
  const code = userSql.trim().replace(/;\s*$/, '');
  if (!code) return { ok: false, error: 'Write a query first.' };

  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = await SQLite.openDatabaseAsync(':memory:');
    await db.execAsync(problem.setup);
    const rows = (await db.getAllAsync(code)) as Record<string, unknown>[];
    const actual = normalize(serializeRows(rows.map((r) => Object.values(r))));
    const ok = actual === normalize(problem.expected);
    return { ok, actual };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    try {
      await db?.closeAsync();
    } catch {
      /* ignore */
    }
  }
}
