"use client";

import { useState, useEffect } from "react";
import { Users2, Video, FileClock, Loader2, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { eventosCalendario } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────

type GcalEvent = {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
};

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie"] as const;

const TIPO_ICONO: Record<string, LucideIcon> = {
  reunion: Users2, grabacion: Video, vencimiento: FileClock, interno: Users2,
};
const TIPO_BG: Record<string, string> = {
  reunion:    "bg-lime-soft text-ink",
  grabacion:  "bg-ok-bg text-ok",
  vencimiento:"bg-warn-bg text-warn",
  interno:    "bg-line-soft text-ink-2",
};

function getLunes(hoy: Date): Date {
  const d = new Date(hoy);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function deducirTipo(summary?: string): string {
  const s = (summary ?? "").toLowerCase();
  if (s.includes("grab") || s.includes("film") || s.includes("video")) return "grabacion";
  if (s.includes("reporte") || s.includes("entrega") || s.includes("vence")) return "vencimiento";
  if (s.includes("interno") || s.includes("equipo") || s.includes("team")) return "interno";
  return "reunion";
}

function fmtHora(dt?: string) {
  if (!dt) return undefined;
  return new Date(dt).toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CalendarioWidget() {
  const usuario = useUsuarioActual();
  const [cargando, setCargando] = useState(true);
  const [real, setReal] = useState(false);
  const [evReales, setEvReales] = useState<GcalEvent[]>([]);

  const hoy = new Date();
  const lunes = getLunes(hoy);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  viernes.setHours(23, 59, 59);

  const fechasSemana = DIAS.map((_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return isoDate(d);
  });

  const todayISO = isoDate(hoy);
  const mes = lunes.toLocaleDateString("es-AR", { month: "long" });
  const extraTxt = `${lunes.getDate()} – ${viernes.getDate()} de ${mes}`;

  useEffect(() => {
    const tMin = lunes.toISOString();
    const tMax = viernes.toISOString();
    fetch(`/api/calendar/events?cal=mio&timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}`)
      .then(r => r.json())
      .then((data: { events?: GcalEvent[]; error?: string }) => {
        if (data.events && !data.error) { setEvReales(data.events); setReal(true); }
      })
      .catch(() => {})
      .finally(() => setCargando(false));
    // La dependencia es la semana actual; al montar solo hay un fetch por semana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function eventosDia(fecha: string) {
    if (real) {
      return evReales.filter(e => (e.start.dateTime ?? e.start.date ?? "").slice(0, 10) === fecha);
    }
    // Fallback mock: solo los eventos del usuario actual
    return eventosCalendario.filter(e => e.fecha === fecha && e.participantes.includes(usuario.id));
  }

  return (
    <div className="rounded-card border border-line bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[13px] font-bold leading-none">Mi semana</span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-3">{extraTxt}</span>
          <Link href="/calendario"
            className="flex items-center gap-1 text-[12px] text-ink-3 transition-colors hover:text-ink">
            Ver todo <ArrowRight size={11} strokeWidth={2} />
          </Link>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-4 text-[12.5px] text-ink-3">
          <Loader2 size={13} strokeWidth={2} className="animate-spin" /> Cargando calendario…
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {fechasSemana.map((fecha, i) => {
            const eventos = eventosDia(fecha);
            const esHoy = fecha === todayISO;
            return (
              <div key={fecha} className="flex min-w-0 flex-col gap-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${esHoy ? "text-ink" : "text-ink-3"}`}>
                  {DIAS[i]}
                  {esHoy && (
                    <span className="ml-1 rounded-chip bg-lime px-1 py-px text-[9px] font-bold normal-case text-ink">
                      hoy
                    </span>
                  )}
                </span>

                {eventos.length === 0 ? (
                  <span className="rounded-soft border border-dashed border-line py-3 text-center text-[11px] text-ink-3">
                    —
                  </span>
                ) : real ? (
                  (eventos as GcalEvent[]).map(e => {
                    const tipo = deducirTipo(e.summary);
                    const Icono = TIPO_ICONO[tipo];
                    return (
                      <div key={e.id} className={`rounded-soft px-2 py-1.5 text-[11.5px] leading-tight ${TIPO_BG[tipo]}`}>
                        <Icono size={12} strokeWidth={2.2} className="mb-1" />
                        <span className="block truncate font-medium">{e.summary ?? "Evento"}</span>
                        {e.start.dateTime && (
                          <span className="block tabular-nums opacity-70">{fmtHora(e.start.dateTime)}</span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  (eventos as typeof eventosCalendario).map(e => {
                    const Icono = TIPO_ICONO[e.tipo] ?? Users2;
                    return (
                      <div key={e.id} className={`rounded-soft px-2 py-1.5 text-[11.5px] leading-tight ${TIPO_BG[e.tipo]}`}>
                        <Icono size={12} strokeWidth={2.2} className="mb-1" />
                        <span className="block truncate font-medium">{e.titulo}</span>
                        {e.hora && <span className="block tabular-nums opacity-70">{e.hora}</span>}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
