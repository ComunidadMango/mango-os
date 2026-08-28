"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import { Plus, X, Trash2, BookText, Pencil } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { enviarAPapelera } from "@/lib/papelera";
import { createBrowserClient } from "@/lib/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Paso = {
  id: string;
  titulo: string;
  descripcion: string;
};

type Etapa = {
  id: string;
  titulo: string;
  pasos: Paso[];
};

type Proceso = {
  id: string;
  titulo: string;
  etapas: Etapa[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Datos iniciales ──────────────────────────────────────────────────────────

const INICIAL: Proceso[] = [
  {
    id: "proc-onboarding",
    titulo: "Onboarding de cliente nuevo",
    etapas: [
      {
        id: "et-1",
        titulo: "Pre-inicio",
        pasos: [
          { id: "p1", titulo: "Firmar contrato", descripcion: "Enviar por DocuSign. Guardar firmado en Drive › Cliente › Legales." },
          { id: "p2", titulo: "Crear carpeta en Drive", descripcion: "Estructura: Creativos / Reportes / Legales / Reuniones." },
          { id: "p3", titulo: "Alta en GHL", descripcion: "Crear contacto, asignar pipeline y etapa 'Nuevo cliente activo'." },
        ],
      },
      {
        id: "et-2",
        titulo: "Semana 1",
        pasos: [
          { id: "p4", titulo: "Kick-off meeting", descripcion: "30 min. Presentar equipo, revisar objetivos y timeline." },
          { id: "p5", titulo: "Accesos Meta Ads", descripcion: "Solicitar acceso al Business Manager. Verificar píxel activo." },
          { id: "p6", titulo: "Brief de creativos", descripcion: "Briefear con referencias, copy y fecha de entrega." },
        ],
      },
      {
        id: "et-3",
        titulo: "Lanzamiento",
        pasos: [
          { id: "p7", titulo: "Revisar creativos", descripcion: "Aprobar piezas con el cliente antes de subir." },
          { id: "p8", titulo: "Subir campañas", descripcion: "Estructura ToFu / MoFu / BoFu. Presupuesto según acuerdo." },
          { id: "p9", titulo: "Primeras 48hs", descripcion: "Monitorear entrega, frecuencia y CPC inicial." },
        ],
      },
    ],
  },
];

// ─── Colores de etapa (cicla) ─────────────────────────────────────────────────

const PALETA = [
  { bg: "bg-lime",           text: "text-ink"   },
  { bg: "bg-ok",             text: "text-paper" },
  { bg: "bg-[#003430]",      text: "text-paper" },
  { bg: "bg-crit",           text: "text-paper" },
  { bg: "bg-purple-400",     text: "text-paper" },
  { bg: "bg-sky-400",        text: "text-paper" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Procesos() {
  const [procesos,       setProcesos]       = useState<Proceso[]>([]);
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [editTitulo,     setEditTitulo]     = useState(false);
  const [tempTitulo,     setTempTitulo]     = useState("");
  const [confirmProceso, setConfirmProceso] = useState<string | null>(null);
  const [confirmEtapa,   setConfirmEtapa]   = useState<{ procesoId: string; etapaId: string } | null>(null);
  const [confirmPaso,    setConfirmPaso]    = useState<{ etapaId: string; pasoId: string } | null>(null);
  const tituloRef = useRef<HTMLInputElement>(null);

  // ── Carga desde Supabase (compartido por todo el equipo, en vivo) ──────────

  useEffect(() => {
    let cancelled = false;
    fetch("/api/db/procesos")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Proceso[] | null) => {
        if (cancelled) return;
        // null = todavía no hay ningún registro guardado -> arrancamos con
        // los procesos de ejemplo. [] = alguien ya borró todo a propósito.
        const lista = data ?? INICIAL;
        startTransition(() => {
          setProcesos(lista);
          setSelectedId((prev) => prev ?? lista[0]?.id ?? null);
        });
      })
      .catch(() => {
        startTransition(() => {
          setProcesos(INICIAL);
          setSelectedId(INICIAL[0]?.id ?? null);
        });
      });
    return () => { cancelled = true; };
  }, []);

  // Realtime: ver cambios de otras personas del equipo al instante
  useEffect(() => {
    const supabase = createBrowserClient();
    const canal = supabase.channel("procesos-equipo")
      .on("postgres_changes", { event: "*", schema: "public", table: "procesos_data" },
        (payload) => {
          const nuevos = (payload.new as { data?: Proceso[] } | null)?.data;
          if (!nuevos) return;
          startTransition(() => {
            setProcesos(nuevos);
            setSelectedId((prev) => (prev && nuevos.some((p) => p.id === prev) ? prev : nuevos[0]?.id ?? null));
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  useEffect(() => {
    if (editTitulo) tituloRef.current?.focus();
  }, [editTitulo]);

  function save(next: Proceso[]) {
    setProcesos(next);
    fetch("/api/db/procesos", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
  }

  const proceso = procesos.find((p) => p.id === selectedId) ?? null;

  // ── Proceso CRUD ───────────────────────────────────────────────────────────

  function nuevoProceso() {
    const np: Proceso = { id: uid(), titulo: "Nuevo proceso", etapas: [] };
    const next = [...procesos, np];
    save(next);
    setSelectedId(np.id);
    setTempTitulo(np.titulo);
    setEditTitulo(true);
  }

  function eliminarProceso(id: string) {
    const proc = procesos.find((p) => p.id === id);
    if (proc) enviarAPapelera({ id: proc.id, tipo: "proceso", titulo: proc.titulo, datos: proc });
    const next = procesos.filter((p) => p.id !== id);
    save(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  function update(id: string, cambios: Partial<Proceso>) {
    save(procesos.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  }

  function guardarTitulo() {
    const t = tempTitulo.trim();
    if (t && proceso) update(proceso.id, { titulo: t });
    setEditTitulo(false);
  }

  // ── Etapa CRUD ─────────────────────────────────────────────────────────────

  function nuevaEtapa() {
    if (!proceso) return;
    const ne: Etapa = { id: uid(), titulo: `Etapa ${proceso.etapas.length + 1}`, pasos: [] };
    update(proceso.id, { etapas: [...proceso.etapas, ne] });
  }

  function updateEtapa(etapaId: string, cambios: Partial<Etapa>) {
    if (!proceso) return;
    update(proceso.id, {
      etapas: proceso.etapas.map((e) => (e.id === etapaId ? { ...e, ...cambios } : e)),
    });
  }

  function eliminarEtapa(etapaId: string) {
    if (!proceso) return;
    const etapa = proceso.etapas.find((e) => e.id === etapaId);
    if (etapa) enviarAPapelera({ id: etapa.id, tipo: "etapa", titulo: etapa.titulo, datos: { ...etapa, procesoId: proceso.id } });
    update(proceso.id, { etapas: proceso.etapas.filter((e) => e.id !== etapaId) });
  }

  // ── Paso CRUD ──────────────────────────────────────────────────────────────

  function nuevoPaso(etapaId: string) {
    if (!proceso) return;
    const etapa = proceso.etapas.find((e) => e.id === etapaId);
    if (!etapa) return;
    const np: Paso = { id: uid(), titulo: "Nuevo paso", descripcion: "" };
    updateEtapa(etapaId, { pasos: [...etapa.pasos, np] });
  }

  function updatePaso(etapaId: string, pasoId: string, cambios: Partial<Paso>) {
    if (!proceso) return;
    const etapa = proceso.etapas.find((e) => e.id === etapaId);
    if (!etapa) return;
    updateEtapa(etapaId, {
      pasos: etapa.pasos.map((p) => (p.id === pasoId ? { ...p, ...cambios } : p)),
    });
  }

  function eliminarPaso(etapaId: string, pasoId: string) {
    if (!proceso) return;
    const etapa = proceso.etapas.find((e) => e.id === etapaId);
    if (!etapa) return;
    const paso = etapa.pasos.find((p) => p.id === pasoId);
    if (paso) enviarAPapelera({ id: paso.id, tipo: "paso", titulo: paso.titulo, datos: { ...paso, etapaId } });
    updateEtapa(etapaId, { pasos: etapa.pasos.filter((p) => p.id !== pasoId) });
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex max-w-[1400px] gap-6">

      {/* ── Lista de procesos ──────────────────────────────────────────────── */}
      <aside className="flex w-[210px] shrink-0 flex-col">
        <h1 className="mb-4 font-display text-[28px] leading-none">Procesos</h1>

        <div className="flex flex-col gap-0.5">
          {procesos.map((p) => (
            <div key={p.id} className="group relative">
              <button
                type="button"
                onClick={() => { setSelectedId(p.id); setEditTitulo(false); }}
                className={[
                  "w-full rounded-[10px] px-3 py-2.5 text-left text-[13.5px] transition-colors",
                  p.id === selectedId
                    ? "notch bg-lime font-bold text-ink"
                    : "text-ink-2 hover:bg-line-soft hover:text-ink",
                ].join(" ")}
              >
                <span className="block truncate pr-5">{p.titulo}</span>
              </button>
              <button
                type="button"
                title="Eliminar proceso"
                onClick={(e) => { e.stopPropagation(); setConfirmProceso(p.id); }}
                className={[
                  "absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-[5px] opacity-0 transition-all group-hover:opacity-100",
                  p.id === selectedId
                    ? "text-ink/40 hover:bg-ink/10 hover:text-ink/70"
                    : "text-ink-3 hover:bg-line-soft hover:text-crit",
                ].join(" ")}
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={nuevoProceso}
          className="mt-3 flex items-center gap-2 rounded-[10px] border border-dashed border-line px-3 py-2.5 text-[13px] text-ink-3 transition-colors hover:border-ink-3/50 hover:bg-line-soft hover:text-ink"
        >
          <Plus size={14} strokeWidth={2} />
          Nuevo proceso
        </button>
      </aside>

      {confirmProceso && (
        <ConfirmDialog
          titulo="¿Eliminar proceso?"
          mensaje="Se va a mover a la papelera con todas sus etapas."
          labelConfirmar="Mover a papelera"
          onConfirmar={() => { eliminarProceso(confirmProceso); setConfirmProceso(null); }}
          onCancelar={() => setConfirmProceso(null)}
        />
      )}
      {confirmEtapa && (
        <ConfirmDialog
          titulo="¿Eliminar etapa?"
          mensaje="Se va a mover a la papelera con todos sus pasos."
          labelConfirmar="Mover a papelera"
          onConfirmar={() => { eliminarEtapa(confirmEtapa.etapaId); setConfirmEtapa(null); }}
          onCancelar={() => setConfirmEtapa(null)}
        />
      )}
      {confirmPaso && (
        <ConfirmDialog
          titulo="¿Eliminar paso?"
          labelConfirmar="Mover a papelera"
          onConfirmar={() => { eliminarPaso(confirmPaso.etapaId, confirmPaso.pasoId); setConfirmPaso(null); }}
          onCancelar={() => setConfirmPaso(null)}
        />
      )}

      {/* ── Detalle del proceso ────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {proceso ? (
          <>
            {/* Título editable */}
            <div className="mb-5">
              {editTitulo ? (
                <input
                  ref={tituloRef}
                  value={tempTitulo}
                  onChange={(e) => setTempTitulo(e.target.value)}
                  onBlur={guardarTitulo}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") guardarTitulo();
                    if (e.key === "Escape") setEditTitulo(false);
                  }}
                  className="w-full bg-transparent font-display text-[28px] leading-none outline-none border-b-2 border-lime"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { setTempTitulo(proceso.titulo); setEditTitulo(true); }}
                  className="group flex items-center gap-2.5"
                >
                  <h2 className="font-display text-[28px] leading-none">{proceso.titulo}</h2>
                  <Pencil
                    size={14}
                    strokeWidth={2}
                    className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>
              )}
            </div>

            {/* Etapas — scroll horizontal */}
            <div className="flex gap-4 overflow-x-auto pb-6">
              {proceso.etapas.map((etapa, idx) => (
                <EtapaCol
                  key={etapa.id}
                  etapa={etapa}
                  numero={idx + 1}
                  color={PALETA[idx % PALETA.length]}
                  onRename={(titulo) => updateEtapa(etapa.id, { titulo })}
                  onDelete={() => setConfirmEtapa({ procesoId: proceso.id, etapaId: etapa.id })}
                  onNuevoPaso={() => nuevoPaso(etapa.id)}
                  onEditarPaso={(pasoId, cambios) => updatePaso(etapa.id, pasoId, cambios)}
                  onEliminarPaso={(pasoId) => setConfirmPaso({ etapaId: etapa.id, pasoId })}
                />
              ))}

              {/* + Agregar etapa */}
              <button
                type="button"
                onClick={nuevaEtapa}
                className="flex h-fit w-[250px] shrink-0 items-center gap-2 rounded-card border border-dashed border-line px-4 py-3.5 text-[13.5px] text-ink-3 transition-colors hover:border-ink-3/50 hover:bg-line-soft hover:text-ink"
              >
                <Plus size={15} strokeWidth={2} />
                Agregar etapa
              </button>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-line py-24">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-line-soft text-ink-3">
              <BookText size={22} strokeWidth={1.8} />
            </span>
            <div className="text-center">
              <p className="text-[15px] font-bold">Sin procesos todavía</p>
              <p className="mt-1 text-[13px] text-ink-3">Creá el primero desde el panel izquierdo</p>
            </div>
            <button
              type="button"
              onClick={nuevoProceso}
              className="flex items-center gap-1.5 rounded-[10px] bg-lime px-4 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85"
            >
              <Plus size={14} strokeWidth={2.4} />
              Nuevo proceso
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Columna de etapa ─────────────────────────────────────────────────────────

function EtapaCol({
  etapa, numero, color, onRename, onDelete, onNuevoPaso, onEditarPaso, onEliminarPaso,
}: {
  etapa: Etapa;
  numero: number;
  color: { bg: string; text: string };
  onRename: (titulo: string) => void;
  onDelete: () => void;
  onNuevoPaso: () => void;
  onEditarPaso: (pasoId: string, cambios: Partial<Paso>) => void;
  onEliminarPaso: (pasoId: string) => void;
}) {
  const [editando,   setEditando]   = useState(false);
  const [tempTitulo, setTempTitulo] = useState(etapa.titulo);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editando) inputRef.current?.focus(); }, [editando]);
  useEffect(() => { startTransition(() => setTempTitulo(etapa.titulo)); }, [etapa.titulo]);

  function guardar() {
    const t = tempTitulo.trim();
    if (t) onRename(t);
    setEditando(false);
  }

  return (
    <div className="flex w-[250px] shrink-0 flex-col gap-2.5">

      {/* Header */}
      <div className="group flex items-center gap-2">
        <span
          className={[
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            color.bg,
            color.text,
          ].join(" ")}
        >
          {numero}
        </span>

        {editando ? (
          <input
            ref={inputRef}
            value={tempTitulo}
            onChange={(e) => setTempTitulo(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setEditando(false); }}
            className="min-w-0 flex-1 rounded-[6px] border border-line bg-card px-2 py-0.5 font-display text-[14px] font-bold outline-none focus:border-ink/40"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setTempTitulo(etapa.titulo); setEditando(true); }}
            className="min-w-0 flex-1 text-left font-display text-[14px] font-bold text-ink hover:text-ink-2"
          >
            {etapa.titulo}
          </button>
        )}

        <button
          type="button"
          title="Eliminar etapa"
          onClick={onDelete}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-line-soft hover:text-crit"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Pasos */}
      <div className="flex flex-col gap-2">
        {etapa.pasos.map((paso, idx) => (
          <PasoCard
            key={paso.id}
            paso={paso}
            numero={idx + 1}
            onEditar={(cambios) => onEditarPaso(paso.id, cambios)}
            onEliminar={() => onEliminarPaso(paso.id)}
          />
        ))}
      </div>

      {/* + Agregar paso */}
      <button
        type="button"
        onClick={onNuevoPaso}
        className="flex items-center gap-2 rounded-[10px] border border-dashed border-line px-3 py-2.5 text-[12.5px] text-ink-3 transition-colors hover:border-ink-3/40 hover:bg-line-soft hover:text-ink"
      >
        <Plus size={13} strokeWidth={2} />
        Agregar paso
      </button>
    </div>
  );
}

// ─── Tarjeta de paso ──────────────────────────────────────────────────────────

function PasoCard({
  paso, numero, onEditar, onEliminar,
}: {
  paso: Paso;
  numero: number;
  onEditar: (cambios: Partial<Paso>) => void;
  onEliminar: () => void;
}) {
  const [editTitulo, setEditTitulo] = useState(false);
  const [editDesc,   setEditDesc]   = useState(false);
  const [tempTitulo, setTempTitulo] = useState(paso.titulo);
  const [tempDesc,   setTempDesc]   = useState(paso.descripcion);
  const tituloRef = useRef<HTMLInputElement>(null);
  const descRef   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editTitulo) tituloRef.current?.focus(); }, [editTitulo]);
  useEffect(() => { if (editDesc)   descRef.current?.focus();   }, [editDesc]);
  useEffect(() => { startTransition(() => { setTempTitulo(paso.titulo); setTempDesc(paso.descripcion); }); }, [paso]);

  function guardarTitulo() {
    const t = tempTitulo.trim();
    if (t) onEditar({ titulo: t });
    setEditTitulo(false);
  }

  function guardarDesc() {
    onEditar({ descripcion: tempDesc });
    setEditDesc(false);
  }

  return (
    <div className="group relative rounded-[12px] border border-line bg-card p-3.5 transition-shadow hover:shadow-sm">

      {/* Número */}
      <span className="mb-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-line-soft text-[10px] font-bold text-ink-3">
        {numero}
      </span>

      {/* Título */}
      {editTitulo ? (
        <input
          ref={tituloRef}
          value={tempTitulo}
          onChange={(e) => setTempTitulo(e.target.value)}
          onBlur={guardarTitulo}
          onKeyDown={(e) => { if (e.key === "Enter") guardarTitulo(); if (e.key === "Escape") setEditTitulo(false); }}
          className="mb-2 w-full rounded-[6px] border border-line bg-paper px-2 py-1 text-[13.5px] font-bold text-ink outline-none focus:border-ink/40"
        />
      ) : (
        <button
          type="button"
          onClick={() => { setTempTitulo(paso.titulo); setEditTitulo(true); }}
          className="mb-2 block w-full text-left text-[13.5px] font-bold text-ink leading-snug hover:text-ink-2"
        >
          {paso.titulo}
        </button>
      )}

      {/* Descripción */}
      {editDesc ? (
        <textarea
          ref={descRef}
          value={tempDesc}
          onChange={(e) => setTempDesc(e.target.value)}
          onBlur={guardarDesc}
          onKeyDown={(e) => { if (e.key === "Escape") guardarDesc(); }}
          rows={3}
          className="w-full resize-none rounded-[6px] border border-line bg-paper px-2 py-1.5 text-[12px] leading-relaxed text-ink-2 outline-none focus:border-ink/40"
        />
      ) : (
        <button
          type="button"
          onClick={() => { setTempDesc(paso.descripcion); setEditDesc(true); }}
          className="block w-full text-left text-[12px] leading-relaxed"
        >
          {paso.descripcion
            ? <span className="text-ink-2">{paso.descripcion}</span>
            : <span className="italic text-ink-3/50">Agregar descripción…</span>
          }
        </button>
      )}

      {/* Eliminar */}
      <button
        type="button"
        title="Eliminar paso"
        onClick={onEliminar}
        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-[5px] text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-line-soft hover:text-crit"
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </div>
  );
}
