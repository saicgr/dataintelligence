// Curated source registry + fetchers. Each fetcher is best-effort and isolated:
// a failure or 0 entries logs a warning and is skipped — never fails the run.
// Prefer structurally-stable RSS/GitHub sources; treat scrapes as best-effort.

const stripHtml = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function getText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'fieldnotes-content-bot' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Spark — GitHub Releases API (stable JSON). */
async function githubReleases({ tool, domain, tk, repo }) {
  const data = JSON.parse(await getText(`https://api.github.com/repos/${repo}/releases?per_page=5`));
  return (data ?? []).slice(0, 3).map((r) => ({
    tool,
    domain,
    tk,
    url: r.html_url,
    title: r.name || r.tag_name,
    text: stripHtml(String(r.body || '')).slice(0, 6000),
  }));
}

/** AWS News Blog RSS — filtered to a keyword allowlist to avoid the firehose. */
async function awsRss({ allowlist }) {
  const xml = await getText('https://aws.amazon.com/about-aws/whats-new/recent/feed/');
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const pick = (block, tag) => (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '';
  const clean = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  return items
    .map((b) => ({ title: clean(pick(b, 'title')), url: clean(pick(b, 'link')), desc: clean(pick(b, 'description')) }))
    .filter((e) => allowlist.some((k) => (e.title + ' ' + e.desc).toLowerCase().includes(k)))
    .slice(0, 5)
    .map((e) => ({ tool: 'AWS', domain: 'ai', tk: 'sql', url: e.url, title: e.title, text: stripHtml(e.desc).slice(0, 4000) }));
}

/** Generic first-party doc/changelog page (best-effort scrape; the author extracts specifics). */
async function docPage({ tool, domain, tk, url }) {
  return [{ tool, domain, tk, url, title: tool, text: stripHtml(await getText(url)).slice(0, 8000) }];
}

export const SOURCES = [
  { id: 'spark', fetch: () => githubReleases({ tool: 'Spark', domain: 'de', tk: 'spark', repo: 'apache/spark' }) },
  { id: 'claude-code', fetch: () => docPage({ tool: 'Claude Code', domain: 'ai', tk: 'rag', url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md' }) },
  { id: 'anthropic', fetch: () => docPage({ tool: 'Anthropic', domain: 'ai', tk: 'rag', url: 'https://docs.claude.com/en/docs/about-claude/models' }) },
  { id: 'openai', fetch: () => docPage({ tool: 'OpenAI', domain: 'ai', tk: 'rag', url: 'https://platform.openai.com/docs/changelog' }) },
  { id: 'databricks-releases', fetch: () => docPage({ tool: 'Databricks', domain: 'de', tk: 'databricks', url: 'https://docs.databricks.com/en/release-notes/product/index.html' }) },
  { id: 'databricks-genie', fetch: () => docPage({ tool: 'Databricks', domain: 'de', tk: 'databricks', url: 'https://docs.databricks.com/aws/en/release-notes/ai-bi/index.html' }) },
  { id: 'databricks-delta', fetch: () => docPage({ tool: 'Databricks', domain: 'de', tk: 'databricks', url: 'https://docs.delta.io/latest/delta-update.html' }) },
  { id: 'aws', fetch: () => awsRss({ allowlist: ['s3', 'bedrock', 'sagemaker', 'glue', 'redshift', 'athena', 'vector', 'analytics'] }) },
];

/** Fetch all sources; isolate failures. Returns flattened entries. */
export async function fetchAllEntries() {
  const out = [];
  for (const s of SOURCES) {
    try {
      const entries = await s.fetch();
      if (!entries.length) console.warn(`[sources] ${s.id}: 0 entries (skipped)`);
      out.push(...entries.filter((e) => e.url && e.text));
    } catch (err) {
      console.warn(`[sources] ${s.id}: failed (${err.message}) — skipped`);
    }
  }
  return out;
}
