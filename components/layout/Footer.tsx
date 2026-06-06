import Link from "next/link";
import { SITE_NAME } from "@/lib/catalog";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Products",
    links: [
      { href: "/pricing", label: "Cheat Sheets" },
      { href: "/practice", label: "Practice" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Free Tools",
    links: [
      { href: "/drill", label: "Daily Drill" },
      { href: "/jobs", label: "Job Board" },
      { href: "/resume", label: "Résumé Optimizer" },
      { href: "/quiz/readiness", label: "Readiness Quiz" },
      { href: "/salaries", label: "Salary Benchmarks" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Field Notes" },
      { href: "/glossary/rag", label: "Glossary" },
      { href: "/most-asked", label: "Most-Asked" },
      { href: "/qotd", label: "Question of the Day" },
      { href: "/methodology", label: "How these are made" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
              <span className="font-mono text-sm font-bold">FN</span>
            </span>
            <span className="text-[15px] font-bold">{SITE_NAME}</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/60">
            Real Data &amp; AI Engineering interview questions — researched from how real
            loops run and fact-checked against the official docs.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              {c.title}
            </h4>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-white/75 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © {2026} {SITE_NAME}. Built from real interviews. Not affiliated
            with any tool vendor.
          </span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
