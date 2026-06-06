import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPosts, getPost } from "@/lib/data";
import { TOOL_BY_SLUG } from "@/lib/catalog";
import { ButtonLink } from "@/components/ui/Button";
import { Markdown } from "@/components/seo/Markdown";

interface Params {
  params: { slug: string };
}

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPostPage({ params }: Params) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const toolDef = post.tool ? TOOL_BY_SLUG[post.tool] : undefined;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm">
        <Link href="/blog" className="text-muted hover:text-fg">
          ← Field Notes
        </Link>
      </p>

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">
        {formatDate(post.date)}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        {post.title}
      </h1>

      <div className="mt-8">
        <Markdown>{post.body}</Markdown>
      </div>

      {toolDef && (
        <div className="mt-10 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-fg">
            Prepping for a <strong>{toolDef.name}</strong> loop? Get every
            question they ask.
          </p>
          <div className="mt-4">
            <ButtonLink
              href={`/interview-questions/${post.tool}/senior`}
              size="sm"
            >
              {toolDef.name} interview questions →
            </ButtonLink>
          </div>
        </div>
      )}
    </article>
  );
}
