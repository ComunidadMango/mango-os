"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { equipo as equipoFallback, type Cliente } from "@/lib/data";
import type { ClienteRow } from "@/lib/supabase";

type Draft = {
  nombre: string;
  rubro: string;
  descripcion: string;
  responsable: string;
  mediaBuyer: string;
  fechaAlta: string;
  fee: string;
};

type PersonaSimple = { id: string; nombre: string; inicial: string };

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 32);
}

const hoy = new Date().toISOString().slice(0, 10);

const DRAFT_VACIO: Draft = {
  nombre: "", rubro: "", descripcion: "",
  responsable: "", mediaBuyer: "", fechaAlta: hoy, fee: "",
};

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
    pauta:    { estado: r.pauta_estado as Cliente["pauta"]["estado"],       detalle: r.pauta_detalle    },
    relacion: { estado: r.relacion_estado as Cliente["relacion"]["estado"], detalle: r.relacion_detalle },
    trabajo:  { estado: r.trabajo_estado as Cliente["trabajo"]["estado"],   detalle: r.trabajo_detalle  },
    ultimoContacto: r.ultimo_contacto,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DrawerNuevoCliente({
  abierto,
  onCerrar,
  onCrear,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCrear: (cliente: Cliente) => void;
}) {
  const [draft, setDraft]       = useState<Draft>(DRAFT_VACIO);
  const [error, setError]       = useState("");
  const [guardando, setGuardando] = useState(false);
  const [personas, setPersonas] = useState<PersonaSimple[]>(
    equipoFallback.map(p => ({ id: p.id, nombre: p.nombre, inicial: p.inicial }))
  );

  useEffect(() => {
    if (!abierto) return;
    fetch("/api/db/personas")
      .then(r => r.ok ? r.json() : null)
      .then((rows: Array<{ id: string; nombre: string; inicial: string }> | null) => {
        if (rows?.length) setPersonas(rows);
      })
      .catch(() => {});
  }, [abierto]);

  function set(campo: keyof Draft, valor: string) {
    setDraft(d => ({ ...d, [campo]: valor }));
    if (error) setError("");
  }

  async function guardar() {
    if (!draft.nombre.trim())      { setError("El nombre es obligatorio.");         return; }
    if (!draft.rubro.trim())       { setError("El rubro es obligatorio.");           return; }
    if (!draft.descripcion.trim()) { setError("La descripción es obligatoria.");     return; }
    if (!draft.responsable)        { setError("Elegí un Account Manager.");          return; }

    setGuardando(true);
    setError("");

    try {
      const payload = {
        id:               `${slugify(draft.nombre.trim())}-${Date.now()}`,
        nombre:           draft.nombre.trim(),
        rubro:            draft.rubro.trim(),
        descripcion:      draft.descripcion.trim(),
        responsable:      draft.responsable,
        media_buyer:      draft.mediaBuyer || null,
        fecha_alta:       draft.fechaAlta || hoy,
        fee:              draft.fee ? Number(draft.fee) : null,
        interno:          false,
        pauta_estado:     "ok",
        pauta_detalle:    "—",
        relacion_estado:  "ok",
        relacion_detalle: "—",
        trabajo_estado:   "ok",
        trabajo_detalle:  "—",
        ultimo_contacto:  null,
      };

      const res = await fetch("/api/db/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setError(err.error ?? "Error al crear el cliente.");
        return;
      }

      const row = await res.json() as ClienteRow;
      onCrear(rowToCliente(row));
      setDraft(DRAFT_VACIO);
      onCerrar();
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]" onClick={onCerrar} />

      <aside className="fixed right-0 top-0 z-50 flex h-full w-[460px] flex-col bg-paper shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center border-b border-line px-5 py-4">
          <h2 className="font-display text-[19px] leading-none">Nuevo cliente</h2>
          <button type="button" onClick={onCerrar}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="flex flex-col gap-5">

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre" required>
                <input autoFocus type="text" value={draft.nombre}
                  onChange={e => set("nombre", e.target.value)}
                  placeholder="Ej: Casa Praga" className={inputCls} />
              </Campo>
              <Campo label="Rubro" required>
                <input type="text" value={draft.rubro}
                  onChange={e => set("rubro", e.target.value)}
                  placeholder="Ej: Muebles y deco" className={inputCls} />
              </Campo>
            </div>

            <Campo label="Descripción" required>
              <textarea value={draft.descripcion}
                onChange={e => set("descripcion", e.target.value)}
                placeholder="¿Qué hace el negocio? Una o dos oraciones."
                rows={3} className={`${inputCls} resize-none`} />
            </Campo>

            <Campo label="Account Manager" required>
              <div className="flex flex-wrap gap-2">
                {personas.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => set("responsable", draft.responsable === p.id ? "" : p.id)}
                    className={["flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] transition-all",
                      draft.responsable === p.id
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-card text-ink-2 hover:border-ink-3/50",
                    ].join(" ")}>
                    <span className="notch-sm flex h-5 w-5 items-center justify-center rounded-[6px] bg-lime-soft text-[10px] font-bold text-ink">
                      {p.inicial}
                    </span>
                    {p.nombre}
                  </button>
                ))}
              </div>
            </Campo>

            <Campo label="Media Buyer">
              <div className="flex flex-wrap gap-2">
                {personas.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => set("mediaBuyer", draft.mediaBuyer === p.id ? "" : p.id)}
                    className={["flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] transition-all",
                      draft.mediaBuyer === p.id
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-card text-ink-2 hover:border-ink-3/50",
                    ].join(" ")}>
                    <span className="notch-sm flex h-5 w-5 items-center justify-center rounded-[6px] bg-lime-soft text-[10px] font-bold text-ink">
                      {p.inicial}
                    </span>
                    {p.nombre}
                  </button>
                ))}
              </div>
            </Campo>

            <div className="h-px bg-line-soft" />

            <div className="grid grid-cols-2 items-end gap-3">
              <Campo label="Fecha de alta">
                <input type="date" value={draft.fechaAlta}
                  onChange={e => set("fechaAlta", e.target.value)} className={inputCls} />
              </Campo>
              <Campo label="Fee del servicio (USD)">
                <input type="number" min={0} value={draft.fee}
                  onChange={e => set("fee", e.target.value)}
                  placeholder="0" className={inputCls} />
              </Campo>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-line px-5 py-4">
          {error && (
            <p className="mb-3 rounded-[8px] bg-crit-bg px-3 py-2 text-[12.5px] text-crit">{error}</p>
          )}
          <button type="button" onClick={guardar} disabled={guardando}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-lime px-4 py-2.5 text-[14px] font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-50">
            {guardando
              ? <><Loader2 size={15} strokeWidth={2} className="animate-spin" /> Guardando…</>
              : "Dar de alta →"
            }
          </button>
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3";

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
        {label}{required && <span className="ml-0.5 text-crit">*</span>}
      </label>
      {children}
    </div>
  );
}
