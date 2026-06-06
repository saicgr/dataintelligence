import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  as?: "div" | "article" | "section";
}

export function Card({ className, header, footer, children, as = "div" }: CardProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "rounded-xl border border-border bg-card shadow-card",
        className
      )}
    >
      {header && (
        <div className="border-b border-border px-6 py-4">{header}</div>
      )}
      {children && <div className="px-6 py-5">{children}</div>}
      {footer && (
        <div className="border-t border-border px-6 py-4">{footer}</div>
      )}
    </Tag>
  );
}
