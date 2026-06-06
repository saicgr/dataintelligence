import { Fragment } from "react";

/** Render `**bold**` inline within a line. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="font-semibold text-fg">
          {m[1]}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/**
 * Minimal markdown-ish renderer for answerStructured:
 * `- ` lines become a bulleted list, blank lines separate blocks, fenced
 * ```lang code blocks``` render as a monospace panel, and everything else is a
 * paragraph. `**bold**` is honored inline.
 */
export function AnswerMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  let code: string[] | null = null; // non-null while inside a ``` fence
  let codeIndent = ""; // leading whitespace of the opening fence, stripped from body

  const flushBullets = (key: string) => {
    if (bullets.length) {
      blocks.push(
        <ul key={key} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };
  const flushPara = (key: string) => {
    if (para.length) {
      blocks.push(
        <p key={key} className="text-sm leading-relaxed text-fg">
          {renderInline(para.join(" "))}
        </p>
      );
      para = [];
    }
  };
  const flushCode = (key: string) => {
    if (code) {
      blocks.push(
        <pre
          key={key}
          className="overflow-x-auto rounded-xl border border-border bg-card px-4 py-3 text-[13px] leading-relaxed text-fg"
        >
          <code className="font-mono">{code.join("\n")}</code>
        </pre>
      );
      code = null;
    }
  };

  lines.forEach((raw, i) => {
    const fence = raw.match(/^(\s*)```/);
    if (code !== null) {
      // inside a fence: a ``` line closes it, everything else is code
      if (fence) flushCode(`c-${i}`);
      else code.push(codeIndent && raw.startsWith(codeIndent) ? raw.slice(codeIndent.length) : raw);
      return;
    }
    if (fence) {
      flushBullets(`u-${i}`);
      flushPara(`p-${i}`);
      code = [];
      codeIndent = fence[1];
      return;
    }
    const line = raw.trim();
    if (line.startsWith("- ")) {
      flushPara(`p-${i}`);
      bullets.push(line.slice(2));
    } else if (line === "") {
      flushBullets(`u-${i}`);
      flushPara(`p-${i}`);
    } else {
      flushBullets(`u-${i}`);
      para.push(line);
    }
  });
  flushBullets("u-end");
  flushPara("p-end");
  flushCode("c-end");

  return <div className="space-y-3">{blocks}</div>;
}
