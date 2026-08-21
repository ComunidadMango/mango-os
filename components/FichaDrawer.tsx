"use client";

import { useState } from "react";
import { X, ClipboardList } from "lucide-react";
import { type Cliente } from "@/lib/data";

// ─────────────────────────────────────────────────────────────────────────────

type Draft = {
  nombre: string;
  rubro: string;
  descripcion: string;
  fechaAlta: string;
};

// ─────────────────────────────────────────────────────────────────────────────

export default function FichaDrawer({ cliente: c }: { cliente: Cliente }) {
  const [abierto, setAbierto] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    nombre:      c.nombre,
    rubro:       c.rubro,
    descripcion: c.descripcion ?? "",
    fechaAlta:   c.fechaAlta ?? "",
  });
  const [guardado, setGuardado] = useState(false);

  function set(campo: keyof Draft, valor: string) {
    setDraft(d => ({ ...d, [campo]: valor }));
    setGuardado(false);
  }

  function guardar() {
    // Pre-Supabase: solo refleja en el estado local
    setGuardado(true);
    setTimeout(() => setAbierto(false), 600);
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 rounded-[9px] border border-line bg-card px-3 py-1.5 text-[12.5px] text-ink-3 transition-colors hover:border-ink-3/40 hover:text-ink"
      >
        <ClipboardList size={13} strokeWidth={2} />
        Ficha
      </button>

      {/* Drawer */}
      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]"
            onClick={() => setAbierto(false)}
          />

          <aside className="fixed right-0 top-0 z-50 flex h-full w-[460px] flex-col bg-paper shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-center border-b border-line px-5 py-4">
              <h2 className="font-display text-[19px] leading-none">Ficha del cliente</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="flex flex-col gap-5">

                {/* Nombre + Rubro */}
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Nombre">
                    <input value={draft.nombre} onChange={e => set("nombre", e.target.value)}
                      className={inputCls} />
                  </Campo>
                  <Campo label="Rubro">
                    <input value={draft.rubro} onChange={e => set("rubro", e.target.value)}
                      className={inputCls} />
                  </Campo>
                </div>

                {/* Descripción */}
                <Campo label="Descripción">
                  <textarea value={draft.descripcion}
                    onChange={e => set("descripcion", e.target.value)}
                    rows={3} placeholder="¿Qué hace el negocio?"
                    className={`${inputCls} resize-none`} />
                </Campo>

                {/* Fecha de alta */}
                <Campo label="Fecha de alta">
                  <input type="date" value={draft.fechaAlta}
                    onChange={e => set("fechaAlta", e.target.value)}
                    className={inputCls} />
                </Campo>

              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={guardar}
                className={[
                  "flex w-full items-center justify-center rounded-[10px] px-4 py-2.5 text-[14px] font-bold transition-all",
                  guardado
                    ? "bg-ok text-paper"
                    : "bg-lime text-ink hover:opacity-85",
                ].join(" ")}
              >
                {guardado ? "Guardado ✓" : "Guardar cambios →"}
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
        {label}
      </label>
      {children}
    </div>
  );
}
