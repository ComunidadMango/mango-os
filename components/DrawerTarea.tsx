"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Paperclip,
  Trash2,
  Plus,
  FileText,
  Image as ImageIcon,
  Video,
  Archive,
  File as FileIcon,
} from "lucide-react";
import {
  equipo,
  clientes as clientesFallback,
  persona,
  type Tarea,
  type Cliente,
} from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";
import type { Columna } from "@/app/(app)/tareas/page";

// ─────────────────────────────────────────────────────────────────────────────

type Draft = Omit<Tarea, "id">;

function draftVacio(usuarioId: string): Draft {
  return {
    titulo: "",
    estado: "pendiente",
    responsable: usuarioId,
    responsables: [usuarioId],
    completadosPor: [],
    asignadaPor: usuarioId,
    adjuntos: 0,
  };
}

function tareaADraft(t: Tarea): Draft {
  return {
    titulo: t.titulo,
    descripcion: t.descripcion,
    estado: t.estado,
    responsable: t.responsable,
    responsables: t.responsables,
    completadosPor: t.completadosPor,
    asignadaPor: t.asignadaPor,
    clienteId: t.clienteId,
    vence: t.vence,
    adjuntos: t.adjuntos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const CLASE_INACTIVO = "border border-line bg-card text-ink-3 hover:border-ink-3/50 hover:text-ink";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de archivos
// ─────────────────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconoArchivo(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) return FileText;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)) return ImageIcon;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return Video;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return Archive;
  return FileIcon;
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  abierto: boolean;
  tarea: Tarea | null;
  columnas: Columna[];
  onCerrar: () => void;
  onCambiarEstado: (id: string, estado: string) => void;
  onEditar: (id: string, cambios: Partial<Draft>) => void;
  onCrear: (nueva: Draft) => void;
  onMarcarMiParte: (id: string, hecho: boolean) => void;
  onEliminar: (id: string) => void;
};

export default function DrawerTarea({
  abierto,
  tarea,
  columnas,
  onCerrar,
  onCambiarEstado,
  onEditar,
  onCrear,
  onMarcarMiParte,
  onEliminar,
}: Props) {
  const crear = tarea === null;
  const usuario = useUsuarioActual();

  const [clientes, setClientes] = useState<Cliente[]>(clientesFallback);

  useEffect(() => {
    fetch("/api/db/clientes")
      .then(r => r.ok ? r.json() : null)
      .then((rows) => {
        if (!rows?.length) return;
        setClientes(rows.map((r: {
          id: string; nombre: string; rubro: string; responsable: string;
          media_buyer?: string; descripcion?: string; fee?: number;
          interno?: boolean; pauta_estado: string; pauta_detalle: string;
          relacion_estado: string; relacion_detalle: string;
          trabajo_estado: string; trabajo_detalle: string;
          ultimo_contacto: string | null;
        }) => ({
          id: r.id, nombre: r.nombre, rubro: r.rubro, responsable: r.responsable,
          mediaBuyer: r.media_buyer, descripcion: r.descripcion, fee: r.fee,
          interno: r.interno,
          pauta: { estado: r.pauta_estado as Cliente["pauta"]["estado"], detalle: r.pauta_detalle },
          relacion: { estado: r.relacion_estado as Cliente["relacion"]["estado"], detalle: r.relacion_detalle },
          trabajo: { estado: r.trabajo_estado as Cliente["trabajo"]["estado"], detalle: r.trabajo_detalle },
          ultimoContacto: r.ultimo_contacto,
        })));
      })
      .catch(() => {});
  }, []);

  // Draft se inicializa en cada mount (el componente desmonta al cerrar).
  const [draft, setDraft] = useState<Draft>(
    tarea ? tareaADraft(tarea) : draftVacio(usuario.id)
  );
  const [archivos, setArchivos] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevos = Array.from(e.target.files ?? []);
    if (nuevos.length === 0) return;
    setArchivos((a) => [...a, ...nuevos]);
    e.target.value = ""; // permite volver a seleccionar el mismo archivo
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function cambiarEstado(e: string) {
    setDraft((d) => ({ ...d, estado: e }));
    if (!crear && tarea) onCambiarEstado(tarea.id, e);
  }

  function blurTitulo() {
    const titulo = draft.titulo.trim();
    if (!crear && tarea && titulo) onEditar(tarea.id, { titulo });
  }

  function blurDesc() {
    if (!crear && tarea) {
      const descripcion = draft.descripcion?.trim() || undefined;
      onEditar(tarea.id, { descripcion });
    }
  }

  function toggleResponsable(id: string) {
    const yaEstaba = draft.responsables.includes(id);
    // Siempre tiene que quedar al menos un responsable.
    if (yaEstaba && draft.responsables.length === 1) return;

    const responsables = yaEstaba
      ? draft.responsables.filter((r) => r !== id)
      : [...draft.responsables, id];

    setDraft((d) => ({ ...d, responsables, responsable: responsables[0] }));
    if (!crear && tarea) {
      onEditar(tarea.id, { responsables, responsable: responsables[0] });
      // Avisale a la persona recién agregada, si no se la asignó a sí misma.
      if (!yaEstaba && id !== usuario.id) {
        fetch("/api/notify/nueva-tarea", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: draft.titulo, descripcion: draft.descripcion,
            vence: draft.vence, responsableId: id, asignadoPorId: usuario.id,
          }),
        }).catch(() => {});
      }
    }
  }

  function cambiarCliente(id: string) {
    const clienteId = id || undefined;
    setDraft((d) => ({ ...d, clienteId }));
    if (!crear && tarea) onEditar(tarea.id, { clienteId });
  }

  function cambiarVence(val: string) {
    const vence = val || undefined;
    setDraft((d) => ({ ...d, vence }));
    if (!crear && tarea) onEditar(tarea.id, { vence });
  }

  function handleCrear() {
    const titulo = draft.titulo.trim();
    if (!titulo) return;
    onCrear({ ...draft, titulo });

    // Notificar a cada responsable, salvo a quien se la asigna a sí mismo.
    const clienteNombre = draft.clienteId
      ? clientes.find((c) => c.id === draft.clienteId)?.nombre
      : undefined;
    for (const responsableId of draft.responsables) {
      if (responsableId === usuario.id) continue;
      fetch("/api/notify/nueva-tarea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          descripcion: draft.descripcion,
          clienteNombre,
          vence: draft.vence,
          responsableId,
          asignadoPorId: usuario.id,
        }),
      }).catch(() => {});
    }

    onCerrar();
  }

  // ── Datos derivados ───────────────────────────────────────────────────────

  const asigno =
    !crear && tarea?.asignadaPor ? persona(tarea.asignadaPor) : null;

  if (!abierto) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]"
        onClick={onCerrar}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col bg-paper shadow-2xl">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center border-b border-line px-5 py-4">
          <h2 className="font-display text-[19px] leading-none">
            {crear ? "Nueva tarea" : "Tarea"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {/* ── Cuerpo ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* Estado */}
          <div className="mb-5">
            <p className="mb-2 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {columnas.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => cambiarEstado(col.id)}
                  className={[
                    "rounded-chip px-3 py-1.5 text-[12.5px] font-medium transition-all",
                    draft.estado === col.id ? col.chipActivo : CLASE_INACTIVO,
                  ].join(" ")}
                >
                  {col.titulo}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5 border-t border-line" />

          {/* Título */}
          <div className="mb-4">
            <p className="mb-1.5 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
              Título
            </p>
            <input
              type="text"
              autoFocus={crear}
              value={draft.titulo}
              onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
              onBlur={blurTitulo}
              placeholder="¿Qué hay que hacer?"
              className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[15px] font-bold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-3 focus:border-ink-3"
            />
          </div>

          {/* Descripción */}
          <div className="mb-6">
            <p className="mb-1.5 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
              Descripción
            </p>
            <textarea
              value={draft.descripcion ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, descripcion: e.target.value }))
              }
              onBlur={blurDesc}
              placeholder="Agregar descripción..."
              rows={4}
              className="w-full resize-none rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
            />
          </div>

          <div className="mb-5 border-t border-line" />

          {/* Responsables — se puede elegir más de uno */}
          <div className="mb-5">
            <p className="mb-2 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
              Responsables {draft.responsables.length > 1 && `(${draft.responsables.length})`}
            </p>
            <div className="flex flex-wrap gap-2">
              {equipo.map((p) => {
                const activo = draft.responsables.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleResponsable(p.id)}
                    className={[
                      "flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-[13px] transition-all",
                      activo
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-card text-ink-2 hover:border-ink-3/50",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "notch-sm flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] text-[10px] font-bold",
                        activo ? "bg-lime text-ink" : "bg-lime-soft text-ink",
                      ].join(" ")}
                    >
                      {p.inicial}
                    </span>
                    {p.nombre.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progreso — solo cuando hay más de un responsable, y viendo una tarea ya creada */}
          {!crear && tarea && draft.responsables.length > 1 && (
            <div className="mb-5">
              <p className="mb-2 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                Quién ya terminó su parte
              </p>
              <div className="flex flex-col gap-1.5">
                {draft.responsables.map((id) => {
                  const p = persona(id);
                  if (!p) return null;
                  const hecho = draft.completadosPor.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        const nuevo = hecho
                          ? draft.completadosPor.filter((x) => x !== id)
                          : [...draft.completadosPor, id];
                        setDraft((d) => ({ ...d, completadosPor: nuevo }));
                        onMarcarMiParte(tarea.id, !hecho);
                      }}
                      className={[
                        "flex items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left text-[13px] transition-all",
                        hecho ? "border-ok/30 bg-ok-bg text-ok" : "border-line bg-card text-ink-2 hover:border-ink-3/50",
                      ].join(" ")}
                    >
                      <span className="notch-sm flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] bg-lime-soft text-[10px] font-bold text-ink">
                        {p.inicial}
                      </span>
                      <span className="flex-1">{p.nombre}</span>
                      {hecho && <span className="text-[12px] font-bold">✓ Listo</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[12px] text-ink-3">
                La tarea pasa sola a la última columna cuando estén todos.
              </p>
            </div>
          )}

          {/* Asignada por — solo en vista */}
          {!crear && asigno && (
            <div className="mb-5">
              <p className="mb-1.5 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                Asignada por
              </p>
              <div className="flex items-center gap-2 text-[13px] text-ink-2">
                <span className="notch-sm flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] bg-lime-soft text-[10px] font-bold text-ink">
                  {asigno.inicial}
                </span>
                {asigno.nombre}
              </div>
            </div>
          )}

          {/* Cliente + Vence */}
          <div className="mb-5 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                Cliente
              </p>
              <select
                value={draft.clienteId ?? ""}
                onChange={(e) => cambiarCliente(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-ink-3"
              >
                <option value="">Sin cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1.5 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                Vence
              </p>
              <input
                type="date"
                value={draft.vence ?? ""}
                onChange={(e) => cambiarVence(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-ink-3"
              />
            </div>
          </div>

          {/* Adjuntos */}
          <div className="mb-5">
            <div className="mb-2 flex items-center">
              <p className="font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                Adjuntos
              </p>
              <label className="ml-auto flex cursor-pointer items-center gap-1 rounded-[8px] border border-line bg-card px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-ink-3/50 hover:text-ink">
                <Plus size={12} strokeWidth={2.5} />
                Adjuntar
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleArchivos}
                />
              </label>
            </div>

            {/* Archivos previos (solo en vista, solo conteo) */}
            {!crear && tarea!.adjuntos > 0 && (
              <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-ink-3">
                <Paperclip size={13} strokeWidth={2} />
                {tarea!.adjuntos} archivo{tarea!.adjuntos > 1 ? "s" : ""} adjunto{tarea!.adjuntos > 1 ? "s" : ""}
              </p>
            )}

            {/* Archivos nuevos */}
            {archivos.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {archivos.map((f, i) => {
                  const Icono = iconoArchivo(f);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-[10px] border border-line bg-card px-3 py-2"
                    >
                      <Icono size={15} strokeWidth={2} className="shrink-0 text-ink-3" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{f.name}</p>
                        <p className="text-[11.5px] text-ink-3">{fmtSize(f.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setArchivos((a) => a.filter((_, j) => j !== i))}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-ink-3 transition-colors hover:bg-line-soft hover:text-crit"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              (!crear && tarea!.adjuntos === 0) || crear ? (
                <p className="text-[12.5px] text-ink-3">Sin archivos adjuntos</p>
              ) : null
            )}
          </div>

          {/* Eliminar — solo en vista */}
          {!crear && tarea && (
            <div className="mt-6 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => {
                  onEliminar(tarea.id);
                  onCerrar();
                }}
                className="flex items-center gap-1.5 text-[13px] text-crit transition-opacity hover:opacity-70"
              >
                <Trash2 size={14} strokeWidth={2} />
                Eliminar tarea
              </button>
            </div>
          )}
        </div>

        {/* ── Footer — solo en crear ───────────────────────────────────── */}
        {crear && (
          <div className="shrink-0 border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={handleCrear}
              disabled={!draft.titulo.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-lime px-4 py-2.5 text-[14px] font-bold text-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Crear tarea →
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
