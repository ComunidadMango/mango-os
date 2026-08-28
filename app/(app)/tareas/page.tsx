"use client";

import { useState, useRef, useEffect, startTransition } from "react";
import Link from "next/link";
import { Paperclip, CalendarClock, Plus, UserPlus, ListChecks, X, Pencil } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { enviarAPapelera } from "@/lib/papelera";
import {
  cliente,
  persona,
  tareas as tareasIniciales,
  type Tarea,
} from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";
import DrawerTarea from "@/components/DrawerTarea";
import { createBrowserClient } from "@/lib/supabase";

// ─── Tipos y defaults de columnas ────────────────────────────────────────────

export type Columna = {
  id: string;
  titulo: string;
  punto: string;      // clase del punto de color (dot)
  chipActivo: string; // clase del chip activo en el drawer
};

const COLUMNAS_DEFAULT: Columna[] = [
  { id: "pendiente",    titulo: "Por hacer",  punto: "bg-ink-3",  chipActivo: "bg-ink text-paper"  },
  { id: "en_curso",     titulo: "En curso",   punto: "bg-warn",   chipActivo: "bg-warn text-ink"   },
  { id: "en_revision",  titulo: "En revisión",punto: "bg-lime",   chipActivo: "bg-lime text-ink"   },
  { id: "hecha",        titulo: "Listo",      punto: "bg-ok",     chipActivo: "bg-ok text-paper"   },
];

const PALETA: { punto: string; chipActivo: string }[] = [
  { punto: "bg-crit",       chipActivo: "bg-crit text-paper"       },
  { punto: "bg-purple-400", chipActivo: "bg-purple-400 text-paper" },
  { punto: "bg-sky-400",    chipActivo: "bg-sky-400 text-ink"      },
  { punto: "bg-orange-400", chipActivo: "bg-orange-400 text-ink"   },
  { punto: "bg-pink-400",   chipActivo: "bg-pink-400 text-ink"     },
];

type ColumnaRow = {
  id: string; titulo: string; punto: string; chip_activo: string; orden: number;
};

function rowAColumna(r: ColumnaRow): Columna {
  return { id: r.id, titulo: r.titulo, punto: r.punto, chipActivo: r.chip_activo };
}

