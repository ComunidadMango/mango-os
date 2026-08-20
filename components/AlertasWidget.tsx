"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Clock, CheckCircle2, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import { tareas } from "@/lib/data";

// ─────────────────────────────────────────────────────────────────────────────

type Nivel = "urgente" | "media" | "ok";

type Alerta = {
  id: string;
  nivel: Nivel;
  categoria: "seguimiento" | "cliente" | "tarea";
  texto: string;
  href?: string;
};

const NIVEL_CFG: Record<Nivel, { dot: string; chip: string; Icono: typeof AlertTriangle; etiqueta: string }> = {
  urgente: { dot: "bg-crit",    chip: "bg-crit-bg text-crit", Icono: AlertTriangle, etiqueta: "Urgente"  },
  media:   { dot: "bg-warn",    chip: "bg-warn-bg text-warn", Icono: Clock,          etiqueta: "Atención" },
  ok:      { dot: "bg-ok",      chip: "bg-ok-bg text-ok",    Icono: CheckCircle2,   etiqueta: "Al día"   },
};

// ─────────────────────────────────────────────────────────────────────────────

function diasDesde(isoFecha: string): number {
  const d = new Date(isoFecha + "T12:00:00");
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}


function generarAlertas(allTareas: typeof tareas): Alerta[] {
  const lista: Alerta[] = [];

  // ── Tareas vencidas / vencen hoy / próximas ────────────────────────────────
  allTareas.filter(t => t.estado !== "hecha" && t.vence).forEach(t => {
    const dias = diasDesde(t.vence!);
    if (dias > 0) {
      lista.push({ id: `tarea-${t.id}`, nivel: "urgente", categoria: "tarea",
        texto: `Tarea vencida hace ${dias}d — "${t.titulo}"`, href: "/tareas" });
    } else if (dias === 0) {
      lista.push({ id: `tarea-${t.id}`, nivel: "media", categoria: "tarea",
        texto: `Vence hoy — "${t.titulo}"`, href: "/tareas" });
    } else if (dias >= -2) {
      lista.push({ id: `tarea-${t.id}`, nivel: "media", categoria: "tarea",
        texto: `Vence en ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"} — "${t.titulo}"`, href: "/tareas" });
    }
  });

  return lista.sort((a, b) => {
    const ord: Record<Nivel, number> = { urgente: 0, media: 1, ok: 2 };
    return ord[a.nivel] - ord[b.nivel];
  });
}

// ─────────────────────────────────────────────────────────────────────────────

const POR_PAGINA = 3;

export default function AlertasWidget() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [pagina, setPagina]   = useState(0);
  const [listo, setListo]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      // Esperar Supabase antes de mostrar cualquier alerta (evita flicker con mock data)
      setListo(true);

      // Cargar tareas de Supabase
      try {
        const tareasRes = await fetch("/api/db/tareas");
        if (cancelled) return;

        const remoteTareas = tareasRes.ok
          ? (await tareasRes.json() as Array<{
              id: string; titulo: string; estado: string;
              responsable: string; asignada_por: string | null;
              cliente_id: string | null; vence: string | null; adjuntos: number;
            }>).map(r => ({
              id: r.id, titulo: r.titulo, estado: r.estado as typeof tareas[number]["estado"],
              responsable: r.responsable, asignadaPor: r.asignada_por,
              clienteId: r.cliente_id ?? undefined, vence: r.vence ?? undefined,
              adjuntos: r.adjuntos,
            })) as typeof tareas
          : tareas;

        if (!cancelled) setAlertas(generarAlertas(remoteTareas));
      } catch {
        // Se queda con los datos locales
      }
    }
    cargar();
    return () => { cancelled = true; };
  }, []);

  if (!listo) return null;

  const total    = alertas.length;
  const nUrgente = alertas.filter(a => a.nivel === "urgente").length;
  const nMedia   = alertas.filter(a => a.nivel === "media").length;
  const nPaginas = Math.ceil(total / POR_PAGINA);
  const visibles = alertas.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);

  const prev = () => setPagina(p => Math.max(0, p - 1));
  const next = () => setPagina(p => Math.min(nPaginas - 1, p + 1));

  return (
    <div className="rounded-card border border-line bg-card p-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2">
        <span className="font-display text-[13px] font-bold leading-none shrink-0">Alertas</span>

        <div className="flex items-center gap-1.5 ml-1">
          {nUrgente > 0 && (
            <span className="rounded-chip bg-crit-bg px-2 py-0.5 text-[10.5px] font-bold text-crit">
              {nUrgente} urgentes
            </span>
          )}
          {nMedia > 0 && (
            <span className="rounded-chip bg-warn-bg px-2 py-0.5 text-[10.5px] font-bold text-warn">
              {nMedia} atención
            </span>
          )}
        </div>

        {nPaginas > 1 && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button type="button" onClick={prev} disabled={pagina === 0}
              className="flex h-6 w-6 items-center justify-center rounded-[7px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink disabled:opacity-30">
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <span className="min-w-[36px] text-center text-[11.5px] tabular-nums text-ink-3">
              {pagina + 1}/{nPaginas}
            </span>
            <button type="button" onClick={next} disabled={pagina === nPaginas - 1}
              className="flex h-6 w-6 items-center justify-center rounded-[7px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink disabled:opacity-30">
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* ── Lista ───────────────────────────────────────────────────────── */}
      {total === 0 ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} strokeWidth={2} className="shrink-0 text-ok" />
          <span className="text-[13px] text-ink-2">Todo en orden — sin alertas activas</span>
        </div>
      ) : (
        <ul className="flex flex-col">
          {visibles.map((a, i) => {
            const cfg   = NIVEL_CFG[a.nivel];
            const Icono = cfg.Icono;
            const fila  = (
              <li className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-line-soft" : ""}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] ${cfg.chip}`}>
                  <Icono size={13} strokeWidth={2.2} />
                </span>
                <span className={`shrink-0 rounded-chip px-2 py-px text-[10px] font-bold uppercase tracking-wide ${cfg.chip}`}>
                  {cfg.etiqueta}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{a.texto}</span>
                {a.href && (
                  <ArrowRight size={13} strokeWidth={2} className="shrink-0 text-ink-3/40" />
                )}
              </li>
            );
            return a.href ? (
              <Link key={a.id} href={a.href}
                className="-mx-1 rounded-[8px] px-1 transition-colors hover:bg-paper">
                {fila}
              </Link>
            ) : (
              <span key={a.id}>{fila}</span>
            );
          })}
        </ul>
      )}

    </div>
  );
}
