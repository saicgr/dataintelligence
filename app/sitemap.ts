import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { allSheets } from "@/lib/catalog";
import { getComparisonQuestions, getGlossary, getPosts } from "@/lib/data";

function compareSlug(tools: string[]): string {
  return tools.map((t) => t.toLowerCase().replace(/\s+/g, "-")).join("-vs-");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const url = (path: string): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
  });

  const staticPaths = [
    "/",
    "/pricing",
    "/jobs",
    "/salaries",
    "/drill",
    "/blog",
    "/glossary",
    "/most-asked",
    "/qotd",
    "/quiz/readiness",
    "/quiz/what-tool",
  ];

  const sheetPaths = allSheets().map((s) =>
    `/interview-questions/${s.tool}/${s.level}`
  );

  const compareSlugs = new Set<string>();
  for (const q of getComparisonQuestions()) {
    if (q.comparisonTools) compareSlugs.add(compareSlug(q.comparisonTools));
  }
  const comparePaths = Array.from(compareSlugs).map(
    (slug) => `/compare/${slug}`
  );

  const glossaryPaths = getGlossary().map((g) => `/glossary/${g.slug}`);
  const blogPaths = getPosts().map((p) => `/blog/${p.slug}`);

  return [
    ...staticPaths,
    ...sheetPaths,
    ...comparePaths,
    ...glossaryPaths,
    ...blogPaths,
  ].map(url);
}
