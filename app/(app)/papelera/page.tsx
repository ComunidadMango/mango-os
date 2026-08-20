"use client";

import { useState, useEffect, startTransition } from "react";
import {
  CheckSquare, StickyNote, FileText, Users, BookText,
  FolderOpen, LayoutGrid, RotateCcw, Trash2,
} from "lucide-react";
import {
  leerPapelera, restaurar, eliminarDePapelera, esRestaurable,
  type ItemPapelera, type TipoPapelera,
} from "@/lib/papelera";
import ConfirmDialog from "@/components/ConfirmDialog";

// ─── Config visual ────────────────────────────────────────────────────────────

const ICONO: Record<TipoPapelera, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  nota:             StickyNote,
  proceso:          BookText,
  "finanza-cliente": Users,
  "finanza-equipo":  Users,
  "finanza-gasto":   FileText,
  seccion:          FolderOpen,
  "carpeta-extra":   FolderOpen,
  tarea:            CheckSquare,
  columna:          LayoutGrid,
  etapa:            LayoutGrid,
  paso:             FileText,
};

const TIPO_LABEL: Record<TipoPapelera, string> = {
  nota:             "Nota",
  proceso:          "Proceso",
  "finanza-cliente": "Cliente",
  "finanza-equipo":  "Equipo",
  "finanza-gasto":   "Gasto",
  seccion:          "Sección",
  "carpeta-extra":   "Carpeta",
  tarea:            "Tarea",
  columna:          "Columna",
  etapa:            "Etapa",
  paso:             "Paso",
};

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Papelera() {
  const [items,      setItems]      = useState<ItemPapelera[]>([]);
  const [confirmDef, setConfirmDef] = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);

  useEffect(() => {
    startTransition(() => setItems(leerPapelera()));
  }, []);

  function recargar() {
    startTransition(() => setItems(leerPapelera()));
  }

  function mostrarToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleRestaurar(id: string) {
    const ok = restaurar(id);
    recargar();
    if (ok) {
      mostrarToast("Elemento restaurado. Recargá la sección para verlo.");
    } else {
      mostrarToast("No se pudo restaurar automáticamente.");
    }
  }

  function handleEliminarDef() {
    if (!confirmDef) return;
    eliminarDePapelera(confirmDef);
    setConfirmDef(null);
    recargar();
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <header className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] leading-none">Papelera</h1>
        <span className="text-[13px] text-ink-3">{items.length} elementos</span>
      </header>
      <p className="mb-5 max-w-[60ch] text-[13.5px] text-ink-3">
        Todo lo que eliminás queda acá. Podés recuperarlo o borrarlo definitivamente.
      </p>

      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-line py-14 text-center">
          <Trash2 size={22} strokeWidth={1.8} className="mx-auto mb-3 text-ink-3" />
          <p className="text-[14px] text-ink-3">La papelera está vacía</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-card">
          {items.map((item, i) => {
            const Icono = ICONO[item.tipo];
            const restaurable = esRestaurable(item.tipo);
            return (
              <div
                key={item.id}
                className={`group flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper ${i > 0 ? "border-t border-line-soft" : ""}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-line-soft text-ink-2">
                  <Icono size={16} strokeWidth={2} />
                </span>

                <span className="min-w-[180px] flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold">{item.titulo}</span>
                    <span className="shrink-0 rounded-chip bg-line-soft px-1.5 py-px text-[10.5px] font-bold text-ink-2">
                      {TIPO_LABEL[item.tipo]}
                    </span>
                  </span>
                  <span className="block text-[12.5px] text-ink-3">
                    Borrado {tiempoRelativo(item.borradoEn)}
                  </span>
                </span>

                <span className="flex items-center gap-1.5">
                  {restaurable ? (
                    <button
                      type="button"
                      onClick={() => handleRestaurar(item.id)}
                      className="flex items-center gap-1.5 rounded-[9px] border border-line bg-card px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:border-ink hover:bg-lime hover:text-ink"
                    >
                      <RotateCcw size={13} strokeWidth={2.2} />
                      Recuperar
                    </button>
                  ) : (
                    <span className="px-2.5 py-1.5 text-[11.5px] text-ink-3/60">
                      No recuperable
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDef(item.id)}
                    aria-label="Eliminar definitivamente"
                    className="rounded-[9px] border border-line bg-card p-1.5 text-ink-3 transition-colors hover:border-crit hover:bg-crit-bg hover:text-crit"
                  >
                    <Trash2 size={14} strokeWidth={2.2} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {confirmDef && (
        <ConfirmDialog
          titulo="¿Eliminar definitivamente?"
          mensaje="Esta acción no se puede deshacer."
          labelConfirmar="Eliminar para siempre"
          onConfirmar={handleEliminarDef}
          onCancelar={() => setConfirmDef(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-[12px] bg-ink px-4 py-3 text-[13px] font-bold text-paper shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
