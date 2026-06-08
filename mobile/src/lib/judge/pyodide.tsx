/**
 * Pyodide runner for the Python + PySpark judges (plan GAP 1, phases 2–3).
 *
 * Runs user Python in a hidden WebView via Pyodide (Python compiled to WASM). Grading stays
 * deterministic output-match (no AI): we run setup + user code + a serializer that prints the
 * `result` in the canonical 'a|b\n…' form, then compare to the problem's `expected`.
 *
 * PySpark can't run a real JVM/Spark on a phone, so `SPARK_SHIM` maps the common DataFrame ops
 * (createDataFrame, groupBy/agg with sum|count, orderBy, select) onto pandas and registers a fake
 * `pyspark.sql.functions` module so `from pyspark.sql.functions import sum, col` resolves. Ops the
 * shim doesn't cover surface as an error → the Code Lab shows the Web-Pro deep-link fallback.
 *
 * Offline: jsDelivr serves Pyodide from IMMUTABLE versioned URLs, and the WebView caches them
 * (cacheEnabled + LOAD_CACHE_ELSE_NETWORK on Android, URLCache on iOS). So the FIRST Python/PySpark
 * run needs a connection; every run after that works offline from cache. (Bundling pandas in-app
 * would add ~50MB to the binary, so cache-after-first-run is the deliberate tradeoff. SQL is fully
 * offline via expo-sqlite.) On load/exec failure every call resolves to an error the Code Lab
 * renders gracefully (with the Web-Pro deep-link fallback).
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { CodeProblem } from '../codeProblems';
import { type JudgeResult, normalize } from './index';

const PYODIDE_VERSION = 'v0.27.2';

/** Prints `result` in canonical form. Handles the shim DataFrame, pandas DataFrame/Series, scalars. */
const SERIALIZER = `
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
const SPARK_SHIM = `
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

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>
<script src="https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js"></script>
<script>
  var ready = (async function () {
    self.pyodide = await loadPyodide();
    await self.pyodide.loadPackage(['pandas']);
  })();
  function post(o){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  window.__run = async function (payload) {
    var msg = JSON.parse(payload);
    try { await ready; } catch (e) { return post({ id: msg.id, error: 'Failed to load Python runtime.' }); }
    var out = '';
    try { self.pyodide.setStdout({ batched: function (s) { out += s + '\\n'; } }); } catch (e) {}
    try {
      await self.pyodide.runPythonAsync(msg.program);
      post({ id: msg.id, stdout: out });
    } catch (err) {
      post({ id: msg.id, error: String((err && err.message) || err) });
    }
  };
  post({ ready: true });
</script>
</body></html>`;

export interface PyodideHandle {
  run: (program: string) => Promise<{ stdout?: string; error?: string }>;
}

type Pending = { resolve: (v: { stdout?: string; error?: string }) => void };

/**
 * Hidden WebView host. Mount once in the Code Lab; call `ref.run(program)` to execute Python and
 * get back stdout/error. Promise-bridged by message id.
 */
export const PyodideHost = forwardRef<PyodideHandle, object>(function PyodideHost(_props, ref) {
  const webRef = useRef<WebView>(null);
  const pending = useRef<Map<string, Pending>>(new Map());
  const seq = useRef(0);

  useImperativeHandle(ref, () => ({
    run(program: string) {
      return new Promise<{ stdout?: string; error?: string }>((resolve) => {
        const id = `r${seq.current++}`;
        pending.current.set(id, { resolve });
        const payload = JSON.stringify({ id, program });
        webRef.current?.injectJavaScript(`window.__run(${JSON.stringify(payload)}); true;`);
      });
    },
  }));

  return (
    <View style={{ width: 0, height: 0 }} pointerEvents="none">
      <WebView
        ref={webRef}
        source={{ html: HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        // Cache Pyodide's immutable CDN assets so runs after the first work offline.
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        onMessage={(e) => {
          let data: { id?: string; stdout?: string; error?: string; ready?: boolean };
          try {
            data = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (!data.id) return; // 'ready' ping
          const p = pending.current.get(data.id);
          if (p) {
            pending.current.delete(data.id);
            p.resolve({ stdout: data.stdout, error: data.error });
          }
        }}
      />
    </View>
  );
});

/** Turn a runner result into a JudgeResult by output-matching against `expected`. */
export function judgeFromStdout(problem: CodeProblem, res: { stdout?: string; error?: string }): JudgeResult {
  if (res.error) return { ok: false, error: res.error };
  const actual = normalize(res.stdout ?? '');
  return { ok: actual === normalize(problem.expected), actual };
}
