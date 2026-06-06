import { Fragment } from "react";

/** Render `**bold**` spans inside a line of text. */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold text-fg">
          {m[1]}
        </strong>
      );
    }
    return <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>;
  });
}

/**
 * Tiny dependency-free markdown renderer for trusted seed content.
 * Supports: `## ` headings, `- ` lists, blank-line paragraph breaks,
 * and `**bold**` inline.
 */
export function Markdown({ children }: { children: string }) {
  const lines = children.split("\n");
  const blocks: React.ReactNode[] = [];

  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const key = `p-${blocks.length}`;
      blocks.push(
        <p key={key} className="leading-relaxed text-fg">
          {inline(para.join(" "), key)}
        </p>
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const key = `ul-${blocks.length}`;
      blocks.push(
        <ul key={key} className="ml-5 list-disc space-y-1 text-fg">
          {list.map((item, i) => (
            <li key={i}>{inline(item, `${key}-${i}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushPara();
      flushList();
      const key = `h2-${blocks.length}`;
      blocks.push(
        <h2 key={key} className="mt-8 text-xl font-bold text-fg">
          {inline(line.slice(3), key)}
        </h2>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushPara();
      list.push(line.slice(2));
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className="space-y-4">{blocks}</div>;
}
