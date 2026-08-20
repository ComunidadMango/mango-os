"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Clock, AtSign, TrendingUp, CheckCircle2 } from "lucide-react";

type Notif = {
  id: string;
  tipo: string;
  texto: string;
  href: string | null;
  leida: boolean;
  creada_en: string;
};

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 2) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `hace ${dias}d`;
}

const ICONO_TIPO: Record<string, typeof AlertTriangle> = {
  asignada: CheckCircle2,
  mencion: AtSign,
  "nuevo-lead": TrendingUp,
  seguimiento: Clock,
  "tarea-vencida": AlertTriangle,
  "tarea-vence-hoy": Clock,
};

const TONO_TIPO: Record<string, string> = {
  asignada: "bg-ok-bg text-ok",
  mencion: "bg-lime-soft text-teal",
  "nuevo-lead": "bg-ok-bg text-ok",
  seguimiento: "bg-warn-bg text-warn",
  "tarea-vencida": "bg-crit-bg text-crit",
  "tarea-vence-hoy": "bg-warn-bg text-warn",
};

export default function PanelNotificaciones({
  abierto,
  onCerrar,
  onMarcarLeidas,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onMarcarLeidas: () => void;
}) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let cancelled = false;
    setCargando(true);
    fetch("/api/notificaciones")
      .then(r => r.ok ? r.json() : [])
      .then((data: Notif[]) => {
        if (!cancelled) setNotifs(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCargando(false); });
    return () => { cancelled = true; };
  }, [abierto]);

  async function marcarLeidas() {
    await fetch("/api/notificaciones", { method: "PATCH" });
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    onMarcarLeidas();
  }

  if (!abierto) return null;

  const sinLeer = notifs.filter(n => !n.leida).length;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/25" onClick={onCerrar} aria-hidden />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[380px] flex-col border-l border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[19px]">Notificaciones</h2>
            {sinLeer > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-crit px-1 text-[11px] font-bold tabular-nums text-white">
                {sinLeer}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar notificaciones"
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-ink-3">
              Cargando…
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-3">
              <CheckCircle2 size={28} strokeWidth={1.5} className="text-ok" />
              <span className="text-[13px]">Sin notificaciones</span>
            </div>
          ) : (
            notifs.map((n) => {
              const Icono = ICONO_TIPO[n.tipo] ?? AlertTriangle;
              const tono = TONO_TIPO[n.tipo] ?? "bg-line-soft text-ink-2";
              const contenido = (
                <div className={`flex w-full gap-3 border-b border-line-soft px-5 py-4 text-left transition-colors hover:bg-paper ${!n.leida ? "bg-lime-soft/10" : ""}`}>
                  <span className={`mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${tono}`}>
                    <Icono size={14} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] leading-snug text-ink">{n.texto}</span>
                    <span className="mt-1 block text-[12px] text-ink-3">{tiempoRelativo(n.creada_en)}</span>
                  </span>
                  {!n.leida && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-crit" />
                  )}
                </div>
              );
              return n.href ? (
                <a key={n.id} href={n.href} onClick={onCerrar}>{contenido}</a>
              ) : (
                <div key={n.id}>{contenido}</div>
              );
            })
          )}
        </div>

        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={marcarLeidas}
            disabled={sinLeer === 0}
            className="w-full rounded-[10px] py-2 text-[13px] text-ink-3 transition-colors hover:bg-paper hover:text-ink disabled:opacity-40"
          >
            Marcar todas como leídas
          </button>
        </div>
      </aside>
    </>
  );
}
