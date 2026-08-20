"use client";

import { useState, useEffect, startTransition } from "react";
import Link from "next/link";
import { NotebookPen, Lock, Users, Plus, ArrowRight } from "lucide-react";
import { type Nota, KEY_NOTAS_PAGE, tiempoRelativo } from "@/app/(app)/notas/page";

export default function NotasWidget() {
  const [notas, setNotas] = useState<Nota[]>([]);

  useEffect(() => {
    const s = localStorage.getItem(KEY_NOTAS_PAGE);
    if (!s) return;
    startTransition(() => setNotas(JSON.parse(s) as Nota[]));
  }, []);

  const recientes = notas.slice(0, 4);

  return (
    <div className="rounded-card border border-line bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <NotebookPen size={15} strokeWidth={2} className="text-ink-3" />
          <h2 className="font-display text-[15px]">Notas</h2>
        </div>
        <Link href="/notas"
          className="flex items-center gap-1 text-[12px] text-ink-3 transition-colors hover:text-ink">
          Ver todas <ArrowRight size={11} strokeWidth={2} />
        </Link>
      </div>

      {/* Lista */}
      <div className="divide-y divide-line-soft">
        {recientes.length === 0 && (
          <div className="px-5 py-6 text-center text-[13px] text-ink-3">
            <p>Sin notas todavía</p>
            <Link href="/notas"
              className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] bg-lime px-3 py-1.5 text-[12px] font-bold text-ink hover:opacity-85">
              <Plus size={12} strokeWidth={2.5} /> Crear nota
            </Link>
          </div>
        )}
        {recientes.map(n => (
          <Link key={n.id} href="/notas"
            className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-line-soft/40">
            <span className={[
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              n.visibilidad === "equipo" ? "bg-ok-bg text-ok" : "bg-line-soft text-ink-3",
            ].join(" ")}>
              {n.visibilidad === "equipo"
                ? <Users size={10} strokeWidth={2} />
                : <Lock size={10} strokeWidth={2} />
              }
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold">
                {n.titulo || <span className="italic font-normal text-ink-3">Sin título</span>}
              </p>
              {n.contenido && (
                <p className="truncate text-[12px] text-ink-3">{n.contenido.slice(0, 60)}</p>
              )}
            </div>
            <span className="shrink-0 text-[11px] text-ink-3/60">{tiempoRelativo(n.editadaEn)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
