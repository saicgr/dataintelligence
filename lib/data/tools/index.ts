import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

// Per-tool content modules. A module may export either:
//   - `authored` + `topics`               → same content applied to all 3 levels, OR
//   - `levels`: Partial<Record<Level, { authored, topics }>>  → level-distinct content
// The question-author agent overwrites a single tool's file (no cross-file conflicts)
// and is encouraged to provide the level-distinct `levels` map.
import * as snowflake from "./snowflake";
import * as dbt from "./dbt";
import * as airflow from "./airflow";
import * as kafka from "./kafka";
import * as spark from "./spark";
import * as databricks from "./databricks";
import * as llms from "./llms";
import * as rag from "./rag";
import * as vectordb from "./vectordb";
import * as agents from "./agents";
import * as sql from "./sql";
import * as python from "./python";
import * as systemdesign from "./systemdesign";
import * as datamodeling from "./datamodeling";

type LevelContent = { authored: Authored[]; topics: ToolTopics };
type ToolModule = {
  authored?: Authored[];
  topics?: ToolTopics;
  levels?: Partial<Record<Level, LevelContent>>;
};

const MODULES: Record<string, ToolModule> = {
  snowflake,
  dbt,
  airflow,
  kafka,
  spark,
  databricks,
  llms,
  rag,
  vectordb,
  agents,
  sql,
  python,
  systemdesign,
  datamodeling,
};

const LEVELS: Level[] = ["junior", "mid", "senior"];
const sheetKey = (slug: string, level: Level) => `${slug}:${level}`;

export const AUTHORED: Record<string, Authored[]> = {};
export const TOPICS: Record<string, ToolTopics> = {};

for (const [slug, m] of Object.entries(MODULES)) {
  // A per-tool default used when a module is level-distinct but omits a level.
  const firstProvided =
    m.levels && (Object.values(m.levels).find(Boolean) as LevelContent | undefined);
  const fallback: LevelContent = {
    authored: m.authored ?? firstProvided?.authored ?? [],
    topics:
      m.topics ??
      firstProvided?.topics ?? {
        moreDeepDives: [],
        decisions: [],
        quickRef: [],
        redFlags: [],
        checklist: [],
        behavioral: [],
        reverse: [],
      },
  };
  for (const level of LEVELS) {
    const lc = m.levels?.[level] ?? fallback;
    AUTHORED[sheetKey(slug, level)] = lc.authored;
    TOPICS[sheetKey(slug, level)] = lc.topics;
  }
}
