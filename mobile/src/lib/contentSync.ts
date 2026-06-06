import AsyncStorage from '@react-native-async-storage/async-storage';

import { ENV } from './env';
import { FreshCard, setExtraFresh } from './fresh';
import { LessonCard, setExtraLessons } from './lessons';

/**
 * How the app KNOWS about new content (the founder's question).
 *
 * Two layers, both offline-first:
 *  1. BUNDLED seed (fresh.ts FRESH_SEED + lessons.ts LESSON_SEED) ships in the binary —
 *     works day one, offline.
 *  2. REMOTE refresh — on launch the app fetches a tiny JSON *manifest* and compares
 *     its `version` to the last version it cached. If newer, it downloads the new
 *     "fresh" card set and/or the "lessons" set, caches them locally, and merges them
 *     over the bundle.
 *
 * Publishing (manual OR automated, no app-store release): author drafts → review at the
 * tooling/content/publish.mjs chokepoint → upload fresh-vN.json + lessons-vN.json and bump
 * manifest.json `version`. The app polls the manifest on launch.
 *
 * manifest.json shape: { "version": 7, "freshUrl": ".../fresh-v7.json", "lessonsUrl": ".../lessons-v7.json" }
 *   (either URL may be absent — only the present payloads are fetched.)
 *
 * If EXPO_PUBLIC_CONTENT_MANIFEST_URL is unset, this no-ops and the app uses the
 * bundled seed only — so it runs today and is ready for live content later.
 */

const FRESH_CACHE_KEY = 'fieldnotes-fresh-cache-v1';
const LESSONS_CACHE_KEY = 'fieldnotes-lessons-cache-v1';
const VERSION_KEY = 'fieldnotes-content-version';

interface Manifest {
  version: number;
  freshUrl?: string;
  lessonsUrl?: string;
}

async function loadCache(): Promise<void> {
  try {
    const [fresh, lessons] = await AsyncStorage.multiGet([FRESH_CACHE_KEY, LESSONS_CACHE_KEY]);
    if (fresh[1]) setExtraFresh(JSON.parse(fresh[1]) as FreshCard[]);
    if (lessons[1]) setExtraLessons(JSON.parse(lessons[1]) as LessonCard[]);
  } catch {
    // ignore corrupt cache — fall back to bundled seed
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    return data;
  } catch {
    return null;
  }
}

export async function initContentSync(onUpdated?: () => void): Promise<void> {
  // 1. hydrate from local cache immediately (offline-first)
  await loadCache();
  onUpdated?.();

  // 2. if configured, version-check the remote manifest
  if (!ENV.contentManifestUrl) return;
  try {
    const manifest = await fetchJson<Manifest>(ENV.contentManifestUrl);
    const current = Number((await AsyncStorage.getItem(VERSION_KEY)) ?? 0);
    if (!manifest || !(manifest.version > current)) return;

    const writes: [string, string][] = [];

    if (manifest.freshUrl) {
      const cards = await fetchJson<FreshCard[]>(manifest.freshUrl);
      if (Array.isArray(cards)) {
        setExtraFresh(cards);
        writes.push([FRESH_CACHE_KEY, JSON.stringify(cards)]);
      }
    }
    if (manifest.lessonsUrl) {
      const lessons = await fetchJson<LessonCard[]>(manifest.lessonsUrl);
      if (Array.isArray(lessons)) {
        setExtraLessons(lessons);
        writes.push([LESSONS_CACHE_KEY, JSON.stringify(lessons)]);
      }
    }

    if (writes.length) {
      writes.push([VERSION_KEY, String(manifest.version)]);
      await AsyncStorage.multiSet(writes);
      onUpdated?.();
    }
  } catch {
    // offline / fetch failed → keep cached + bundled content; never block the app
  }
}
