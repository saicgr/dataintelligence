"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Thin Web Speech API wrapper for dictation. Calls `onFinal` with each finalized
 * chunk of transcript. Returns { supported, listening, toggle }. Browser-only,
 * no dependency — degrades to unsupported where the API is absent.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function ensure() {
    if (recRef.current) return recRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) t += e.results[i][0].transcript;
      }
      if (t) onFinalRef.current(t.trim() + " ");
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    return r;
  }

  function toggle() {
    const r = ensure();
    if (!r) return;
    if (listening) {
      try { r.stop(); } catch {}
      setListening(false);
    } else {
      try { r.start(); setListening(true); } catch {}
    }
  }

  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

  return { supported, listening, toggle };
}
