"""
ByteShards Spark runner — executes candidate PySpark against sample data in
local mode and diffs vs a reference, mirroring the SQL/DuckDB correctness model.

This is how platforms like Spark Playground / CodeInterview run PySpark: a
server-side Spark in local[*] mode (no cluster, no browser). The Next.js app
proxies to POST /run; if this service isn't running the app falls back to AI-eval.

Run:  pip install -r requirements.txt && python server.py   (needs Java 11/17)
Env:  PORT (default 4000)
"""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

_spark = None


def get_spark():
    global _spark
    if _spark is None:
        from pyspark.sql import SparkSession
        _spark = (
            SparkSession.builder.appName("fieldnotes-runner")
            .master("local[*]")
            .config("spark.ui.enabled", "false")
            .config("spark.sql.shuffle.partitions", "4")
            .getOrCreate()
        )
        _spark.sparkContext.setLogLevel("ERROR")
    return _spark


def build_frames(spark, sample_data):
    """Create DataFrames from [{name, columns, rows}] and return {name: df}."""
    frames = {}
    for tbl in sample_data:
        rows = [tuple(r) for r in tbl["rows"]]
        df = spark.createDataFrame(rows, schema=tbl["columns"])
        df.createOrReplaceTempView(tbl["name"])
        frames[tbl["name"]] = df
    return frames


def run_code(spark, frames, code):
    """Exec candidate/reference code; it must assign `result` (a DataFrame)."""
    ns = {"spark": spark, **frames}
    exec(code, ns)  # noqa: S102 — sandboxed dev tool
    result = ns.get("result")
    if result is None:
        raise ValueError("Your code must assign a DataFrame to a variable named `result`.")
    cols = result.columns
    out = [[(None if v is None else v) for v in row] for row in result.collect()]
    return cols, [[_norm(v) for v in row] for row in out]


def _norm(v):
    if v is None:
        return None
    if isinstance(v, float):
        return round(v, 4)
    return v


def rows_equal(a, b, order_matters):
    if len(a) != len(b):
        return False
    sa = [json.dumps(r, default=str) for r in a]
    sb = [json.dumps(r, default=str) for r in b]
    if not order_matters:
        sa, sb = sorted(sa), sorted(sb)
    return sa == sb


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # health check
        self._send(200, {"ok": True, "service": "fieldnotes-spark-runner"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception as e:  # noqa: BLE001
            return self._send(400, {"error": f"bad request: {e}"})

        try:
            spark = get_spark()
            sample = body.get("sampleData", [])
            mine = run_code(spark, build_frames(spark, sample), body["code"])
        except Exception as e:  # noqa: BLE001
            return self._send(200, {"correct": False, "error": str(e)})

        try:
            ref = run_code(spark, build_frames(spark, sample), body["reference"])
        except Exception as e:  # noqa: BLE001
            return self._send(200, {"correct": False, "error": f"reference failed: {e}", "columns": mine[0], "rows": mine[1]})

        correct = rows_equal(mine[1], ref[1], bool(body.get("orderMatters")))
        self._send(200, {
            "correct": correct,
            "columns": mine[0],
            "rows": mine[1],
            "expectedColumns": ref[0],
            "expectedRows": ref[1],
            "message": "Correct — your result matches." if correct
            else ("Not a match — check values and row order." if body.get("orderMatters") else "Not a match — the set of rows differs."),
        })

    def log_message(self, *args):  # quiet
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4000"))
    print(f"▸ ByteShards Spark runner on http://localhost:{port}  (warming up Spark...)")
    try:
        get_spark()
        print("▸ Spark ready.")
    except Exception as e:  # noqa: BLE001
        print(f"  Spark failed to start ({e}); the app will fall back to AI-eval.")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
