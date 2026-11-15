import type { ReactNode } from "react";

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" | "article" }) {
  return <Tag className={`rounded-card border border-line bg-surface p-5 shadow-card ${className}`}>{children}</Tag>;
}

/** A titled region; the heading labels the section for screen readers. */
export function Section({ title, id, action, children, className = "" }: { title: string; id: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-xl font-extrabold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-3xl font-extrabold leading-tight">{title}</h1>
      {subtitle ? <p className="text-ink-soft">{subtitle}</p> : null}
    </header>
  );
}
