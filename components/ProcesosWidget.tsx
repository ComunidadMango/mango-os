import Link from "next/link";
import { BookText, ArrowRight } from "lucide-react";
import { procesos } from "@/lib/data";

const AREA_LABEL: Record<string, string> = {
  clientes: "Clientes",
  pauta:    "Pauta",
  creativo: "Creativo",
  tecnico:  "Técnico",
};

const AREA_COLOR: Record<string, string> = {
  clientes: "bg-ok-bg text-ok",
  pauta:    "bg-lime-soft text-ink",
  creativo: "bg-warn-bg text-warn",
  tecnico:  "bg-line-soft text-ink-2",
};

export default function ProcesosWidget() {
  const recientes = procesos
    .slice()
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
    .slice(0, 4);

  return (
    <div className="rounded-card border border-line bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <BookText size={15} strokeWidth={2} className="text-ink-3" />
          <h2 className="font-display text-[15px]">Procesos</h2>
          <span className="rounded-full bg-line-soft px-1.5 py-px text-[11px] text-ink-3">
            {procesos.length}
          </span>
        </div>
        <Link href="/procesos"
          className="flex items-center gap-1 text-[12px] text-ink-3 transition-colors hover:text-ink">
          Ver todos <ArrowRight size={11} strokeWidth={2} />
        </Link>
      </div>

      {/* Lista */}
      <div className="divide-y divide-line-soft">
        {recientes.map(p => (
          <Link key={p.id} href="/procesos"
            className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-line-soft/40">
            <span className={`mt-0.5 shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-bold ${AREA_COLOR[p.area]}`}>
              {AREA_LABEL[p.area]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold">{p.titulo}</p>
              <p className="truncate text-[12px] text-ink-3">{p.resumen.slice(0, 70)}…</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
