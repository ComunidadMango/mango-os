import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Card({
  titulo,
  extra,
  href,
  className = "",
  children,
}: {
  titulo: string;
  extra?: string;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-card border border-line bg-card p-4 transition-colors hover:border-ink-3/35 ${className}`}
    >
      <header className="mb-2 flex items-center gap-2">
        <h2 className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">
          {titulo}
        </h2>
        {extra && <span className="text-[12px] tabular-nums text-ink-3">· {extra}</span>}
        {href && (
          <Link
            href={href}
            className="group ml-auto flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[12px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
          >
            Ver todo
            <ArrowRight size={12} strokeWidth={2.2} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
