import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Types are still checked at build; lint is run separately via `npm run lint`.
  eslint: { ignoreDuringBuilds: true },
  // DuckDB's native bindings ship platform-specific .node binaries — keep them
  // external so webpack doesn't try to bundle them into the server build.
  experimental: {
    serverComponentsExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
