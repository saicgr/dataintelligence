/**
 * Platform-neutral pieces of the Python/PySpark judge, shared by both Pyodide hosts:
 *   - pyodide.tsx      → native: Pyodide in a hidden WebView
 *   - pyodide.web.tsx  → web: Pyodide on the main page (no WebView on react-native-web)
 *
 * Grading stays deterministic output-match (no AI): setup + user code + a serializer that
 * prints the `result` in the canonical 'a|b\n…' form, compared against the problem's `expected`.
 */
import type { CodeProblem } from '../codeProblems';
import { type JudgeResult, normalize } from './index';

export const PYODIDE_VERSION = 'v0.27.2';

/** Prints `result` in canonical form. Handles the shim DataFrame, pandas DataFrame/Series, scalars. */
export const SERIALIZER = `
import pandas as _pd
def __fmt(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return '' if v is None else str(v)
def __emit(result):
    if hasattr(result, '_fieldnotes_rows'):
        rows = result._fieldnotes_rows()
    elif isinstance(result, _pd.DataFrame):
        rows = result.values.tolist()
    elif isinstance(result, _pd.Series):
        rows = [[v] for v in result.tolist()]
    else:
        rows = [[result]]
    print('\\n'.join('|'.join(__fmt(c) for c in r) for r in rows))
`;

/** pandas-backed PySpark shim — enough for groupBy/agg(sum|count)/orderBy/select problems. */
export const SPARK_SHIM = `
import sys, types
import pandas as pd

class _Col:
    def __init__(self, name, order='asc'):
        self.name = name; self._order = order
    def desc(self): return _Col(self.name, 'desc')
    def asc(self): return _Col(self.name, 'asc')

def col(name): return _Col(name)

class _Agg:
    def __init__(self, op, src): self.op = op; self.src = src; self._alias = None
    def alias(self, a): self._alias = a; return self
    @property
    def out(self): return self._alias or (self.op + '(' + self.src + ')')

def sum(c): return _Agg('sum', c)
def count(c): return _Agg('count', c)

class _Grouped:
    def __init__(self, pdf, keys): self._pdf = pdf; self._keys = keys
    def agg(self, *aggs):
        g = self._pdf.groupby(self._keys, sort=False)
        data = {}
        for a in aggs:
            if a.op == 'sum': data[a.out] = g[a.src].sum()
            elif a.op == 'count': data[a.out] = g[a.src].count()
            else: raise Exception('unsupported agg: ' + a.op)
        return _DF(pd.DataFrame(data).reset_index())

class _DF:
    def __init__(self, pdf): self._pdf = pdf.reset_index(drop=True)
    def groupBy(self, *cols): return _Grouped(self._pdf, list(cols))
    groupby = groupBy
    def orderBy(self, *cols):
        by = []; asc = []
        for c in cols:
            if isinstance(c, _Col): by.append(c.name); asc.append(c._order != 'desc')
            else: by.append(c); asc.append(True)
        return _DF(self._pdf.sort_values(by=by, ascending=asc))
    sort = orderBy
    def select(self, *cols):
        names = [c.name if isinstance(c, _Col) else c for c in cols]
        return _DF(self._pdf[names])
    def withColumnRenamed(self, a, b): return _DF(self._pdf.rename(columns={a: b}))
    def _fieldnotes_rows(self): return self._pdf.values.tolist()

class _Spark:
    def createDataFrame(self, data, cols): return _DF(pd.DataFrame(list(data), columns=cols))

spark = _Spark()

_fns = types.ModuleType('pyspark.sql.functions')
_fns.sum = sum; _fns.count = count; _fns.col = col
_pys = types.ModuleType('pyspark'); _psql = types.ModuleType('pyspark.sql')
sys.modules['pyspark'] = _pys
sys.modules['pyspark.sql'] = _psql
sys.modules['pyspark.sql.functions'] = _fns
`;

/** Assemble the full Python program for a problem (setup + user code + emit). */
export function buildProgram(problem: CodeProblem, userCode: string): string {
  const head = problem.lang === 'pyspark' ? SPARK_SHIM + '\n' + SERIALIZER : SERIALIZER;
  return `${head}\n${problem.setup}\n${userCode}\n__emit(result)\n`;
}

export interface PyodideHandle {
  run: (program: string) => Promise<{ stdout?: string; error?: string }>;
}

/** Turn a runner result into a JudgeResult by output-matching against `expected`. */
export function judgeFromStdout(problem: CodeProblem, res: { stdout?: string; error?: string }): JudgeResult {
  if (res.error) return { ok: false, error: res.error };
  const actual = normalize(res.stdout ?? '');
  return { ok: actual === normalize(problem.expected), actual };
}
