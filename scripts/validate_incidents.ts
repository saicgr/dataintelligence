// Validate every incident's DuckDB setupSql against the SAME split-on-";" logic
// the production runner uses (lib/practice/duckdb-node.ts), then preview the first table.
// Run: npx tsx scripts/validate_incidents.ts
import { DuckDBInstance } from "@duckdb/node-api";
import { getPracticeItems } from "../lib/data/practice";
import { splitSqlStatements as splitStatements } from "../lib/practice/sql-split";

(async () => {
  const items = getPracticeItems({ category: "incident" });
  let ok = 0, fail = 0, sqlItems = 0;

  for (const it of items) {
    const inc = (it as { incident?: { sql?: { setupSql: string; tables: string[] } } }).incident;
    if (!inc?.sql) continue;
    sqlItems++;
    try {
      const inst = await DuckDBInstance.create(":memory:");
      const con = await inst.connect();
      for (const stmt of splitStatements(inc.sql.setupSql)) await con.run(stmt);
      for (const t of inc.sql.tables) await con.runAndReadAll(`SELECT * FROM ${t} LIMIT 1`);
      ok++;
    } catch (e) {
      fail++;
      console.log("FAIL", it.id, "—", String((e as Error)?.message ?? e).slice(0, 180));
    }
  }
  console.log(`\nincident setupSql: ${ok}/${sqlItems} ran clean, ${fail} failed (of ${items.length} total incidents)`);
  process.exit(fail ? 1 : 0);
})();
