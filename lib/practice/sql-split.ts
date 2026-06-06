/**
 * Split a multi-statement SQL string into individual statements, ignoring
 * semicolons that appear inside single-quoted string literals or inside
 * `-- line` / block comments. Used by both the in-browser (DuckDB-WASM) and
 * server (DuckDB-node) runners so setup SQL with comments/strings is safe.
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false; // inside a '...' literal
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const n = sql[i + 1];
    if (inStr) {
      cur += c;
      if (c === "'") {
        if (n === "'") { cur += n; i++; } // escaped '' quote
        else inStr = false;
      }
      continue;
    }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === "-" && n === "-") { // line comment → skip to EOL
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") { // block comment → skip to */
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i++; // land on '/'
      continue;
    }
    if (c === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
