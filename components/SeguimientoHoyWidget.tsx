"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { clientes, persona } from "@/lib/data";
import { leerSegLS } from "@/components/SeguimientoSection";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────

type EstadoCliente = {
  id: string;
  nombre: string;
  contactado: boolean;
  quien?: string;        // id de quien registró
  canal?: string;
  responsable: string;
};

const CANAL_EMOJI: Record<string, string> = {
  whatsapp: "💬", mail: "📧", llamada: "📞", reunion: "🤝",
};

// ─────────────────────────────────────────────────────────────────────────────

export default function SeguimientoHoyWidget() {
  const usuario = useUsuarioActual();
  const [estados, setEstados] = useState<EstadoCliente[]>([]);
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10);

    const data: EstadoCliente[] = clientes
      .filter(c => !c.interno)
      .map(c => {
        const entradas = leerSegLS(c.id);
        const hoyReal = entradas.filter(e => e.fecha === hoy && e.canal !== "sin_contacto");
        const ultimo = hoyReal.at(-1);
        return {
          id: c.id,
          nombre: c.nombre,
          contactado: hoyReal.length > 0,
          quien: ultimo?.quien ?? undefined,
          canal: ultimo?.canal ?? undefined,
          responsable: c.responsable,
        };
      })
      // Primero los del usuario actual, luego por estado (sin contacto primero)
      .sort((a, b) => {
        const esMinoA = a.responsable === usuario.id ? 0 : 1;
        const esMinoB = b.responsable === usuario.id ? 0 : 1;
        if (esMinoA !== esMinoB) return esMinoA - esMinoB;
        return Number(a.contactado) - Number(b.contactado);
      });

    setEstados(data);
  }, [usuario.id]);

  if (estados.length === 0) return null;

  const misMis = estados.filter(e => e.responsable === usuario.id);
  const contactadosHoy = estados.filter(e => e.contactado).length;
  const total = estados.length;

  const visibles = verTodos ? estados : misMis.slice(0, 8);

  return (
    <div className="rounded-card border border-line bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[13px] font-bold leading-none">Seguimiento de hoy</span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-3">
            {contactadosHoy}/{total} contactados
          </span>
          <Link href="/clientes"
            className="flex items-center gap-1 text-[12px] text-ink-3 transition-colors hover:text-ink">
            Ver clientes <ArrowRight size={11} strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line-soft">
        <div
          className="h-full rounded-full bg-lime transition-all duration-500"
          style={{ width: `${total === 0 ? 0 : Math.round((contactadosHoy / total) * 100)}%` }}
        />
      </div>

      {/* Lista */}
      <ul className="flex flex-col">
        {visibles.map((e, i) => {
          const resp = persona(e.responsable);
          const quienLo = e.quien ? persona(e.quien) : null;
          return (
            <li key={e.id}
              className={`flex items-center gap-3 py-2 ${i > 0 ? "border-t border-line-soft" : ""}`}>
              {e.contactado ? (
                <CheckCircle2 size={16} strokeWidth={2} className="shrink-0 text-ok" />
              ) : (
                <Circle size={16} strokeWidth={1.5} className="shrink-0 text-ink-3/40" />
              )}

              <Link href={`/clientes/${e.id}`}
                className="min-w-0 flex-1 truncate text-[13px] font-medium hover:underline">
                {e.nombre}
              </Link>

              {e.contactado && e.canal && (
                <span className="shrink-0 text-[15px]" title={e.canal}>
                  {CANAL_EMOJI[e.canal] ?? "✓"}
                </span>
              )}

              {e.contactado && quienLo ? (
                <span title={quienLo.nombre}
                  className="notch-sm flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-ok-bg text-[9px] font-bold text-ok">
                  {quienLo.inicial}
                </span>
              ) : resp ? (
                <span title={resp.nombre}
                  className="notch-sm flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-line-soft text-[9px] font-bold text-ink-3">
                  {resp.inicial}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Ver todos / colapsar */}
      {(misMis.length < total || verTodos) && (
        <button type="button" onClick={() => setVerTodos(v => !v)}
          className="mt-3 w-full text-center text-[12px] text-ink-3 transition-colors hover:text-ink">
          {verTodos ? "Ver solo los míos" : `Ver todos (${total} clientes)`}
        </button>
      )}
    </div>
  );
}
