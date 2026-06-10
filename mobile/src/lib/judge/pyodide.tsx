/**
 * Pyodide runner for the Python + PySpark judges — NATIVE host (plan GAP 1, phases 2–3).
 * Web gets pyodide.web.tsx instead (react-native-webview has no web implementation).
 *
 * Runs user Python in a hidden WebView via Pyodide (Python compiled to WASM). Grading stays
 * deterministic output-match (no AI) — program assembly + result matching live in ./pyProgram.
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

import { PYODIDE_VERSION, type PyodideHandle } from './pyProgram';

export { buildProgram, judgeFromStdout, type PyodideHandle } from './pyProgram';

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
