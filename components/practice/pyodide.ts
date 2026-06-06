"use client";

// Pyodide client — runs real Python in the browser (CPython compiled to WASM),
// loaded lazily from the CDN so it never touches the server bundle.
// Used to execute candidate Python + assert-based test cases for true pass/fail.

const PYODIDE_VERSION = "0.29.4";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/* eslint-disable @typescript-eslint/no-explicit-any */
let pyodidePromise: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Pyodide"));
    document.head.appendChild(s);
  });
}

async function getPyodide(): Promise<any> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    await loadScript(`${CDN}pyodide.js`);
    const w = window as any;
    return await w.loadPyodide({ indexURL: CDN });
  })();
  return pyodidePromise;
}

const loadedPkgs = new Set<string>();

/** Load scientific packages on demand (pandas/numpy) the first time code needs them. */
async function ensurePackages(py: any, code: string) {
  const want: string[] = [];
  if (/\b(pandas|pd)\b/.test(code) && !loadedPkgs.has("pandas")) want.push("pandas");
  if (/\b(numpy|np)\b/.test(code) && !loadedPkgs.has("numpy")) want.push("numpy");
  if (!want.length) return;
  try {
    await py.loadPackage(want);
    want.forEach((p) => loadedPkgs.add(p));
  } catch {
    /* package load failed — code will surface its own ImportError */
  }
}

export interface RunResult {
  output: string;
  error?: string;
}

export interface TestResult {
  name: string;
  ok: boolean;
  msg: string;
}

/** Run arbitrary Python, capturing stdout/stderr. */
export async function runPython(code: string): Promise<RunResult> {
  try {
    const py = await getPyodide();
    await ensurePackages(py, code);
    let out = "";
    py.setStdout({ batched: (s: string) => (out += s + "\n") });
    py.setStderr({ batched: (s: string) => (out += s + "\n") });
    await py.runPythonAsync(code);
    return { output: out };
  } catch (e: any) {
    return { output: "", error: String(e?.message ?? e) };
  }
}

const indent = (code: string) =>
  code
    .split("\n")
    .map((l) => "    " + l)
    .join("\n");

/** Run the candidate's code, then each test case; report per-test pass/fail. */
export async function runTests(
  code: string,
  tests: { name: string; code: string }[]
): Promise<{ results: TestResult[]; output: string; error?: string }> {
  let out = "";
  try {
    const py = await getPyodide();
    await ensurePackages(py, code + "\n" + tests.map((t) => t.code).join("\n"));
    py.setStdout({ batched: (s: string) => (out += s + "\n") });
    py.setStderr({ batched: (s: string) => (out += s + "\n") });

    const harness = `
import json
${code}

__results = []
def __run(name, fn):
    try:
        fn()
        __results.append({"name": name, "ok": True, "msg": ""})
    except Exception as e:
        __results.append({"name": name, "ok": False, "msg": f"{type(e).__name__}: {e}"})

${tests
  .map(
    (t, i) => `def __t${i}():\n${indent(t.code)}\n__run(${JSON.stringify(t.name)}, __t${i})`
  )
  .join("\n")}

json.dumps(__results)
`;
    const res = await py.runPythonAsync(harness);
    return { results: JSON.parse(res), output: out };
  } catch (e: any) {
    // A top-level error (e.g. syntax error in candidate code) fails everything.
    return {
      results: tests.map((t) => ({
        name: t.name,
        ok: false,
        msg: "did not run",
      })),
      output: out,
      error: String(e?.message ?? e),
    };
  }
}
