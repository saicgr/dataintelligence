/**
 * Pyodide runner — WEB host. Same exported surface as pyodide.tsx, but no WebView
 * (react-native-webview has no web implementation, so the native host can't even mount
 * in a browser). Loads single-threaded Pyodide straight onto the page via a <script> tag —
 * no SharedArrayBuffer, no cross-origin isolation, works under `expo start --web` and any
 * plain static host. The browser HTTP cache keeps the immutable jsDelivr assets after the
 * first run, mirroring the native WebView cache behavior.
 */
import { forwardRef, useImperativeHandle } from 'react';

import { PYODIDE_VERSION, type PyodideHandle } from './pyProgram';

export { buildProgram, judgeFromStdout, type PyodideHandle } from './pyProgram';

type Pyodide = {
  loadPackage: (pkgs: string[]) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
};

declare global {
  interface Window {
    loadPyodide?: (opts?: object) => Promise<Pyodide>;
  }
}

// Module-level singleton so the runtime survives Editor remounts; reset on failure so retry works.
let pyodideP: Promise<Pyodide> | null = null;

function loadScriptOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.loadPyodide) return resolve();
    const s = document.createElement('script');
    s.src = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Python runtime.'));
    document.head.appendChild(s);
  });
}

function pyodideOnce(): Promise<Pyodide> {
  if (!pyodideP) {
    pyodideP = loadScriptOnce()
      .then(async () => {
        const py = await window.loadPyodide!();
        await py.loadPackage(['pandas']);
        return py;
      })
      .catch((e) => {
        pyodideP = null; // allow a later Run to retry the load
        throw e;
      });
  }
  return pyodideP;
}

/** Drop-in for the native PyodideHost: renders nothing, `ref.run(program)` executes Python. */
export const PyodideHost = forwardRef<PyodideHandle, object>(function PyodideHost(_props, ref) {
  useImperativeHandle(ref, () => ({
    async run(program: string) {
      let py: Pyodide;
      try {
        py = await pyodideOnce();
      } catch {
        return { error: 'Failed to load Python runtime — check your connection.' };
      }
      let out = '';
      try {
        py.setStdout({ batched: (s) => (out += s + '\n') });
      } catch {
        /* ignore */
      }
      try {
        await py.runPythonAsync(program);
        return { stdout: out };
      } catch (err) {
        return { error: String((err as Error)?.message || err) };
      }
    },
  }));
  return null;
});
