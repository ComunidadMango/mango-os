"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, X, Trash2, Pencil, ChevronDown, ArrowLeft, Settings2, FolderPlus, Folder, Paperclip, FileText, Download } from "lucide-react";
import { ICONOS_PAGINA, type PaginaCustom } from "@/lib/paginas";
import { equipo, clientes, persona } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type ColorEstado = "gray" | "green" | "red" | "yellow" | "lime" | "blue";

type EstadoConfig = {
  id: string;
  titulo: string;
  color: ColorEstado;
};

type Idea = {
  id: string;
  texto: string;
  cliente: string;
  quienes: string[];   // múltiples autores
  estado: string;      // referencia a EstadoConfig.id
};

type Objetivo = {
  id: string;
  texto: string;
  responsables: string[]; // vacío = todos
  hecho: boolean;
};

type TipoActa = "interno" | "cliente" | "kickoff" | "one-on-one" | "otro";

type Adjunto = {
  id: string;
  nombre: string;
  tipo: string;    // MIME
  tamaño: number;  // bytes
  dataUrl: string; // base64
};

type Acta = {
  id: string;
  fecha: string;
  tipo: TipoActa;
  tipoCustom?: string;
  clienteId?: string;
  participantes: string[];
  carpetaId?: string;
  puntos: string;
  pasos: string;
  adjuntos?: Adjunto[];
};

type Carpeta = {
  id: string;
  nombre: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COLORES
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_CFG: Record<ColorEstado, { bg: string; text: string; punto: string; border: string }> = {
  gray:   { bg: "bg-line-soft",  text: "text-ink-2",   punto: "bg-ink-3",  border: "border-ink-3/30"  },
  green:  { bg: "bg-ok-bg",      text: "text-ok",       punto: "bg-ok",     border: "border-ok/40"     },
  red:    { bg: "bg-crit-bg",    text: "text-crit",     punto: "bg-crit",   border: "border-crit/40"   },
  yellow: { bg: "bg-warn-bg",    text: "text-warn",     punto: "bg-warn",   border: "border-warn/40"   },
  lime:   { bg: "bg-lime-soft",  text: "text-ink",      punto: "bg-lime",   border: "border-lime/60"   },
  blue:   { bg: "bg-ok-bg/50",   text: "text-ok",       punto: "bg-ok",     border: "border-ok/30"     },
};

const COLORES: ColorEstado[] = ["gray", "green", "red", "yellow", "lime", "blue"];

const COLOR_NOMBRES: Record<ColorEstado, string> = {
  gray: "Gris", green: "Verde", red: "Rojo", yellow: "Amarillo", lime: "Lima", blue: "Azul",
};

const ESTADOS_DEFAULT: EstadoConfig[] = [
  { id: "por-probar", titulo: "Por probar", color: "gray"  },
  { id: "en-curso",   titulo: "En curso",   color: "green" },
  { id: "descartada", titulo: "Descartada", color: "red"   },
];

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE — helpers localStorage (cache optimista mientras Supabase responde)
// ─────────────────────────────────────────────────────────────────────────────

function leer<T>(clave: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(clave) ?? "null") ?? fallback; }
  catch { return fallback; }
}
function guardar(clave: string, valor: unknown) {
  if (typeof window !== "undefined") localStorage.setItem(clave, JSON.stringify(valor));
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGet<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch { return fallback; }
}
async function apiPost<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}
async function apiPatch<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}
async function apiDelete(url: string): Promise<void> {
  try { await fetch(url, { method: "DELETE" }); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS  = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

function fechaLarga(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  const dia = DIAS[new Date(iso + "T12:00:00").getDay()];
  return `${dia} ${d} de ${MESES[m - 1]}`;
}
function hoyISO() { return new Date().toISOString().slice(0, 10); }

const inputCls = "w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-3/60 focus:border-ink-3";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">{label}</label>
      {children}
    </div>
  );
}

function ChipPersona({ persona: p, activo, onClick }: {
  persona: { id: string; nombre: string; inicial: string };
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={["flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] transition-all",
        activo ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink-3/50",
      ].join(" ")}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-lime-soft text-[10px] font-bold text-ink">
        {p.inicial}
      </span>
      {p.nombre}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RAÍZ
// ─────────────────────────────────────────────────────────────────────────────

export default function PaginaPersonalizada(props: PageProps<"/paginas/[id]">) {
  const { id } = use(props.params);
  const [pagina, setPagina] = useState<PaginaCustom | null | "cargando">("cargando");

  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      // Intentar Supabase primero
      try {
        const res = await fetch(`/api/db/paginas/${id}`);
        if (!res.ok) throw new Error("not found");
        const { pagina: row } = await res.json() as {
          pagina: { id: string; nombre: string; tipo: string; icono: string; visibilidad: string; creado_en: string }
        };
        if (!cancelled) {
          setPagina({
            id:          row.id,
            nombre:      row.nombre,
            tipo:        row.tipo as PaginaCustom["tipo"],
            icono:       row.icono,
            visibilidad: row.visibilidad as PaginaCustom["visibilidad"],
            creadoEn:    row.creado_en,
          });
        }
      } catch {
        // Fallback a localStorage
        try {
          const stored = localStorage.getItem("mango-paginas");
          if (!stored) { if (!cancelled) setPagina(null); return; }
          const todas = JSON.parse(stored) as PaginaCustom[];
          if (!cancelled) setPagina(todas.find(p => p.id === id) ?? null);
        } catch { if (!cancelled) setPagina(null); }
      }
    }
    cargar();
    return () => { cancelled = true; };
  }, [id]);

  if (pagina === "cargando") return null;

  if (!pagina) {
    return (
      <div className="mx-auto max-w-[1180px]">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
          <ArrowLeft size={14} strokeWidth={2} /> Inicio
        </Link>
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line py-20">
          <p className="text-[14px] text-ink-3">Página no encontrada.</p>
        </div>
      </div>
    );
  }

  if (pagina.tipo === "banco-ideas") return <BancoDeIdeas pagina={pagina} />;
  if (pagina.tipo === "objetivos")   return <ObjetivosDeMes pagina={pagina} />;
  if (pagina.tipo === "actas")       return <ActasDeReunion pagina={pagina} />;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────

