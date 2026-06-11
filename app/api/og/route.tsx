import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Real interview questions";
  const subtitle = searchParams.get("subtitle") || "";
  const score = searchParams.get("score");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "1200px",
          height: "630px",
          padding: "72px",
          backgroundColor: "#0b1f3a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 32,
            fontWeight: 700,
            color: "#f5a623",
          }}
        >
          ByteShards
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.1,
              color: "#ffffff",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                fontSize: 32,
                color: "#cbd5e1",
              }}
            >
              {subtitle}
            </div>
          ) : null}
          {score ? (
            <div
              style={{
                display: "flex",
                fontSize: 80,
                fontWeight: 800,
                color: "#f5a623",
              }}
            >
              {score}% ready
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#94a3b8",
          }}
        >
          The questions they actually ask.
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
