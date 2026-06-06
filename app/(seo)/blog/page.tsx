import type { Metadata } from "next";
import Link from "next/link";
import { getPosts } from "@/lib/data";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "The Field Notes Blog — real interview debriefs (2026)",
  description:
    "Debriefs and playbooks from real data & AI engineering interview loops — the questions that got asked and the answers that landed.",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  const posts = getPosts();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        Field Notes
      </h1>
      <p className="mt-4 text-lg text-muted">
        Debriefs from real interview loops — written down while they were still
        fresh.
      </p>

      <ul className="mt-8 grid gap-5">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="block">
              <Card className="transition-colors hover:bg-surface" as="article">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {formatDate(p.date)}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-fg">
                  {p.title}
                </h2>
                <p className="mt-2 text-sm text-muted">{p.excerpt}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
