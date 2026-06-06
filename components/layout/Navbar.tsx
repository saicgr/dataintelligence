import Link from "next/link";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { AuthNav } from "./AuthNav";

const NAV = [
  { href: "/cheat-sheets", label: "Cheat Sheets" },
  { href: "/practice", label: "Practice" },
  { href: "/pricing", label: "Pricing" },
  { href: "/jobs", label: "Jobs" },
  { href: "/salaries", label: "Salaries" },
  { href: "/blog", label: "Field Notes" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <AuthNav />
        </div>
      </div>
    </header>
  );
}