function tareaRowADomain(r: {
  id: string; titulo: string; descripcion?: string; estado: string;
  responsable: string; responsables?: string[] | null; completados_por?: string[] | null;
  asignada_por: string | null;
  cliente_id: string | null; vence: string | null; adjuntos: number;
}): Tarea {
  return {
    id: r.id, titulo: r.titulo, descripcion: r.descripcion,
    estado: r.estado, responsable: r.responsable,
    responsables: r.responsables?.length ? r.responsables : [r.responsable],
    completadosPor: r.completados_por ?? [],
    asignadaPor: r.asignada_por ?? null,
    clienteId: r.cliente_id ?? undefined,
    vence: r.vence ?? undefined, adjuntos: r.adjuntos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Tareas() {
  const usuarioActual = useUsuarioActual();
  const [vista,           setVista]           = useState<"mias" | "equipo">("mias");
  const [tareasState,     setTareasState]     = useState<Tarea[]>(tareasIniciales);
  const [columnas,        setColumnas]        = useState<Columna[]>(COLUMNAS_DEFAULT);
  const [tareaActivaId,   setTareaActivaId]   = useState<string | null>(null);
  const [modoCrear,       setModoCrear]       = useState(false);
  const [editandoColId,   setEditandoColId]   = useState<string | null>(null);
  const [confirmColumna,  setConfirmColumna]  = useState<string | null>(null);
  const [confirmTarea,    setConfirmTarea]    = useState<string | null>(null);
  const [arrastrandoId,   setArrastrandoId]   = useState<string | null>(null);
  const [colSobre,        setColSobre]        = useState<string | null>(null);

  // Cargar columnas desde Supabase al montar + Realtime
  useEffect(() => {
    fetch("/api/db/columnas-tareas")
      .then(r => r.ok ? r.json() : null)
      .then((rows: ColumnaRow[] | null) => {
        if (!rows?.length) { startTransition(() => setColumnas(COLUMNAS_DEFAULT)); return; }
        startTransition(() => setColumnas(rows.map(rowAColumna)));
      })
      .catch(() => startTransition(() => setColumnas(COLUMNAS_DEFAULT)));
  }, []);

  // Cargar tareas desde Supabase al montar
  useEffect(() => {
    fetch("/api/db/tareas")
      .then(r => r.ok ? r.json() : null)
      // null = la request falló (offline, error de servidor): seguimos con el
      // respaldo local. Un array (aunque esté vacío) es la fuente real de la
      // base — lo mostramos tal cual, para no tapar con datos de ejemplo
      // viejos el hecho de que la base esté realmente vacía.
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setTareasState(rows.map(tareaRowADomain));
      })
      .catch(() => {});
  }, []);

  // Realtime: sincronizar tareas y columnas con todos los usuarios
  useEffect(() => {
    const supabase = createBrowserClient();
    const canal = supabase.channel("tareas-y-columnas")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tareas" },
        (payload) => {
          const nueva = tareaRowADomain(payload.new as Parameters<typeof tareaRowADomain>[0]);
          setTareasState(prev => prev.some(t => t.id === nueva.id) ? prev : [nueva, ...prev]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tareas" },
        (payload) => {
          const updated = tareaRowADomain(payload.new as Parameters<typeof tareaRowADomain>[0]);
          setTareasState(prev => prev.map(t => t.id === updated.id ? updated : t));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tareas" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setTareasState(prev => prev.filter(t => t.id !== id));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "columnas_tareas" },
        (payload) => {
          const col = rowAColumna(payload.new as ColumnaRow);
          setColumnas(prev => prev.some(c => c.id === col.id) ? prev : [...prev, col]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "columnas_tareas" },
        (payload) => {
          const col = rowAColumna(payload.new as ColumnaRow);
          setColumnas(prev => prev.map(c => c.id === col.id ? col : c));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "columnas_tareas" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setColumnas(prev => prev.filter(c => c.id !== id));
          setTareasState(prev => prev.map(t =>
            t.estado === id ? { ...t, estado: "pendiente" } : t
          ));
        })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, []);

  const drawerAbierto = tareaActivaId !== null || modoCrear;
  const tareaActiva   = tareaActivaId ? (tareasState.find((t) => t.id === tareaActivaId) ?? null) : null;

  const visibles =
    vista === "mias"
      ? tareasState.filter((t) => t.responsables.includes(usuarioActual.id))
      : tareasState;

  // ── Columnas ──────────────────────────────────────────────────────────────

  function renombrarColumna(id: string, titulo: string) {
    setColumnas(prev => prev.map((c) => c.id === id ? { ...c, titulo } : c));
    fetch(`/api/db/columnas-tareas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    }).catch(() => {});
  }

  function agregarColumna() {
    const color  = PALETA[(columnas.length - COLUMNAS_DEFAULT.length) % PALETA.length];
    const id     = `col-${Date.now()}`;
    const orden  = columnas.length;
    const nueva: Columna = { id, titulo: "Nueva columna", ...color };
    setColumnas(prev => [...prev, nueva]);
    setEditandoColId(id);
    fetch("/api/db/columnas-tareas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, titulo: "Nueva columna", punto: color.punto, chipActivo: color.chipActivo, orden }),
    }).catch(() => {});
  }

  function eliminarColumna(id: string) {
    const col = columnas.find((c) => c.id === id);
    if (col) enviarAPapelera({ id: col.id, tipo: "columna", titulo: col.titulo, datos: col });
    const primerOtro = columnas.find((c) => c.id !== id);
    if (primerOtro) {
      setTareasState((prev) => prev.map((t) => t.estado === id ? { ...t, estado: primerOtro.id } : t));
    }
    setColumnas(prev => prev.filter((c) => c.id !== id));
    fetch(`/api/db/columnas-tareas/${id}`, { method: "DELETE" }).catch(() => {});
  }

  // ── Tareas ────────────────────────────────────────────────────────────────

  function notificarCompletada(tarea: Tarea) {
    if (tarea.asignadaPor && tarea.asignadaPor !== usuarioActual.id) {
      fetch("/api/notify/tarea-completada", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo:        tarea.titulo,
          responsableId: tarea.responsable,
          asignadoPorId: tarea.asignadaPor,
        }),
      }).catch(() => {});
    }
  }

  function cambiarEstado(id: string, estado: string) {
    const tarea = tareasState.find(t => t.id === id);
    if (!tarea) return;
    const finalId = columnas[columnas.length - 1]?.id;

    // Tarea con varios responsables llegando a la última columna: no se
    // completa de una — cada quien tiene que marcar su parte primero.
    if (estado === finalId && tarea.responsables.length > 1) {
      marcarMiParte(id, true);
      return;
    }

    setTareasState((prev) => prev.map((t) => t.id === id ? { ...t, estado } : t));
    fetch(`/api/db/tareas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    }).catch(() => {});

    if (estado === "hecha") notificarCompletada(tarea);
  }

  // Para tareas con varios responsables: cada persona marca su propia parte.
  // Recién cuando están todos, la tarea pasa sola a la última columna.
  function marcarMiParte(id: string, hecho: boolean) {
    const tarea = tareasState.find(t => t.id === id);
    if (!tarea) return;
    const finalId = columnas[columnas.length - 1]?.id;

    const completadosPor = hecho
      ? Array.from(new Set([...tarea.completadosPor, usuarioActual.id]))
      : tarea.completadosPor.filter(p => p !== usuarioActual.id);
    const todosListos = tarea.responsables.length > 0 && tarea.responsables.every(r => completadosPor.includes(r));
    const nuevoEstado = todosListos && finalId ? finalId : tarea.estado;

    setTareasState(prev => prev.map(t => t.id === id ? { ...t, completadosPor, estado: nuevoEstado } : t));
    fetch(`/api/db/tareas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completadosPor, estado: nuevoEstado }),
    }).catch(() => {});

    if (todosListos) notificarCompletada({ ...tarea, completadosPor, estado: nuevoEstado });
  }
  function editarTarea(id: string, cambios: Partial<Omit<Tarea, "id">>) {
    setTareasState((prev) => prev.map((t) => t.id === id ? { ...t, ...cambios } : t));
    fetch(`/api/db/tareas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    }).catch(() => {});
  }
  async function crearTarea(nueva: Omit<Tarea, "id">) {
    const tempId = `t${Date.now()}`;
    setTareasState((prev) => [{ ...nueva, id: tempId }, ...prev]);
    try {
      const res = await fetch("/api/db/tareas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nueva),
      });
      if (res.ok) {
        const guardada = await res.json();
        setTareasState((prev) => prev.map((t) => t.id === tempId ? { ...t, id: guardada.id } : t));
      }
    } catch {}
  }
  function eliminarTarea(id: string) {
    const tarea = tareasState.find((t) => t.id === id);
    if (tarea) enviarAPapelera({ id: tarea.id, tipo: "tarea", titulo: tarea.titulo, datos: tarea });
    setTareasState((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/db/tareas/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] leading-none">Tareas</h1>

        <div className="flex rounded-[10px] border border-line bg-card p-0.5">
          {(["mias", "equipo"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setVista(v)}
              className={["rounded-[8px] px-3 py-1.5 text-[13px] transition-colors", vista === v ? "bg-ink font-medium text-paper" : "text-ink-3 hover:bg-line-soft hover:text-ink"].join(" ")}>
              {v === "mias" ? "Mis tareas" : "Del equipo"}
            </button>
          ))}
        </div>

        <span className="text-[13px] text-ink-3">
          {visibles.filter((t) => t.estado !== "hecha").length} abiertas
        </span>

        <Link href="/tareas/todo"
          className="ml-auto flex items-center gap-1.5 rounded-[10px] border border-line bg-card px-3.5 py-2 text-[13px] text-ink-2 transition-colors hover:border-ink-3/40 hover:text-ink">
          <ListChecks size={15} strokeWidth={2} /> Mi to-do
        </Link>

        <button type="button" onClick={() => { setModoCrear(true); setTareaActivaId(null); }}
          className="flex items-center gap-1.5 rounded-[10px] bg-lime px-3.5 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85">
          <Plus size={15} strokeWidth={2.4} /> Nueva tarea
        </button>
      </header>

      {/* ── Tablero ──────────────────────────────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columnas.map((col) => {
          const items = visibles.filter((t) => t.estado === col.id);
          return (
            <section key={col.id}
              onDragOver={(e) => { e.preventDefault(); setColSobre(col.id); }}
              onDragLeave={() => setColSobre((c) => (c === col.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) cambiarEstado(id, col.id);
                setColSobre(null);
                setArrastrandoId(null);
              }}
              className={[
                "flex min-w-[240px] max-w-[280px] flex-1 flex-col gap-2.5 rounded-card transition-colors",
                colSobre === col.id ? "bg-lime-soft/30 outline-dashed outline-2 outline-lime/50" : "",
              ].join(" ")}>
              {/* Header columna */}
              <header className="group flex items-center gap-2 border-b-2 border-line pb-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${col.punto}`} />

                {editandoColId === col.id ? (
                  <input
                    autoFocus
                    defaultValue={col.titulo}
                    onBlur={(e) => { renombrarColumna(col.id, e.target.value || col.titulo); setEditandoColId(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")  { renombrarColumna(col.id, e.currentTarget.value || col.titulo); setEditandoColId(null); }
                      if (e.key === "Escape") setEditandoColId(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent font-display text-[12.5px] uppercase tracking-[0.09em] text-ink outline-none"
                  />
                ) : (
                  <button type="button" onClick={() => setEditandoColId(col.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    title="Click para renombrar">
                    <h2 className="truncate font-display text-[12.5px] uppercase tracking-[0.09em] text-ink-3 transition-colors group-hover:text-ink">
                      {col.titulo}
                    </h2>
                    <Pencil size={10} strokeWidth={2} className="shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-60" />
                  </button>
                )}

                <span className="text-[12px] tabular-nums text-ink-3">{items.length}</span>

                {columnas.length > 1 && (
                  <button type="button" onClick={() => setConfirmColumna(col.id)}
                    title="Eliminar columna"
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-crit-bg hover:text-crit">
                    <X size={11} strokeWidth={2.5} />
                  </button>
                )}
              </header>

              {items.length === 0 ? (
                <p className="rounded-card border border-dashed border-line py-6 text-center text-[12.5px] text-ink-3">
                  Nada por acá
                </p>
              ) : (
                items.map((t) => (
                  <TarjetaTarea key={t.id} tarea={t} columnas={columnas} mostrarQuien={vista === "equipo"}
                    onClick={() => { setModoCrear(false); setTareaActivaId(t.id); }}
                    onCambiarEstado={cambiarEstado}
                    arrastrandoId={arrastrandoId} setArrastrandoId={setArrastrandoId}
                    usuarioActualId={usuarioActual.id} onMarcarMiParte={marcarMiParte} />
                ))
              )}
            </section>
          );
        })}

        {/* Botón agregar columna */}
        <div className="flex min-w-[48px] items-start pt-0.5">
          <button type="button" onClick={agregarColumna}
            title="Agregar columna"
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-dashed border-line text-ink-3 transition-colors hover:border-ink-3/50 hover:bg-paper hover:text-ink">
            <Plus size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      <DrawerTarea
        key={tareaActiva?.id ?? (modoCrear ? "crear" : "closed")}
        abierto={drawerAbierto}
        tarea={modoCrear ? null : tareaActiva}
        columnas={columnas}
        onCerrar={() => { setTareaActivaId(null); setModoCrear(false); }}
        onCambiarEstado={cambiarEstado}
        onEditar={editarTarea}
        onCrear={crearTarea}
        onMarcarMiParte={marcarMiParte}
        onEliminar={(id) => setConfirmTarea(id)}
      />

      {confirmColumna && (
        <ConfirmDialog
          titulo="¿Eliminar columna?"
          mensaje="Las tareas de esta columna se moverán a la primera columna disponible."
          labelConfirmar="Eliminar columna"
          onConfirmar={() => { eliminarColumna(confirmColumna); setConfirmColumna(null); }}
          onCancelar={() => setConfirmColumna(null)}
        />
      )}
      {confirmTarea && (
        <ConfirmDialog
          titulo="¿Eliminar tarea?"
          mensaje="Se va a mover a la papelera."
          labelConfirmar="Mover a papelera"
          onConfirmar={() => {
            eliminarTarea(confirmTarea);
            setConfirmTarea(null);
            setTareaActivaId(null);
            setModoCrear(false);
          }}
          onCancelar={() => setConfirmTarea(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TarjetaTarea({
  tarea, columnas, mostrarQuien, onClick, onCambiarEstado, arrastrandoId, setArrastrandoId,
  usuarioActualId, onMarcarMiParte,
}: {
  tarea: Tarea; columnas: Columna[]; mostrarQuien: boolean;
  onClick: () => void;
  onCambiarEstado: (id: string, estado: string) => void;
  arrastrandoId: string | null;
  setArrastrandoId: (id: string | null) => void;
  usuarioActualId: string;
  onMarcarMiParte: (id: string, hecho: boolean) => void;
}) {
  const asigno = tarea.asignadaPor ? persona(tarea.asignadaPor) : null;
  const responsables = tarea.responsables.map(persona).filter((p): p is NonNullable<typeof p> => !!p);
  const cli    = tarea.clienteId ? cliente(tarea.clienteId) : null;
  const multi  = responsables.length > 1;
  const miParteHecha = tarea.completadosPor.includes(usuarioActualId);
  const venceHoy = tarea.vence === new Date().toISOString().slice(0, 10);

  const colIdx    = columnas.findIndex((c) => c.id === tarea.estado);
  const colActual = columnas[colIdx];
  const nextCol   = colIdx < columnas.length - 1 ? columnas[colIdx + 1] : null;

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", tarea.id);
        e.dataTransfer.effectAllowed = "move";
        setArrastrandoId(tarea.id);
      }}
      onDragEnd={() => setArrastrandoId(null)}
      className={[
        "relative overflow-hidden rounded-card border border-line bg-card cursor-grab active:cursor-grabbing",
        arrastrandoId === tarea.id ? "opacity-40" : "",
      ].join(" ")}>

      <div className="cursor-pointer p-3.5 transition-all hover:-translate-y-px hover:shadow-sm"
        onClick={onClick}>
        {cli && (
          <Link href={`/clientes/${cli.id}`} draggable={false} onClick={(e) => e.stopPropagation()}
            className="mb-2 inline-block rounded-chip bg-lime-soft px-2 py-0.5 text-[11px] font-bold text-ink transition-opacity hover:opacity-75">
            {cli.nombre}
          </Link>
        )}

        <h3 className="text-[14px] font-bold leading-snug">{tarea.titulo}</h3>

        {tarea.descripcion && (
          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-ink-3">{tarea.descripcion}</p>
        )}

        <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-3">
          {mostrarQuien && responsables.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="flex items-center -space-x-1.5">
                {responsables.map((p) => (
                  <span key={p.id}
                    title={p.nombre}
                    className="flex h-5 w-5 items-center justify-center rounded-[7px] border border-card bg-lime-soft text-[10px] font-bold text-ink">
                    {p.inicial}
                  </span>
                ))}
              </span>
              {multi
                ? `${responsables.length} personas`
                : responsables[0].nombre}
            </span>
          )}
          {multi && (
            <span className={`flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[10.5px] font-bold ${
              tarea.completadosPor.length === responsables.length ? "bg-ok-bg text-ok" : "bg-line-soft text-ink-2"
            }`}>
              {tarea.completadosPor.length}/{responsables.length} listos
            </span>
          )}
          {multi && responsables.some((p) => p.id === usuarioActualId) && (
            <button type="button" draggable={false}
              title={miParteHecha ? "Desmarcar mi parte" : "Marcar mi parte como hecha"}
              onClick={(e) => { e.stopPropagation(); onMarcarMiParte(tarea.id, !miParteHecha); }}
              className={[
                "flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[10.5px] font-bold transition-colors",
                miParteHecha ? "bg-ok text-paper" : "border border-line text-ink-2 hover:bg-line-soft",
              ].join(" ")}>
              {miParteHecha ? "✓ Mi parte" : "Marcar mi parte"}
            </button>
          )}
          {tarea.adjuntos > 0 && (
            <span className="flex items-center gap-1"><Paperclip size={12} strokeWidth={2} />{tarea.adjuntos}</span>
          )}
          {tarea.vence && (
            <span className={`flex items-center gap-1 ${venceHoy ? "font-bold text-crit" : ""}`}>
              <CalendarClock size={12} strokeWidth={2} />
              {venceHoy ? "Vence hoy" : new Date(tarea.vence + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
            </span>
          )}

          {/* Chip de estado clickeable */}
          {colActual && (
            <button type="button" draggable={false} title="Cambiar estado"
              onClick={(e) => {
                e.stopPropagation();
                // Al llegar a la última columna, se queda ahí — no vuelve a "Por hacer".
                if (!nextCol) return;
                onCambiarEstado(tarea.id, nextCol.id);
              }}
              className={`ml-auto rounded-chip px-2 py-0.5 text-[11px] font-bold transition-opacity hover:opacity-75 ${colActual.chipActivo}`}>
              {colActual.titulo}
            </button>
          )}
        </footer>

        {asigno && (
          <p className="mt-2.5 flex items-center gap-1.5 border-t border-line-soft pt-2.5 text-[11.5px] text-ink-3">
            <UserPlus size={12} strokeWidth={2} />
            Asignada por <span className="font-bold text-ink">{asigno.nombre}</span>
          </p>
        )}
      </div>
    </article>
  );
}
