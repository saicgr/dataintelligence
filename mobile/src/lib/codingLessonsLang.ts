import type { LessonCard } from './lessons';
import type { TrackColorKey } from './theme';

import codingCpp from './generated/coding-cpp.json';
import codingGo from './generated/coding-go.json';
import codingRust from './generated/coding-rust.json';
import codingJava from './generated/coding-java.json';
import codingNode from './generated/coding-nodejs.json';
import codingPyspark from './generated/coding-pyspark.json';
import codingScala from './generated/coding-scala.json';
import codingTs from './generated/coding-typescript.json';

/**
 * Language CODING-PRACTICE drills (Go / Rust / Java / Node.js / PySpark / TypeScript).
 * Each source JSON is an array of `choice` drills (code snippet + pick-the-answer MCQ),
 * authored by the content swarm. Here we stamp the per-track id/colour and merge them
 * into LESSON_SEED (see lessons.ts) so the winding path, sequential unlock, and the
 * track-detail "Drills" list all pick them up unchanged.
 */
function build(slug: string, tk: TrackColorKey, drills: unknown[]): LessonCard[] {
  return drills.map((d, i) => ({
    ...(d as object),
    track: slug,
    id: `${slug}-${i}`,
    tk,
    strict: true,
  })) as unknown as LessonCard[];
}

export const CODING_LESSONS_LANG: LessonCard[] = [
  ...build('go-coding', 'kafka', codingGo),
  ...build('rust-coding', 'dbt', codingRust),
  ...build('java-coding', 'dbt', codingJava),
  ...build('nodejs-coding', 'kafka', codingNode),
  ...build('pyspark-coding', 'spark', codingPyspark),
  ...build('typescript-coding', 'sql', codingTs),
  ...build('cpp-coding', 'sysd', codingCpp),
  ...build('scala-coding', 'spark', codingScala),
];
