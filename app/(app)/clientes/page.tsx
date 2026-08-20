"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Pencil, X } from "lucide-react";
import {
  persona,
  setClientesCache,
  type Cliente,
  type Senal,
} from "@/lib/data";
import Punto from "@/components/Punto";
import DrawerNuevoCliente from "@/components/DrawerNuevoCliente";
import type { ClienteRow } from "@/lib/supabase";

// ─── Pauta editable ───────────────────────────────────────────────────────────

type PautaPatch = { estado: Senal; detalle: string };
type PautaPatches = Record<string, PautaPatch>;
const KEY_PAUTA = "mango-pauta-v1";

const ESTADOS_PAUTA: { key: Senal; label: string; chip: string }[] = [
  { key: "ok",       label: "En objetivo", chip: "bg-ok-bg text-ok border-ok/20"      },
  { key: "atencion", label: "Atención",    chip: "bg-warn-bg text-warn border-warn/20" },
  { key: "critico",  label: "Crítico",     chip: "bg-crit-bg text-crit border-crit/20" },
];

// ─── Supabase row mapper ──────────────────────────────────────────────────────

function rowToCliente(r: ClienteRow): Cliente {
  return {
    id:             r.id,
    nombre:         r.nombre,
    rubro:          r.rubro,
    responsable:    r.responsable,
    mediaBuyer:     r.media_buyer ?? undefined,
    descripcion:    r.descripcion ?? undefined,
    fechaAlta:      r.fecha_alta ?? undefined,
    fee:            r.fee ?? undefined,
    interno:        r.interno,
    pauta:          { estado: r.pauta_estado as Cliente["pauta"]["estado"],       detalle: r.pauta_detalle    },
    relacion:       { estado: r.relacion_estado as Cliente["relacion"]["estado"], detalle: r.relacion_detalle },
    trabajo:        { estado: r.trabajo_estado as Cliente["trabajo"]["estado"],   detalle: r.trabajo_detalle  },
    ultimoContacto: r.ultimo_contacto,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Clientes() {
  const [clientesState, setClientesState] = useState<Cliente[]>([]);
  const [drawerAbierto, setDrawerAbierto]   = useState(false);

  const [pautaPatches, setPautaPatches] = useState<PautaPatches>({});
  const [guardandoPauta, setGuardandoPauta] = useState(false);
  const [modalPauta, setModalPauta] = useState<{
    clienteId: string;
    nombre: string;
    draft: PautaPatch;
  } | null>(null);

  // Carga clientes desde Supabase
  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      try {
        const res = await fetch("/api/db/clientes");
        if (!res.ok) return;
        const rows = await res.json() as ClienteRow[];
        if (cancelled) return;
        const data = rows.map(rowToCliente);
        setClientesState(data);
        setClientesCache(data);
      } catch {}
    }
    cargar();
    return () => { cancelled = true; };
  }, []);

  // Carga parches de pauta desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY_PAUTA);
      if (raw) setPautaPatches(JSON.parse(raw));
    } catch {}
  }, []);

  function agregarCliente(nuevo: Cliente) {
    setClientesState((prev) => [nuevo, ...prev]);
  }

  function pautaEfectiva(c: Cliente): PautaPatch {
    return pautaPatches[c.id] ?? c.pauta;
  }

  function abrirPauta(e: React.MouseEvent, c: Cliente) {
    e.preventDefault();
    e.stopPropagation();
    setModalPauta({ clienteId: c.id, nombre: c.nombre, draft: { ...pautaEfectiva(c) } });
  }

  async function guardarPauta() {
    if (!modalPauta) return;
    setGuardandoPauta(true);
    // Optimista: actualizar UI inmediatamente
    const next = { ...pautaPatches, [modalPauta.clienteId]: modalPauta.draft };
    setPautaPatches(next);
    setModalPauta(null);
    // Persistir en Supabase
    try {
      await fetch(`/api/db/clientes/${modalPauta.clienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pauta_estado:  modalPauta.draft.estado,
          pauta_detalle: modalPauta.draft.detalle,
        }),
      });
      // Actualizar también el estado local del cliente
      setClientesState(prev => prev.map(c =>
        c.id === modalPauta.clienteId
          ? { ...c, pauta: modalPauta.draft }
          : c
      ));
    } catch {}
    setGuardandoPauta(false);
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] leading-none">Clientes</h1>
        <span className="text-[13px] text-ink-3">{clientesState.length} activos</span>
        <button
          type="button"
          onClick={() => setDrawerAbierto(true)}
          className="ml-auto flex items-center gap-1.5 rounded-[10px] bg-lime px-3.5 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85"
        >
          <Plus size={15} strokeWidth={2.4} />
          Nuevo cliente
        </button>
      </header>

      <div className="overflow-hidden rounded-card border border-line bg-card">
        <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 border-b border-line px-4 py-2.5 font-display text-[11px] uppercase tracking-[0.1em] text-ink-3 lg:grid">
          <span>Cliente</span>
          <span>Pauta</span>
          <span>Relación</span>
          <span>Trabajo</span>
          <span className="w-4" />
        </div>

        {clientesState.map((c) => {
          const resp = persona(c.responsable);
          const pauta = pautaEfectiva(c);
          return (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="group grid grid-cols-1 items-center gap-x-4 gap-y-2 border-b border-line-soft px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
            >
              <span className="flex items-center gap-2.5">
                <span className="notch-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-lime-soft text-[12px] font-bold text-ink">
                  {c.nombre.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-bold">{c.nombre}</span>
                    {c.interno && (
                      <span className="shrink-0 rounded-chip bg-ink px-1.5 py-px text-[10px] font-bold text-paper">
                        Interno
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {c.rubro}
                    {resp ? ` · ${resp.nombre}` : ""}
                    {""}
                  </span>
                </span>
              </span>

              {/* Pauta — editable */}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => abrirPauta(e, c)}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.key === "Enter" && abrirPauta(e as unknown as React.MouseEvent, c)}
                className="group/pauta flex min-w-0 cursor-pointer items-center gap-2 rounded-[7px] px-1.5 py-1 text-[12.5px] transition-colors hover:bg-line-soft"
              >
                <Punto estado={pauta.estado} />
                <span className="truncate">{pauta.detalle || "—"}</span>
                <Pencil
                  size={10}
                  strokeWidth={2}
                  className="ml-0.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover/pauta:opacity-60"
                />
              </span>

              <Celda etiqueta="Relación" estado={c.relacion.estado} detalle={c.relacion.detalle} />
              <Celda etiqueta="Trabajo"  estado={c.trabajo.estado}  detalle={c.trabajo.detalle} />

              <ArrowRight
                size={15}
                strokeWidth={2}
                className="hidden text-ink-3 transition-transform group-hover:translate-x-0.5 lg:block"
              />
            </Link>
          );
        })}
      </div>

      {/* ── Modal edición de pauta ─────────────────────────────────────────── */}
      {modalPauta && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]"
            onClick={() => setModalPauta(null)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-line bg-paper p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="font-display text-[15px] font-bold leading-tight">{modalPauta.nombre}</p>
                <p className="mt-0.5 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">Estado de pauta</p>
              </div>
              <button
                type="button"
                onClick={() => setModalPauta(null)}
                className="flex h-6 w-6 items-center justify-center rounded-[7px] text-ink-3 hover:bg-line-soft hover:text-ink"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Estado chips */}
            <div className="mb-3 flex gap-1.5">
              {ESTADOS_PAUTA.map(({ key, label, chip }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setModalPauta((m) => m && { ...m, draft: { ...m.draft, estado: key } })}
                  className={[
                    "flex-1 rounded-chip border px-2 py-1.5 text-[12px] font-medium transition-all",
                    modalPauta.draft.estado === key
                      ? chip
                      : "border-line bg-card text-ink-3 hover:border-ink-3/40 hover:text-ink",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Nota libre */}
            <input
              type="text"
              autoFocus
              value={modalPauta.draft.detalle}
              onChange={(e) =>
                setModalPauta((m) => m && { ...m, draft: { ...m.draft, detalle: e.target.value } })
              }
              onKeyDown={(e) => e.key === "Enter" && guardarPauta()}
              placeholder="Ej: CPL alto, frecuencia alta..."
              className="mb-4 w-full rounded-[10px] border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-ink-3 placeholder:text-ink-3"
            />

            {/* Acciones */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalPauta(null)}
                className="flex-1 rounded-[10px] border border-line py-2 text-[13px] text-ink-2 transition-colors hover:bg-line-soft"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarPauta}
                className="flex-1 rounded-[10px] bg-lime py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85"
              >
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      <DrawerNuevoCliente
        abierto={drawerAbierto}
        onCerrar={() => setDrawerAbierto(false)}
        onCrear={agregarCliente}
      />
    </div>
  );
}

// ─── Celda genérica (relación / trabajo) ──────────────────────────────────────

function Celda({
  etiqueta,
  estado,
  detalle,
}: {
  etiqueta: string;
  estado: Senal;
  detalle: string;
}) {
  const vacio = !detalle || detalle === "—";
  return (
    <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
      {!vacio && <Punto estado={estado} />}
      <span className={`truncate ${vacio ? "text-ink-3" : ""}`}>
        <span className="text-ink-3 lg:hidden">{etiqueta}: </span>
        {vacio ? "—" : detalle}
      </span>
    </span>
  );
}
