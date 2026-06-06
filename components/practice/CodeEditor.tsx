"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/providers/theme-provider";

// Monaco is client-only and pulls workers from a CDN loader — load lazily.
const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">Loading editor…</div>
  ),
});

export interface EditorSchema {
  tables: { name: string; columns: string[] }[];
}

export type SqlDialect =
  | "duckdb"
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "snowflake"
  | "databricks"
  | "tsql";

const BASE_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET",
  "JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "ON", "AS", "WITH",
  "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "CASE", "WHEN", "THEN", "ELSE", "END",
  "AND", "OR", "NOT", "IN", "BETWEEN", "LIKE", "IS NULL", "IS NOT NULL", "UNION", "UNION ALL",
  "OVER", "PARTITION BY", "ROW_NUMBER()", "RANK()", "DENSE_RANK()", "LAG()", "LEAD()", "COALESCE()",
];
const DIALECT_KEYWORDS: Record<SqlDialect, string[]> = {
  duckdb: ["QUALIFY", "USING SAMPLE", "EXCLUDE", "LIST", "STRUCT"],
  postgresql: ["ILIKE", "RETURNING", "::", "ARRAY_AGG()", "GENERATE_SERIES()"],
  mysql: ["GROUP_CONCAT()", "IFNULL()", "STRAIGHT_JOIN", "LIMIT n OFFSET m"],
  sqlite: ["GLOB", "IFNULL()", "INSTR()"],
  snowflake: ["QUALIFY", "LATERAL FLATTEN", "PIVOT", "UNPIVOT", "TRY_CAST()", "ILIKE"],
  databricks: ["QUALIFY", "LATERAL VIEW", "EXPLODE()", "PIVOT", "TABLESAMPLE"],
  tsql: ["TOP", "OFFSET ... FETCH", "ISNULL()", "STRING_AGG()", "OUTER APPLY"],
};

// Single shared completion provider that reads the active editor's schema/dialect.
const active: { schema: EditorSchema | null; dialect: SqlDialect } = { schema: null, dialect: "duckdb" };
let providerRegistered = false;

export function CodeEditor({
  value,
  onChange,
  language,
  onRun,
  readOnly = false,
  schema,
  dialect = "duckdb",
}: {
  value: string;
  onChange: (v: string) => void;
  language: "sql" | "python" | "plaintext";
  onRun?: () => void;
  readOnly?: boolean;
  schema?: EditorSchema;
  dialect?: SqlDialect;
}) {
  const { theme } = useTheme();

  // Keep the shared provider's view of schema/dialect current.
  useEffect(() => {
    active.schema = schema ?? null;
    active.dialect = dialect;
  }, [schema, dialect]);

  return (
    <Monaco
      language={language}
      value={value}
      theme={theme === "dark" ? "vs-dark" : "light"}
      onChange={(v) => onChange(v ?? "")}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onMount={(editor: any, monaco: any) => {
        active.schema = schema ?? null;
        active.dialect = dialect;
        if (onRun) editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRun());

        if (language === "sql" && !providerRegistered) {
          providerRegistered = true;
          monaco.languages.registerCompletionItemProvider("sql", {
            triggerCharacters: [".", " "],
            provideCompletionItems(model: any, position: any) {
              const word = model.getWordUntilPosition(position);
              const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
              };
              const K = monaco.languages.CompletionItemKind;
              const suggestions: any[] = [];
              const tables = active.schema?.tables ?? [];
              for (const t of tables) {
                suggestions.push({ label: t.name, kind: K.Class, insertText: t.name, detail: "table", range });
                for (const c of t.columns) {
                  suggestions.push({ label: c, kind: K.Field, insertText: c, detail: `${t.name} column`, range });
                }
              }
              const kws = [...BASE_KEYWORDS, ...(DIALECT_KEYWORDS[active.dialect] ?? [])];
              for (const kw of kws) {
                suggestions.push({ label: kw, kind: K.Keyword, insertText: kw, range });
              }
              return { suggestions };
            },
          });
        }
      }}
      options={{
        readOnly,
        fontSize: 13,
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        renderLineHighlight: "line",
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 10, bottom: 10 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        overviewRulerLanes: 0,
        wordWrap: "off",
        quickSuggestions: { other: true, comments: false, strings: false },
        suggestOnTriggerCharacters: true,
        wordBasedSuggestions: "currentDocument",
        tabCompletion: "on",
      }}
      height="100%"
    />
  );
}
