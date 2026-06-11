/**
 * SQL judge — web variant. Same contract as sql.ts, but does NOT use expo-sqlite:
 * its web build (sync AND async API) rides a wa-sqlite worker that needs
 * SharedArrayBuffer/Atomics, i.e. cross-origin isolation (COOP/COEP headers) that neither
 * `expo start --web` nor plain static hosting provides — Run threw
 * "SharedArrayBuffer is not defined". Instead we load sql.js (single-threaded WASM SQLite,
 * no SAB) from the CDN once, mirroring how pyodide.web.tsx loads the Python runtime.
 *
 * Values are compared (column names ignored, row order preserved) — see judge/index.ts. No AI.
 */
import type { CodeProblem } from '../codeProblems';
import { type JudgeResult, normalize, serializeRows } from './index';

const SQLJS_CDN = 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist';

interface SqlJsDb {
  run: (sql: string) => void;
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[];
  close: () => void;
}
interface SqlJsStatic {
  Database: new () => SqlJsDb;
}

declare global {
  interface Window {
    initSqlJs?: (cfg?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

// Module-level singleton (the WASM init is ~1MB); reset on failure so a later Run can retry.
let sqlJsP: Promise<SqlJsStatic> | null = null;

function loadScriptOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.initSqlJs) return resolve();
    const s = document.createElement('script');
    s.src = `${SQLJS_CDN}/sql-wasm.js`;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load the SQL runtime.'));
    document.head.appendChild(s);
  });
}

function sqlJsOnce(): Promise<SqlJsStatic> {
  if (!sqlJsP) {
    sqlJsP = loadScriptOnce()
      .then(() => window.initSqlJs!({ locateFile: (file) => `${SQLJS_CDN}/${file}` }))
      .catch((e) => {
        sqlJsP = null; // allow a later Run to retry the load
        throw e;
      });
  }
  return sqlJsP;
}

export async function judgeSql(problem: CodeProblem, userSql: string): Promise<JudgeResult> {
  const code = userSql.trim().replace(/;\s*$/, '');
  if (!code) return { ok: false, error: 'Write a query first.' };

  let SQL: SqlJsStatic;
  try {
    SQL = await sqlJsOnce();
  } catch {
    return { ok: false, error: 'Failed to load the SQL runtime — check your connection and retry.' };
  }

  const db = new SQL.Database();
  try {
    db.run(problem.setup);
    const res = db.exec(code);
    const rows = res.length ? res[res.length - 1].values : [];
    const actual = normalize(serializeRows(rows));
    const ok = actual === normalize(problem.expected);
    return { ok, actual };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}