function PageHeader({ pagina, cta, onCta, extra }: {
  pagina: PaginaCustom; cta: string; onCta: () => void; extra?: React.ReactNode;
}) {
  const Icono = ICONOS_PAGINA[pagina.icono] ?? null;
  return (
    <header className="mb-6 flex flex-wrap items-center gap-3">
      {Icono && (
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-lime-soft text-ink">
          <Icono size={18} strokeWidth={2} />
        </span>
      )}
      <h1 className="font-display text-[28px] leading-none">{pagina.nombre}</h1>
      {extra}
      <button type="button" onClick={onCta}
        className="ml-auto flex items-center gap-2 rounded-[10px] bg-lime px-3.5 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85">
        <Plus size={15} strokeWidth={2.4} />
        {cta}
      </button>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BANCO DE IDEAS
// ─────────────────────────────────────────────────────────────────────────────

function BancoDeIdeas({ pagina }: { pagina: PaginaCustom }) {
  const usuario = useUsuarioActual();
  const claveIdeas   = `mango-banco-${pagina.id}`;
  const claveEstados = `mango-banco-estados-${pagina.id}`;

  const [ideas,   setIdeas]   = useState<Idea[]>(() => leer<Idea[]>(claveIdeas, []));
  const [estados, setEstados] = useState<EstadoConfig[]>(() => leer<EstadoConfig[]>(claveEstados, ESTADOS_DEFAULT));

  // Cargar desde Supabase al montar
  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      try {
        const res = await fetch(`/api/db/paginas/${pagina.id}`);
        if (!res.ok) return;
        const data = await res.json() as {
          estados: Array<{ id: string; titulo: string; color: string }>;
          ideas: Array<{ id: string; texto: string; cliente: string; quienes: string[]; estado_id: string }>;
        };
        if (cancelled) return;
        if (data.estados.length > 0) {
          const e: EstadoConfig[] = data.estados.map(r => ({ id: r.id, titulo: r.titulo, color: r.color as ColorEstado }));
          setEstados(e);
          guardar(claveEstados, e);
        }
        if (data.ideas.length > 0) {
          const i: Idea[] = data.ideas.map(r => ({ id: r.id, texto: r.texto, cliente: r.cliente, quienes: r.quienes, estado: r.estado_id }));
          setIdeas(i);
          guardar(claveIdeas, i);
        }
      } catch {}
    }
    cargar();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina.id]);

  const [drawerIdea,    setDrawerIdea]    = useState(false);
  const [drawerEstados, setDrawerEstados] = useState(false);

  // Form idea
  const [editId,   setEditId]   = useState<string | null>(null);
  const [texto,    setTexto]    = useState("");
  const [cliente,  setCliente]  = useState("");
  const [quienes,  setQuienes]  = useState<string[]>([usuario.id]);
  const [estadoId, setEstadoId] = useState(estados[0]?.id ?? "");

  // Gestión estados
  const [nuevoEstNombre, setNuevoEstNombre] = useState("");
  const [nuevoEstColor,  setNuevoEstColor]  = useState<ColorEstado>("gray");
  const [editEstId,      setEditEstId]      = useState<string | null>(null);
  const [editEstNombre,  setEditEstNombre]  = useState("");
  const [editEstColor,   setEditEstColor]   = useState<ColorEstado>("gray");

  function persistIdeas(next: Idea[])           { setIdeas(next);   guardar(claveIdeas, next); }
  function persistEstados(next: EstadoConfig[]) { setEstados(next); guardar(claveEstados, next); }

  function abrirNueva() {
    setEditId(null); setTexto(""); setCliente(""); setQuienes([usuario.id]);
    setEstadoId(estados[0]?.id ?? "");
    setDrawerIdea(true);
  }

  function abrirEdicion(idea: Idea) {
    setEditId(idea.id); setTexto(idea.texto); setCliente(idea.cliente);
    setQuienes(idea.quienes); setEstadoId(idea.estado);
    setDrawerIdea(true);
  }

  async function guardarIdea() {
    if (!texto.trim()) return;
    if (editId) {
      const item: Idea = { id: editId, texto: texto.trim(), cliente: cliente.trim(), quienes, estado: estadoId };
      persistIdeas(ideas.map(i => i.id === editId ? item : i));
      setDrawerIdea(false);
      await apiPatch(`/api/db/paginas/${pagina.id}/ideas/${editId}`, {
        texto: item.texto, cliente: item.cliente, quienes: item.quienes, estado_id: item.estado,
      });
    } else {
      const tempId = `idea-${Date.now()}`;
      const item: Idea = { id: tempId, texto: texto.trim(), cliente: cliente.trim(), quienes, estado: estadoId };
      persistIdeas([...ideas, item]);
      setDrawerIdea(false);
      const saved = await apiPost<{ id: string }>(`/api/db/paginas/${pagina.id}/ideas`, {
        texto: item.texto, cliente: item.cliente, quienes: item.quienes, estado_id: item.estado,
      });
      if (saved) {
        setIdeas(prev => prev.map(i => i.id === tempId ? { ...i, id: saved.id } : i));
      }
    }
  }

  async function eliminarIdea(id: string) {
    persistIdeas(ideas.filter(i => i.id !== id));
    await apiDelete(`/api/db/paginas/${pagina.id}/ideas/${id}`);
  }
  async function moverIdea(id: string, nuevoEstado: string) {
    persistIdeas(ideas.map(i => i.id === id ? { ...i, estado: nuevoEstado } : i));
    await apiPatch(`/api/db/paginas/${pagina.id}/ideas/${id}`, { estado_id: nuevoEstado });
  }
  function toggleQuien(id: string) {
    setQuienes(prev => prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id]);
  }

  // Estados CRUD
  async function agregarEstado() {
    if (!nuevoEstNombre.trim()) return;
    const tempId = `est-${Date.now()}`;
    const nuevo: EstadoConfig = { id: tempId, titulo: nuevoEstNombre.trim(), color: nuevoEstColor };
    persistEstados([...estados, nuevo]);
    setNuevoEstNombre(""); setNuevoEstColor("gray");
    const saved = await apiPost<{ id: string }>(`/api/db/paginas/${pagina.id}/estados-banco`, {
      titulo: nuevo.titulo, color: nuevo.color,
    });
    if (saved) setEstados(prev => prev.map(e => e.id === tempId ? { ...e, id: saved.id } : e));
  }

  function iniciarEditEst(e: EstadoConfig) {
    setEditEstId(e.id); setEditEstNombre(e.titulo); setEditEstColor(e.color);
  }

  async function guardarEditEst() {
    if (!editEstNombre.trim()) return;
    persistEstados(estados.map(e => e.id === editEstId ? { ...e, titulo: editEstNombre.trim(), color: editEstColor } : e));
    setEditEstId(null);
    if (editEstId) {
      await apiPatch(`/api/db/paginas/${pagina.id}/estados-banco/${editEstId}`, {
        titulo: editEstNombre.trim(), color: editEstColor,
      });
    }
  }

  async function eliminarEstado(id: string) {
    const fallbackEstado = estados.find(e => e.id !== id)?.id ?? "";
    persistEstados(estados.filter(e => e.id !== id));
    persistIdeas(ideas.map(i => i.estado === id ? { ...i, estado: fallbackEstado } : i));
    await apiDelete(`/api/db/paginas/${pagina.id}/estados-banco/${id}`);
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader pagina={pagina} cta="Nueva idea" onCta={abrirNueva}
        extra={
          <button type="button" onClick={() => setDrawerEstados(true)}
            className="flex items-center gap-1.5 rounded-[9px] border border-line px-3 py-1.5 text-[12.5px] text-ink-3 transition-colors hover:border-ink-3/40 hover:text-ink">
            <Settings2 size={13} strokeWidth={2} /> Estados
          </button>
        }
      />

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${estados.length}, 1fr)` }}>
        {estados.map(col => {
          const colIdeas = ideas.filter(i => i.estado === col.id);
          const cfg = COLOR_CFG[col.color];
          return (
            <section key={col.id}>
              <header className="mb-3 flex items-center gap-2 border-b-2 border-line pb-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.punto}`} />
                <h2 className="font-display text-[11.5px] uppercase tracking-[0.08em] text-ink-3">{col.titulo}</h2>
                <span className="ml-auto text-[12px] tabular-nums text-ink-3">{colIdeas.length}</span>
              </header>

              <div className="flex flex-col gap-2">
                {colIdeas.length === 0 ? (
                  <div className="rounded-card border border-dashed border-line py-8 text-center">
                    <p className="text-[12.5px] text-ink-3">Sin ideas</p>
                  </div>
                ) : colIdeas.map(idea => {
                  const otrosEstados = estados.filter(e => e.id !== idea.estado);
                  return (
                    <article key={idea.id}
                      className="group relative rounded-card border border-line bg-card p-3.5 transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm">
                      <p className="mb-2.5 text-[13.5px] font-bold leading-snug">{idea.texto}</p>
                      {idea.cliente && (
                        <span className="mb-2 inline-block rounded-chip bg-lime-soft px-1.5 py-px text-[11px] font-bold text-ink">
                          {idea.cliente}
                        </span>
                      )}
                      {/* Mover a otro estado */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {otrosEstados.map(e => {
                          const c = COLOR_CFG[e.color];
                          return (
                            <button key={e.id} type="button" onClick={() => moverIdea(idea.id, e.id)}
                              className={`rounded-chip border px-1.5 py-px text-[10.5px] transition-colors ${c.bg} ${c.text} ${c.border} hover:opacity-80`}>
                              → {e.titulo}
                            </button>
                          );
                        })}
                        {/* Autores */}
                        {idea.quienes.length > 0 && (
                          <div className="ml-auto flex shrink-0 items-center gap-0.5">
                            {idea.quienes.map(qid => {
                              const p = persona(qid);
                              return p ? (
                                <span key={qid} title={p.nombre}
                                  className="notch-sm flex h-5 w-5 items-center justify-center rounded-[6px] bg-line-soft text-[9px] font-bold text-ink">
                                  {p.inicial}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                      {/* Acciones hover */}
                      <div className="absolute right-2.5 top-2.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => abrirEdicion(idea)}
                          className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-paper text-ink-3 hover:text-ink">
                          <Pencil size={11} strokeWidth={2} />
                        </button>
                        <button type="button" onClick={() => eliminarIdea(idea.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-paper text-ink-3 hover:text-crit">
                          <Trash2 size={11} strokeWidth={2} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Drawer idea */}
      {drawerIdea && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]" onClick={() => setDrawerIdea(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col bg-paper shadow-2xl">
            <div className="flex shrink-0 items-center border-b border-line px-5 py-4">
              <h2 className="font-display text-[19px] leading-none">{editId ? "Editar idea" : "Nueva idea"}</h2>
              <button type="button" onClick={() => setDrawerIdea(false)}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 hover:bg-line-soft hover:text-ink">
                <X size={17} strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <Campo label="Idea">
                <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} autoFocus
                  placeholder="¿Cuál es la idea?"
                  className={`${inputCls} resize-none`} />
              </Campo>
              <Campo label="Cliente (opcional)">
                <input value={cliente} onChange={e => setCliente(e.target.value)}
                  placeholder="Ej: Casa Praga" className={inputCls} />
              </Campo>
              <Campo label="De quién es la idea (puede ser más de uno)">
                <div className="flex flex-wrap gap-2">
                  {equipo.map(p => (
                    <ChipPersona key={p.id} persona={p} activo={quienes.includes(p.id)} onClick={() => toggleQuien(p.id)} />
                  ))}
                </div>
              </Campo>
              <Campo label="Estado">
                <div className="flex flex-wrap gap-2">
                  {estados.map(e => {
                    const cfg = COLOR_CFG[e.color];
                    return (
                      <button key={e.id} type="button" onClick={() => setEstadoId(e.id)}
                        className={["rounded-[10px] border px-3 py-2 text-[12.5px] font-bold transition-all",
                          estadoId === e.id ? `${cfg.bg} ${cfg.text} border-transparent` : "border-line bg-card text-ink-2 hover:border-ink-3/50",
                        ].join(" ")}>
                        {e.titulo}
                      </button>
                    );
                  })}
                </div>
              </Campo>
            </div>
            <div className="shrink-0 border-t border-line px-5 py-4">
              <button type="button" onClick={guardarIdea} disabled={!texto.trim()}
                className="flex w-full items-center justify-center rounded-[10px] bg-lime px-4 py-2.5 text-[14px] font-bold text-ink hover:opacity-85 disabled:opacity-40">
                {editId ? "Guardar cambios →" : "Agregar idea →"}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Drawer gestión estados */}
      {drawerEstados && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]" onClick={() => setDrawerEstados(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col bg-paper shadow-2xl">
            <div className="flex shrink-0 items-center border-b border-line px-5 py-4">
              <h2 className="font-display text-[19px] leading-none">Gestionar estados</h2>
              <button type="button" onClick={() => setDrawerEstados(false)}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 hover:bg-line-soft hover:text-ink">
                <X size={17} strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <ul className="mb-5 flex flex-col gap-2">
                {estados.map(e => {
                  const cfg = COLOR_CFG[e.color];
                  return editEstId === e.id ? (
                    <li key={e.id} className="rounded-[10px] border border-line bg-card p-3 space-y-2">
                      <input value={editEstNombre} onChange={ev => setEditEstNombre(ev.target.value)} autoFocus
                        className="w-full rounded-[8px] border border-line bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-ink-3" />
                      <div className="flex flex-wrap gap-1.5">
                        {COLORES.map(c => (
                          <button key={c} type="button" onClick={() => setEditEstColor(c)}
                            className={["flex items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-[11.5px] transition-all",
                              editEstColor === c ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink-2 hover:border-ink-3/50",
                            ].join(" ")}>
                            <span className={`h-2.5 w-2.5 rounded-full ${COLOR_CFG[c].punto}`} />
                            {COLOR_NOMBRES[c]}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditEstId(null)}
                          className="flex-1 rounded-[8px] border border-line py-1.5 text-[12.5px] text-ink-3 hover:text-ink">
                          Cancelar
                        </button>
                        <button type="button" onClick={guardarEditEst}
                          className="flex-1 rounded-[8px] bg-lime py-1.5 text-[12.5px] font-bold text-ink hover:opacity-85">
                          Guardar →
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li key={e.id}
                      className="group flex items-center gap-3 rounded-[10px] border border-line bg-card px-3.5 py-3">
                      <span className={`h-3 w-3 shrink-0 rounded-full ${cfg.punto}`} />
                      <span className={`flex-1 rounded-chip px-2 py-px text-[12.5px] font-bold ${cfg.bg} ${cfg.text}`}>
                        {e.titulo}
                      </span>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => iniciarEditEst(e)}
                          className="flex h-6 w-6 items-center justify-center rounded-[7px] text-ink-3 hover:text-ink">
                          <Pencil size={11} strokeWidth={2} />
                        </button>
                        <button type="button" onClick={() => eliminarEstado(e.id)}
                          disabled={estados.length <= 1}
                          className="flex h-6 w-6 items-center justify-center rounded-[7px] text-ink-3 hover:text-crit disabled:opacity-30">
                          <Trash2 size={11} strokeWidth={2} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Nuevo estado */}
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Nuevo estado</p>
              <div className="space-y-2 rounded-[10px] border border-line bg-card p-3">
                <input value={nuevoEstNombre} onChange={e => setNuevoEstNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") agregarEstado(); }}
                  placeholder="Nombre del estado"
                  className="w-full rounded-[8px] border border-line bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-ink-3 placeholder:text-ink-3/60" />
                <div className="flex flex-wrap gap-1.5">
                  {COLORES.map(c => (
                    <button key={c} type="button" onClick={() => setNuevoEstColor(c)}
                      className={["flex items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-[11.5px] transition-all",
                        nuevoEstColor === c ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink-2 hover:border-ink-3/50",
                      ].join(" ")}>
                      <span className={`h-2.5 w-2.5 rounded-full ${COLOR_CFG[c].punto}`} />
                      {COLOR_NOMBRES[c]}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={agregarEstado} disabled={!nuevoEstNombre.trim()}
                  className="w-full rounded-[8px] bg-lime py-2 text-[13px] font-bold text-ink hover:opacity-85 disabled:opacity-40">
                  Agregar estado →
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OBJETIVOS DEL MES
// ─────────────────────────────────────────────────────────────────────────────

function ObjetivosDeMes({ pagina }: { pagina: PaginaCustom }) {
  const usuario = useUsuarioActual();
  const clave = `mango-obj-${pagina.id}`;
  const [objetivos, setObjetivos] = useState<Objetivo[]>(() => leer<Objetivo[]>(clave, []));

  // Cargar desde Supabase al montar
  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      try {
        const res = await fetch(`/api/db/paginas/${pagina.id}/objetivos`);
        if (!res.ok) return;
        const rows = await res.json() as Array<{ id: string; texto: string; responsables: string[]; hecho: boolean }>;
        if (cancelled || rows.length === 0) return;
        const objs: Objetivo[] = rows.map(r => ({ id: r.id, texto: r.texto, responsables: r.responsables, hecho: r.hecho }));
        setObjetivos(objs);
        guardar(clave, objs);
      } catch {}
    }
    cargar();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina.id]);
  const [agregando,    setAgregando]    = useState(false);
  const [nuevoTexto,   setNuevoTexto]   = useState("");
  const [nuevoResps,   setNuevoResps]   = useState<string[]>([usuario.id]);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [editTexto,    setEditTexto]    = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function persist(next: Objetivo[]) { setObjetivos(next); guardar(clave, next); }

  async function agregar() {
    if (!nuevoTexto.trim()) return;
    const tempId = `obj-${Date.now()}`;
    const nuevo: Objetivo = { id: tempId, texto: nuevoTexto.trim(), responsables: nuevoResps, hecho: false };
    persist([...objetivos, nuevo]);
    setNuevoTexto(""); setNuevoResps([usuario.id]); setAgregando(false);
    const saved = await apiPost<{ id: string }>(`/api/db/paginas/${pagina.id}/objetivos`, {
      texto: nuevo.texto, responsables: nuevo.responsables, hecho: false,
    });
    if (saved) setObjetivos(prev => prev.map(o => o.id === tempId ? { ...o, id: saved.id } : o));
  }

  async function toggle(id: string) {
    const next = objetivos.map(o => o.id === id ? { ...o, hecho: !o.hecho } : o);
    persist(next);
    const obj = next.find(o => o.id === id);
    if (obj) await apiPatch(`/api/db/paginas/${pagina.id}/objetivos/${id}`, { hecho: obj.hecho });
  }

  async function eliminar(id: string) {
    persist(objetivos.filter(o => o.id !== id));
    await apiDelete(`/api/db/paginas/${pagina.id}/objetivos/${id}`);
  }

  function iniciarEdicion(o: Objetivo) { setEditId(o.id); setEditTexto(o.texto); }
  async function guardarEdicion() {
    if (!editTexto.trim()) return;
    persist(objetivos.map(o => o.id === editId ? { ...o, texto: editTexto.trim() } : o));
    if (editId) await apiPatch(`/api/db/paginas/${pagina.id}/objetivos/${editId}`, { texto: editTexto.trim() });
    setEditId(null);
  }

  function toggleResp(id: string) {
    setNuevoResps(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  }

  function setTodos() { setNuevoResps([]); }

  // Display helpers
  function etiquetaResps(resps: string[]) {
    if (resps.length === 0) return "Todo el equipo";
    return resps.map(id => persona(id)?.nombre ?? id).join(", ");
  }

  const total = objetivos.length;
  const completados = objetivos.filter(o => o.hecho).length;
  const pct = total === 0 ? 0 : Math.round((completados / total) * 100);

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader pagina={pagina} cta="Nuevo objetivo" onCta={() => {
        setAgregando(true); setTimeout(() => inputRef.current?.focus(), 50);
      }} />

      {total > 0 && (
        <div className="mb-6 rounded-card border border-line bg-card px-5 py-4">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[13px] text-ink-2">{completados} de {total} completados</span>
            <span className="font-display text-[15px] tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line-soft">
            <div className="h-full rounded-full bg-lime transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-line bg-card">
        {objetivos.length === 0 && !agregando ? (
          <div className="py-12 text-center">
            <p className="text-[13.5px] text-ink-3">Sin objetivos — agregá el primero</p>
          </div>
        ) : objetivos.map((obj, i) => (
          <div key={obj.id}
            className={["group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper",
              i > 0 ? "border-t border-line-soft" : "",
            ].join(" ")}>
            {/* Checkbox */}
            <button type="button" onClick={() => toggle(obj.id)}
              className={["flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-all",
                obj.hecho ? "border-ok bg-ok" : "border-line hover:border-ok/60",
              ].join(" ")}>
              {obj.hecho && (
                <svg width="9" height="8" viewBox="0 0 9 8" fill="none">
                  <path d="M1.5 4L3.5 6L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* Texto */}
            {editId === obj.id ? (
              <input value={editTexto} onChange={e => setEditTexto(e.target.value)} autoFocus
                onBlur={guardarEdicion}
                onKeyDown={e => { if (e.key === "Enter") guardarEdicion(); if (e.key === "Escape") setEditId(null); }}
                className="flex-1 rounded-[8px] border border-line bg-card px-2.5 py-1 text-[14px] outline-none focus:border-ink-3" />
            ) : (
              <span onClick={() => !obj.hecho && iniciarEdicion(obj)}
                className={["flex-1 text-[14px]", obj.hecho ? "text-ink-3 line-through" : "cursor-text font-bold"].join(" ")}>
                {obj.texto}
              </span>
            )}

            {/* Responsables */}
            <div className="flex shrink-0 items-center gap-1.5">
              {obj.responsables.length === 0 ? (
                <span className="rounded-chip bg-lime-soft px-2 py-px text-[11px] font-bold text-ink">
                  Todo el equipo
                </span>
              ) : obj.responsables.map(id => {
                const p = persona(id);
                return p ? (
                  <span key={id} title={p.nombre}
                    className="notch-sm flex h-5 w-5 items-center justify-center rounded-[6px] bg-lime-soft text-[9px] font-bold text-ink">
                    {p.inicial}
                  </span>
                ) : null;
              })}
            </div>

            {/* Eliminar */}
            <button type="button" onClick={() => eliminar(obj.id)}
              className="shrink-0 text-transparent transition-opacity group-hover:text-ink-3/50 hover:!text-crit">
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        ))}

        {/* Form inline agregar */}
        {agregando && (
          <div className={`space-y-3 bg-paper px-5 py-4 ${objetivos.length > 0 ? "border-t border-line-soft" : ""}`}>
            <input ref={inputRef} value={nuevoTexto} onChange={e => setNuevoTexto(e.target.value)}
              placeholder="¿Cuál es el objetivo?"
              onKeyDown={e => { if (e.key === "Enter") agregar(); if (e.key === "Escape") setAgregando(false); }}
              className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] outline-none focus:border-ink-3 placeholder:text-ink-3/60" />

            {/* Selector responsables */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Responsable(s)</p>
              <div className="flex flex-wrap gap-2">
                {/* Todos */}
                <button type="button" onClick={setTodos}
                  className={["flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12.5px] transition-all",
                    nuevoResps.length === 0 ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink-3/50",
                  ].join(" ")}>
                  Todo el equipo
                </button>
                {equipo.map(p => (
                  <ChipPersona key={p.id} persona={p} activo={nuevoResps.includes(p.id)} onClick={() => toggleResp(p.id)} />
                ))}
              </div>
              {nuevoResps.length > 0 && (
                <p className="mt-1 text-[11.5px] text-ink-3">{etiquetaResps(nuevoResps)}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAgregando(false)}
                className="rounded-[9px] border border-line px-3.5 py-1.5 text-[12.5px] text-ink-3 hover:text-ink">
                Cancelar
              </button>
              <button type="button" onClick={agregar} disabled={!nuevoTexto.trim()}
                className="rounded-[9px] bg-lime px-3.5 py-1.5 text-[12.5px] font-bold text-ink hover:opacity-85 disabled:opacity-40">
                Agregar →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTAS DE REUNIONES
// ─────────────────────────────────────────────────────────────────────────────

const TIPO_ACTA_CFG: Record<TipoActa, { texto: string; clase: string }> = {
  interno:      { texto: "Interno del equipo", clase: "bg-line-soft text-ink-2"  },
  cliente:      { texto: "Con cliente",         clase: "bg-ok-bg text-ok"         },
  kickoff:      { texto: "Kickoff",             clase: "bg-lime-soft text-ink"    },
  "one-on-one": { texto: "One-on-one",          clase: "bg-warn-bg text-warn"     },
  otro:         { texto: "Otro",                clase: "bg-line-soft text-ink-3"  },
};

const TIPOS_ACTA: TipoActa[] = ["interno", "cliente", "kickoff", "one-on-one", "otro"];

function fmtTamaño(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ActasDeReunion({ pagina }: { pagina: PaginaCustom }) {
  const usuario = useUsuarioActual();
  const claveActas    = `mango-actas-${pagina.id}`;
  const claveCarpetas = `mango-actas-carpetas-${pagina.id}`;

  const [actas,    setActas]    = useState<Acta[]>(() => leer<Acta[]>(claveActas, []));
  const [carpetas, setCarpetas] = useState<Carpeta[]>(() => leer<Carpeta[]>(claveCarpetas, []));

  // Cargar desde Supabase al montar
  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      try {
        const res = await fetch(`/api/db/paginas/${pagina.id}`);
        if (!res.ok) return;
        const data = await res.json() as {
          carpetas: Array<{ id: string; nombre: string }>;
          actas: Array<{
            id: string; fecha: string; tipo: string; tipo_custom: string | null;
            cliente_id: string | null; participantes: string[]; carpeta_id: string | null;
            puntos: string; pasos: string;
            adjuntos_actas?: Array<{ id: string; nombre: string; tipo: string; tamano: number; storage_path: string }>;
          }>;
        };
        if (cancelled) return;
        if (data.carpetas.length > 0) {
          const c: Carpeta[] = data.carpetas.map(r => ({ id: r.id, nombre: r.nombre }));
          setCarpetas(c);
          guardar(claveCarpetas, c);
        }
        if (data.actas.length > 0) {
          const a: Acta[] = data.actas.map(r => ({
            id:            r.id,
            fecha:         r.fecha,
            tipo:          r.tipo as TipoActa,
            tipoCustom:    r.tipo_custom ?? undefined,
            clienteId:     r.cliente_id ?? undefined,
            participantes: r.participantes,
            carpetaId:     r.carpeta_id ?? undefined,
            puntos:        r.puntos,
            pasos:         r.pasos,
            // adjuntos se manejan en Supabase Storage; no se cargan como base64
          }));
          setActas(a);
          guardar(claveActas, a);
        }
      } catch {}
    }
    cargar();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina.id]);

  const [drawerActa,        setDrawerActa]        = useState(false);
  const [expandidoId,       setExpandidoId]        = useState<string | null>(null);
  const [carpetaActiva,     setCarpetaActiva]      = useState<string | "todas">("todas");
  const [nuevaCarpeta,      setNuevaCarpeta]       = useState("");
  const [agregarCarp,       setAgregarCarp]        = useState(false);
  const [confirmarElimCarp, setConfirmarElimCarp]  = useState<string | null>(null);
  const carpetaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);

  // Form acta
  const [editId,       setEditId]       = useState<string | null>(null);
  const [fecha,        setFecha]        = useState(hoyISO());
  const [tipo,         setTipo]         = useState<TipoActa>("interno");
  const [tipoCustom,   setTipoCustom]   = useState("");
  const [clienteId,    setClienteId]    = useState<string>("");
  const [partics,      setPartics]      = useState<string[]>([usuario.id]);
  const [carpetaId,    setCarpetaId]    = useState<string>("");
  const [puntos,       setPuntos]       = useState("");
  const [pasos,        setPasos]        = useState("");
  const [adjuntosForm, setAdjuntosForm] = useState<Adjunto[]>([]);

  function persistActas(next: Acta[]) { setActas(next); guardar(claveActas, next); }
  function persistCarpetas(next: Carpeta[]) { setCarpetas(next); guardar(claveCarpetas, next); }

  function abrirNueva() {
    setEditId(null); setFecha(hoyISO()); setTipo("interno"); setTipoCustom("");
    setClienteId(""); setPartics([usuario.id]); setCarpetaId(""); setPuntos(""); setPasos("");
    setAdjuntosForm([]);
    setDrawerActa(true);
  }

  function abrirEdicion(a: Acta) {
    setEditId(a.id); setFecha(a.fecha); setTipo(a.tipo); setTipoCustom(a.tipoCustom ?? "");
    setClienteId(a.clienteId ?? ""); setPartics(a.participantes);
    setCarpetaId(a.carpetaId ?? ""); setPuntos(a.puntos); setPasos(a.pasos);
    setAdjuntosForm(a.adjuntos ?? []);
    setDrawerActa(true);
  }

  async function guardarActa() {
    if (!puntos.trim()) return;
    const payload = {
      fecha, tipo,
      tipoCustom:    tipo === "otro" ? tipoCustom.trim() : undefined,
      clienteId:     clienteId || undefined,
      participantes: partics,
      carpetaId:     carpetaId || undefined,
      puntos:        puntos.trim(),
      pasos:         pasos.trim(),
    };

    if (editId) {
      const item: Acta = { ...payload, id: editId, adjuntos: adjuntosForm.length > 0 ? adjuntosForm : undefined };
      persistActas(actas.map(a => a.id === editId ? item : a));
      setDrawerActa(false);
      await apiPatch(`/api/db/paginas/${pagina.id}/actas/${editId}`, payload);
    } else {
      const tempId = `acta-${Date.now()}`;
      const item: Acta = { ...payload, id: tempId, adjuntos: adjuntosForm.length > 0 ? adjuntosForm : undefined };
      const next = [item, ...actas].sort((a, b) => b.fecha.localeCompare(a.fecha));
      persistActas(next);
      setDrawerActa(false);
      const saved = await apiPost<{ id: string }>(`/api/db/paginas/${pagina.id}/actas`, payload);
      if (saved) {
        const actaId = saved.id;
        setActas(prev => prev.map(a => a.id === tempId ? { ...a, id: actaId } : a));
        // Subir adjuntos a Supabase Storage
        for (const adj of adjuntosForm) {
          const formData = new FormData();
          // Convertir base64 a Blob
          const response = await fetch(adj.dataUrl);
          const blob = await response.blob();
          formData.append("file", blob, adj.nombre);
          formData.append("actaId", actaId);
          await fetch("/api/db/actas/upload", { method: "POST", body: formData }).catch(() => {});
        }
      }
    }
  }

  async function eliminarActa(id: string) {
    persistActas(actas.filter(a => a.id !== id));
    await apiDelete(`/api/db/paginas/${pagina.id}/actas/${id}`);
  }
  function togglePartic(id: string) {
    setPartics(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    const MAX = 8 * 1024 * 1024; // 8 MB por archivo
    const nuevos = await Promise.all(
      archivos.filter(f => f.size <= MAX).map(f =>
        new Promise<Adjunto>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            id: `adj-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            nombre: f.name,
            tipo: f.type,
            tamaño: f.size,
            dataUrl: reader.result as string,
          });
          reader.readAsDataURL(f);
        })
      )
    );
    setAdjuntosForm(prev => [...prev, ...nuevos]);
    e.target.value = "";
  }

  function quitarAdjunto(id: string) {
    setAdjuntosForm(prev => prev.filter(a => a.id !== id));
  }

  async function crearCarpeta() {
    if (!nuevaCarpeta.trim()) return;
    const tempId = `carp-${Date.now()}`;
    const nueva: Carpeta = { id: tempId, nombre: nuevaCarpeta.trim() };
    persistCarpetas([...carpetas, nueva]);
    setNuevaCarpeta(""); setAgregarCarp(false);
    const saved = await apiPost<{ id: string }>(`/api/db/paginas/${pagina.id}/carpetas`, { nombre: nueva.nombre });
    if (saved) setCarpetas(prev => prev.map(c => c.id === tempId ? { ...c, id: saved.id } : c));
  }

  function confirmarEliminarCarpeta(id: string) {
    setConfirmarElimCarp(id);
  }

  async function ejecutarElimCarpeta(id: string) {
    persistCarpetas(carpetas.filter(c => c.id !== id));
    persistActas(actas.map(a => a.carpetaId === id ? { ...a, carpetaId: undefined } : a));
    if (carpetaActiva === id) setCarpetaActiva("todas");
    setConfirmarElimCarp(null);
    await apiDelete(`/api/db/paginas/${pagina.id}/carpetas/${id}`);
  }

  const actasFiltradas = carpetaActiva === "todas"
    ? actas
    : actas.filter(a => (a.carpetaId ?? "") === carpetaActiva);

  function etiquetaTipo(a: Acta) {
    if (a.tipo === "otro" && a.tipoCustom) return a.tipoCustom;
    return TIPO_ACTA_CFG[a.tipo].texto;
  }

  function etiquetaCliente(a: Acta) {
    if (!a.clienteId) return "Mango (interno)";
    return clientes.find(c => c.id === a.clienteId)?.nombre ?? a.clienteId;
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader pagina={pagina} cta="Nueva acta" onCta={abrirNueva} />

      <div className="flex gap-5">
        {/* Sidebar carpetas */}
        <aside className="w-[200px] shrink-0">
          <div className="overflow-hidden rounded-card border border-line bg-card">
            {/* Todas */}
            <button type="button" onClick={() => setCarpetaActiva("todas")}
              className={["group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-colors",
                carpetaActiva === "todas" ? "bg-lime-soft font-bold text-ink" : "text-ink-2 hover:bg-paper",
              ].join(" ")}>
              <Folder size={13} strokeWidth={2} className="shrink-0 text-ink-3" />
              Todas
              <span className="ml-auto text-[11.5px] tabular-nums text-ink-3">{actas.length}</span>
            </button>

            {/* Carpetas creadas */}
            {carpetas.map(c => {
              const count = actas.filter(a => a.carpetaId === c.id).length;
              const confirmando = confirmarElimCarp === c.id;
              return (
                <div key={c.id} className="border-t border-line-soft">
                  {confirmando ? (
                    /* ── Confirmación inline ─────────────────── */
                    <div className="px-3.5 py-2.5 space-y-2 bg-crit-bg/30">
                      <p className="text-[11.5px] text-crit font-medium leading-snug">
                        ¿Eliminar carpeta <strong>{c.nombre}</strong>?
                        {count > 0 && <span className="block text-ink-3 font-normal">Las {count} actas quedan sin carpeta.</span>}
                      </p>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => setConfirmarElimCarp(null)}
                          className="flex-1 rounded-[7px] border border-line bg-paper py-1 text-[11.5px] text-ink-2 hover:text-ink">
                          Cancelar
                        </button>
                        <button type="button" onClick={() => ejecutarElimCarpeta(c.id)}
                          className="flex-1 rounded-[7px] bg-crit py-1 text-[11.5px] font-bold text-paper hover:opacity-85">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Fila normal ─────────────────────────── */
                    <button type="button" onClick={() => setCarpetaActiva(c.id)}
                      className={["group relative flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-colors",
                        carpetaActiva === c.id ? "bg-lime-soft font-bold text-ink" : "text-ink-2 hover:bg-paper",
                      ].join(" ")}>
                      <Folder size={13} strokeWidth={2} className="shrink-0 text-ink-3" />
                      <span className="flex-1 truncate">{c.nombre}</span>
                      <span className="text-[11.5px] tabular-nums text-ink-3">{count}</span>
                      <span onClick={e => { e.stopPropagation(); confirmarEliminarCarpeta(c.id); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 hidden rounded-[5px] p-0.5 text-ink-3 hover:text-crit group-hover:flex">
                        <X size={11} strokeWidth={2} />
                      </span>
                    </button>
                  )}
                </div>
              );
            })}

            {/* Nueva carpeta */}
            <div className="border-t border-line-soft px-3.5 py-2.5">
              {agregarCarp ? (
                <div className="flex gap-1">
                  <input ref={carpetaInputRef} value={nuevaCarpeta}
                    onChange={e => setNuevaCarpeta(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") crearCarpeta(); if (e.key === "Escape") setAgregarCarp(false); }}
                    placeholder="Nombre..."
                    autoFocus
                    className="flex-1 rounded-[7px] border border-line bg-paper px-2 py-1 text-[12px] outline-none focus:border-ink-3 placeholder:text-ink-3/60" />
                  <button type="button" onClick={crearCarpeta}
                    className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-lime text-ink hover:opacity-80">
                    <Plus size={12} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => { setAgregarCarp(true); setTimeout(() => carpetaInputRef.current?.focus(), 50); }}
                  className="flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink">
                  <FolderPlus size={13} strokeWidth={2} /> Nueva carpeta
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Actas */}
        <div className="flex-1 min-w-0">
          {actasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line py-16">
              <p className="text-[13.5px] text-ink-3">Sin actas {carpetaActiva !== "todas" ? "en esta carpeta" : "— registrá la primera reunión"}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {actasFiltradas.map(acta => {
                const { clase } = TIPO_ACTA_CFG[acta.tipo];
                const abierto = expandidoId === acta.id;
                return (
                  <article key={acta.id} className="overflow-hidden rounded-card border border-line bg-card">
                    {/* Encabezado */}
                    <div className="flex flex-wrap items-center gap-3 border-b border-line-soft bg-paper/60 px-5 py-3.5">
                      <button type="button" onClick={() => setExpandidoId(abierto ? null : acta.id)}
                        className="flex items-center gap-2">
                        <span className="font-display text-[13px]">{fechaLarga(acta.fecha)}</span>
                        <ChevronDown size={14} strokeWidth={2}
                          className={`text-ink-3 transition-transform ${abierto ? "rotate-180" : ""}`} />
                      </button>
                      <span className={`rounded-chip px-2 py-0.5 text-[11.5px] font-bold ${clase}`}>
                        {etiquetaTipo(acta)}
                      </span>
                      <span className="rounded-chip bg-line-soft px-2 py-0.5 text-[11.5px] text-ink-2">
                        {etiquetaCliente(acta)}
                      </span>
                      <div className="flex items-center gap-1">
                        {acta.participantes.map(pid => {
                          const p = persona(pid);
                          return p ? (
                            <span key={pid} title={p.nombre}
                              className="notch-sm flex h-6 w-6 items-center justify-center rounded-[7px] bg-lime-soft text-[9px] font-bold text-ink">
                              {p.inicial}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <div className="ml-auto flex gap-1">
                        <button type="button" onClick={() => abrirEdicion(acta)}
                          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 hover:bg-line-soft hover:text-ink">
                          <Pencil size={13} strokeWidth={2} />
                        </button>
                        <button type="button" onClick={() => eliminarActa(acta.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 hover:bg-crit-bg hover:text-crit">
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    {abierto && (
                      <div className="px-5 py-4 space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <div>
                            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Qué se habló</p>
                            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{acta.puntos || "—"}</p>
                          </div>
                          <div>
                            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Próximos pasos</p>
                            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{acta.pasos || "—"}</p>
                          </div>
                        </div>

                        {/* Adjuntos */}
                        {acta.adjuntos && acta.adjuntos.length > 0 && (
                          <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">
                              Archivos adjuntos ({acta.adjuntos.length})
                            </p>
                            <ul className="flex flex-wrap gap-2">
                              {acta.adjuntos.map(adj => (
                                <li key={adj.id}>
                                  <a href={adj.dataUrl} download={adj.nombre}
                                    className="group flex items-center gap-2 rounded-[9px] border border-line bg-paper px-3 py-2 text-[12.5px] transition-colors hover:border-ink-3/40 hover:bg-card">
                                    <FileText size={13} strokeWidth={2} className="shrink-0 text-ink-3" />
                                    <span className="max-w-[160px] truncate">{adj.nombre}</span>
                                    <span className="text-[11px] text-ink-3">{fmtTamaño(adj.tamaño)}</span>
                                    <Download size={12} strokeWidth={2} className="shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drawer acta */}
      {drawerActa && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]" onClick={() => setDrawerActa(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col bg-paper shadow-2xl">
            <div className="flex shrink-0 items-center border-b border-line px-5 py-4">
              <h2 className="font-display text-[19px] leading-none">{editId ? "Editar acta" : "Nueva acta"}</h2>
              <button type="button" onClick={() => setDrawerActa(false)}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 hover:bg-line-soft hover:text-ink">
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {/* Fecha */}
              <Campo label="Fecha">
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
              </Campo>

              {/* Tipo */}
              <Campo label="Tipo de reunión">
                <div className="flex flex-wrap gap-2">
                  {TIPOS_ACTA.map(t => {
                    const cfg = TIPO_ACTA_CFG[t];
                    return (
                      <button key={t} type="button" onClick={() => setTipo(t)}
                        className={["rounded-[10px] border px-3 py-2 text-[12.5px] font-bold transition-all",
                          tipo === t ? "border-ink bg-ink text-paper" : `border-line bg-card text-ink-2 hover:border-ink-3/50`,
                        ].join(" ")}>
                        {cfg.texto}
                      </button>
                    );
                  })}
                </div>
                {tipo === "otro" && (
                  <input value={tipoCustom} onChange={e => setTipoCustom(e.target.value)}
                    placeholder="¿Qué tipo de reunión fue?"
                    className={`${inputCls} mt-2`} />
                )}
              </Campo>

              {/* De qué cliente */}
              <Campo label="Cliente (o Mango interno)">
                <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputCls}>
                  <option value="">Mango (interno)</option>
                  {clientes.filter(c => !c.interno).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </Campo>

              {/* Participantes */}
              <Campo label="Participantes">
                <div className="flex flex-wrap gap-2">
                  {equipo.map(p => (
                    <ChipPersona key={p.id} persona={p} activo={partics.includes(p.id)} onClick={() => togglePartic(p.id)} />
                  ))}
                </div>
              </Campo>

              {/* Carpeta */}
              {carpetas.length > 0 && (
                <Campo label="Carpeta (opcional)">
                  <select value={carpetaId} onChange={e => setCarpetaId(e.target.value)} className={inputCls}>
                    <option value="">Sin carpeta</option>
                    {carpetas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </Campo>
              )}

              {/* Puntos */}
              <Campo label="Qué se habló">
                <textarea value={puntos} onChange={e => setPuntos(e.target.value)} rows={4} autoFocus
                  placeholder="Temas principales, decisiones tomadas…"
                  className={`${inputCls} resize-none`} />
              </Campo>

              {/* Pasos */}
              <Campo label="Próximos pasos">
                <textarea value={pasos} onChange={e => setPasos(e.target.value)} rows={4}
                  placeholder="¿Qué queda pendiente y de quién?"
                  className={`${inputCls} resize-none`} />
              </Campo>

              {/* Adjuntos */}
              <Campo label="Archivos adjuntos">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFiles} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-[10px] border border-dashed border-line px-3.5 py-2.5 text-[13px] text-ink-3 transition-colors hover:border-ink-3/50 hover:bg-paper hover:text-ink">
                  <Paperclip size={14} strokeWidth={2} />
                  Adjuntar archivos (máx. 8 MB por archivo)
                </button>
                {adjuntosForm.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {adjuntosForm.map(adj => (
                      <li key={adj.id}
                        className="group flex items-center gap-2.5 rounded-[9px] border border-line bg-card px-3 py-2">
                        <FileText size={14} strokeWidth={2} className="shrink-0 text-ink-3" />
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">{adj.nombre}</span>
                        <span className="shrink-0 text-[11px] text-ink-3">{fmtTamaño(adj.tamaño)}</span>
                        <button type="button" onClick={() => quitarAdjunto(adj.id)}
                          className="shrink-0 text-transparent transition-colors group-hover:text-ink-3/50 hover:!text-crit">
                          <X size={13} strokeWidth={2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Campo>
            </div>

            <div className="shrink-0 border-t border-line px-5 py-4">
              <button type="button" onClick={guardarActa} disabled={!puntos.trim()}
                className="flex w-full items-center justify-center rounded-[10px] bg-lime px-4 py-2.5 text-[14px] font-bold text-ink hover:opacity-85 disabled:opacity-40">
                {editId ? "Guardar cambios →" : "Registrar acta →"}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
