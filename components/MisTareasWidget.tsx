"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { tareas as tareasFallback, persona, cliente, type Tarea } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────

type TodoItem = { id: string; texto: string; hecho: boolean };
type Tab = "personal" | "asignadas";

const ESTADO_CFG: Record<string, { texto: string; cls: string }> = {
  pendiente:   { texto: "Pendiente",   cls: "bg-line-soft text-ink-2" },
  en_curso:    { texto: "En curso",    cls: "bg-warn-bg text-warn"    },
  en_revision: { texto: "En revisión", cls: "bg-lime-soft text-ink"   },
  hecha:       { texto: "Hecha",       cls: "bg-ok-bg text-ok"        },
};

function fmtFecha(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[m - 1]}`;
}

function estaVencida(vence?: string): boolean {
  if (!vence) return false;
  return new Date(vence + "T23:59:59") < new Date();
}

function claveStorage(userId: string) { return `mango-todo-${userId}`; }

// ─────────────────────────────────────────────────────────────────────────────

export default function MisTareasWidget() {
  const usuario = useUsuarioActual();
  const [tab, setTab] = useState<Tab>("personal");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [misTareas, setMisTareas] = useState<Tarea[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar todos personales desde Supabase (fallback a localStorage)
  useEffect(() => {
    let cancelled = false;
    async function cargarTodos() {
      try {
        const res = await fetch(`/api/db/todos?persona_id=${usuario.id}`);
        if (!res.ok) throw new Error("fetch failed");
        const rows = await res.json() as Array<{ id: string; texto: string; hecho: boolean }>;
        if (!cancelled) setTodos(rows.map(r => ({ id: r.id, texto: r.texto, hecho: r.hecho })));
      } catch {
        // Fallback a localStorage
        try {
          const raw = localStorage.getItem(claveStorage(usuario.id));
          if (raw && !cancelled) setTodos(JSON.parse(raw));
        } catch {}
      }
    }
    cargarTodos();
    return () => { cancelled = true; };
  }, [usuario.id]);

  // Cargar tareas asignadas desde Supabase (fallback a mock)
  useEffect(() => {
    let cancelled = false;
    async function cargarTareas() {
      try {
        const res = await fetch(`/api/db/tareas?responsable=${usuario.id}`);
        if (!res.ok) throw new Error("fetch failed");
        const rows = await res.json() as Array<{
          id: string; titulo: string; descripcion: string | null;
          estado: string; responsable: string; responsables: string[] | null;
          completados_por: string[] | null; asignada_por: string | null;
          cliente_id: string | null; vence: string | null; adjuntos: number;
        }>;
        if (!cancelled) {
          setMisTareas(rows
            .filter(r => r.estado !== "hecha")
            .map(r => ({
              id:             r.id,
              titulo:         r.titulo,
              descripcion:    r.descripcion ?? undefined,
              estado:         r.estado as Tarea["estado"],
              responsable:    r.responsable,
              responsables:   r.responsables?.length ? r.responsables : [r.responsable],
              completadosPor: r.completados_por ?? [],
              asignadaPor:    r.asignada_por,
              clienteId:      r.cliente_id ?? undefined,
              vence:          r.vence ?? undefined,
              adjuntos:       r.adjuntos,
            }))
          );
        }
      } catch {
        // Fallback a mock
        if (!cancelled) {
          setMisTareas(tareasFallback.filter(
            t => t.responsable === usuario.id && t.estado !== "hecha"
          ));
        }
      }
    }
    cargarTareas();
    return () => { cancelled = true; };
  }, [usuario.id]);

  async function persistir(next: TodoItem[], accion?: { tipo: "crear" | "toggle" | "eliminar"; item?: TodoItem; id?: string }) {
    setTodos(next);
    // Sincronizar localStorage como caché
    localStorage.setItem(claveStorage(usuario.id), JSON.stringify(next));

    // Sincronizar con Supabase
    try {
      if (accion?.tipo === "crear" && accion.item) {
        const res = await fetch("/api/db/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona_id: usuario.id, texto: accion.item.texto, hecho: false }),
        });
        if (res.ok) {
          const saved = await res.json() as { id: string };
          // Reemplazar id temporal con id real
          setTodos(prev => prev.map(t => t.id === accion.item!.id ? { ...t, id: saved.id } : t));
        }
      } else if (accion?.tipo === "toggle" && accion.id) {
        const item = next.find(t => t.id === accion.id);
        if (item) {
          await fetch(`/api/db/todos/${accion.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hecho: item.hecho }),
          });
        }
      } else if (accion?.tipo === "eliminar" && accion.id) {
        await fetch(`/api/db/todos/${accion.id}`, { method: "DELETE" });
      }
    } catch {
      // Se queda en localStorage
    }
  }

  function agregar() {
    const texto = input.trim();
    if (!texto) return;
    const item: TodoItem = { id: `todo-${Date.now()}`, texto, hecho: false };
    const next = [item, ...todos];
    persistir(next, { tipo: "crear", item });
    setInput("");
    inputRef.current?.focus();
  }

  function toggle(id: string) {
    const next = todos.map(t => t.id === id ? { ...t, hecho: !t.hecho } : t);
    persistir(next, { tipo: "toggle", id });
  }

  function eliminar(id: string) {
    const next = todos.filter(t => t.id !== id);
    persistir(next, { tipo: "eliminar", id });
  }

  const pendientesPersonales = todos.filter(t => !t.hecho).length;
  const totalPendientes = misTareas.length + pendientesPersonales;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "personal",  label: "Personal",  count: pendientesPersonales },
    { id: "asignadas", label: "Asignadas", count: misTareas.length     },
  ];

  function ciclicNext() {
    setTab(t => t === "personal" ? "asignadas" : "personal");
  }
  function ciclicPrev() {
    setTab(t => t === "personal" ? "asignadas" : "personal");
  }

  return (
    <div className="flex flex-col rounded-card border border-line bg-card p-4">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[13px] font-bold leading-none">Mis tareas</span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-3">{totalPendientes} pendientes</span>
          <Link href="/tareas"
            className="flex items-center gap-1 text-[12px] text-ink-3 transition-colors hover:text-ink">
            Ver todas <ArrowRight size={11} strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* ── Tab selector con flechas ────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-1">
        <button type="button" onClick={ciclicPrev}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
          <ChevronLeft size={15} strokeWidth={2.5} />
        </button>
        <div className="flex flex-1 gap-1 overflow-hidden rounded-[10px] border border-line bg-paper p-0.5">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-[12.5px] font-medium transition-all",
                tab === t.id ? "bg-lime shadow-sm font-bold text-ink" : "text-ink-3 hover:text-ink",
              ].join(" ")}>
              {t.label}
              <span className={[
                "rounded-full px-1.5 py-px text-[10px] font-bold leading-none",
                tab === t.id ? "bg-ink/10" : "bg-line text-ink-3",
              ].join(" ")}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={ciclicNext}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
          <ChevronRight size={15} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Contenido — altura fija, scroll interno ─────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

        {/* ── Tab Personal ────────────────────────────────────────── */}
        {tab === "personal" && (
          <div className="flex flex-col gap-2">
            {/* Input */}
            <div className="flex gap-2">
              <input ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") agregar(); }}
                placeholder="Agregar a mi lista…"
                className="flex-1 rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px] outline-none transition-colors focus:border-ink-3/50 placeholder:text-ink-3/50" />
              <button type="button" onClick={agregar}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-lime text-ink transition-opacity hover:opacity-80">
                <Plus size={15} strokeWidth={2.5} />
              </button>
            </div>

            {/* Lista scroll */}
            <div className="max-h-[260px] overflow-y-auto">
              {todos.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ink-3">
                  Lista vacía — usá el campo para agregar algo
                </p>
              ) : (
                <ul className="flex flex-col">
                  {todos.map((t, i) => (
                    <li key={t.id}
                      className={`group flex items-center gap-2.5 py-2 ${i > 0 ? "border-t border-line-soft" : ""}`}>
                      <button type="button" onClick={() => toggle(t.id)}
                        className={[
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all",
                          t.hecho ? "border-ok bg-ok" : "border-line bg-transparent hover:border-ok/60",
                        ].join(" ")}>
                        {t.hecho && (
                          <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                            <path d="M1 3.5L3 5.5L7 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-[13px] leading-snug ${t.hecho ? "text-ink-3 line-through" : ""}`}>
                        {t.texto}
                      </span>
                      <button type="button" onClick={() => eliminar(t.id)}
                        className="shrink-0 text-transparent transition-colors group-hover:text-ink-3/40 hover:!text-crit">
                        <Trash2 size={12} strokeWidth={2} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Asignadas ───────────────────────────────────────── */}
        {tab === "asignadas" && (
          <div className="max-h-[300px] overflow-y-auto">
            {misTareas.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-3">
                Sin tareas asignadas — todo despejado
              </p>
            ) : (
              <ul className="flex flex-col">
                {misTareas.map((t, i) => {
                  const cfg = ESTADO_CFG[t.estado] ?? ESTADO_CFG.pendiente;
                  const asignador = t.asignadaPor ? persona(t.asignadaPor) : null;
                  const cl = t.clienteId ? cliente(t.clienteId) : null;
                  const vencida = estaVencida(t.vence);
                  return (
                    <li key={t.id}
                      className={`flex items-start gap-3 py-2.5 ${i > 0 ? "border-t border-line-soft" : ""}`}>
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border-[1.5px] border-line" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-snug">{t.titulo}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11.5px] text-ink-3">
                          {cl && <span>{cl.nombre}</span>}
                          {cl && (asignador || t.vence) && <span>·</span>}
                          {asignador && <span>de {asignador.nombre}</span>}
                          {asignador && t.vence && <span>·</span>}
                          {t.vence && (
                            <span className={vencida ? "font-bold text-crit" : ""}>
                              {vencida ? `venció ${fmtFecha(t.vence)}` : `vence ${fmtFecha(t.vence)}`}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-chip px-2 py-0.5 text-[10.5px] font-bold ${cfg.cls}`}>
                        {cfg.texto}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
