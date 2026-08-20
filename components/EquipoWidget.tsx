"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { type Persona } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";
import { usePersonas } from "@/lib/usePersonas";

const EMOJIS = [
  "😄","🙂","😐","😴","🔥","💪","🧠","🎯",
  "⚡","🌱","🤔","😅","🚀","✨","🎉","👀",
];

type EstadoHoy = { enQue: string; emoji: string };
type MapaEstados = Record<string, EstadoHoy>;

function claveHoy(): string {
  return `mango-hoy-v2-${new Date().toISOString().slice(0, 10)}`;
}

function leerEstados(): MapaEstados {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(claveHoy()) ?? "{}"); }
  catch { return {}; }
}

function persistirEstado(id: string, est: EstadoHoy) {
  const prev = leerEstados();
  localStorage.setItem(claveHoy(), JSON.stringify({ ...prev, [id]: est }));
}

// ─────────────────────────────────────────────────────────────────────────────

function Avatar({
  persona,
  foto,
  size = "md",
}: {
  persona: Persona;
  foto?: string | null;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const text = size === "lg" ? "text-[15px]" : "text-[13px]";

  if (foto) {
    return (
      <div className={`${dim} shrink-0 overflow-hidden rounded-[14px]`}>
        <Image src={foto} alt={persona.nombre} width={56} height={56}
          className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <span className={`notch-sm flex ${dim} shrink-0 items-center justify-center rounded-[14px] bg-lime-soft ${text} font-bold text-ink`}>
      {persona.inicial}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EquipoWidget() {
  const usuario = useUsuarioActual();
  const equipo = usePersonas();
  const { data: session } = useSession();
  const fotoActual = session?.user?.image ?? null;

  const [estados, setEstados] = useState<MapaEstados>({});
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoLocal, setTextoLocal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Cargar desde localStorage inmediatamente (optimista)
    const saved = leerEstados();
    setEstados(saved);
    setTextoLocal(saved[usuario.id]?.enQue ?? usuario.enQue);

    // Luego cargar desde Supabase
    let cancelled = false;
    async function cargarDeSupabase() {
      try {
        const res = await fetch("/api/db/equipo/estado-hoy");
        if (!res.ok || cancelled) return;
        const rows = await res.json() as Array<{
          persona_id: string; fecha: string; en_que: string; emoji: string;
        }>;
        const mapaRemoto: MapaEstados = {};
        for (const r of rows) mapaRemoto[r.persona_id] = { enQue: r.en_que, emoji: r.emoji };
        if (cancelled) return;
        // Merge: remote wins, but keep local changes for usuario.id if they differ
        setEstados(prev => {
          const merged = { ...mapaRemoto };
          // Si el usuario tiene cambios locales más recientes que no están en remoto, los conservamos
          if (prev[usuario.id]) merged[usuario.id] = prev[usuario.id];
          return merged;
        });
      } catch {
        // Seguir con localStorage
      }
    }
    cargarDeSupabase();
    return () => { cancelled = true; };
  }, [usuario.id, usuario.enQue]);

  function estadoDe(p: Persona): EstadoHoy {
    return estados[p.id] ?? { enQue: "", emoji: "🙂" };
  }

  function setEmoji(emoji: string) {
    const nuevo = { ...estadoDe(usuario), emoji };
    setEstados(prev => ({ ...prev, [usuario.id]: nuevo }));
    persistirEstado(usuario.id, nuevo);
    setEmojiAbierto(false);
    // Persistir en Supabase (fire & forget)
    fetch("/api/db/equipo/estado-hoy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona_id: usuario.id, en_que: nuevo.enQue, emoji }),
    }).catch(() => {});
  }

  function abrirEdicion() {
    setTextoLocal(estadoDe(usuario).enQue);
    setEditando(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function guardar() {
    const nuevo = { ...estadoDe(usuario), enQue: textoLocal.trim() || estadoDe(usuario).enQue };
    setEstados(prev => ({ ...prev, [usuario.id]: nuevo }));
    persistirEstado(usuario.id, nuevo);
    setEditando(false);
    // Persistir en Supabase (fire & forget)
    fetch("/api/db/equipo/estado-hoy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona_id: usuario.id, en_que: nuevo.enQue, emoji: nuevo.emoji }),
    }).catch(() => {});
  }

  return (
    <div className="rounded-card border border-line bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-[13px] font-bold leading-none">El equipo hoy</span>
        <span className="text-[12px] text-ink-3">{equipo.length} personas</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {equipo.map(p => {
          const est = estadoDe(p);
          const mio = p.id === usuario.id;
          const foto = mio ? fotoActual : (p.foto ?? null);

          return (
            <div key={p.id}
              className={[
                "flex flex-col gap-3 rounded-soft border p-4 transition-colors",
                mio ? "border-lime bg-lime-soft/20" : "border-line-soft hover:border-line hover:bg-paper",
              ].join(" ")}>

              {/* Avatar + emoji */}
              <div className="flex items-start justify-between">
                <Avatar persona={p} foto={foto} size="lg" />

                {mio ? (
                  <div className="relative">
                    <button type="button" onClick={() => setEmojiAbierto(o => !o)}
                      className="text-[22px] leading-none transition-transform hover:scale-110"
                      title="Cambiar emoji">
                      {est.emoji}
                    </button>

                    {emojiAbierto && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setEmojiAbierto(false)} />
                        <div className="absolute right-0 top-9 z-20 grid w-[148px] grid-cols-4 gap-0.5 rounded-[12px] border border-line bg-paper p-1.5 shadow-xl">
                          {EMOJIS.map(e => (
                            <button key={e} type="button" onClick={() => setEmoji(e)}
                              className={[
                                "rounded-[7px] py-1 text-[17px] transition-colors hover:bg-lime-soft",
                                est.emoji === e ? "bg-lime-soft" : "",
                              ].join(" ")}>
                              {e}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-[22px] leading-none">{est.emoji}</span>
                )}
              </div>

              {/* Nombre */}
              <p className="text-[14px] font-bold leading-tight">{p.nombre}</p>

              {/* enQue */}
              {mio && editando ? (
                <input ref={inputRef} value={textoLocal}
                  onChange={e => setTextoLocal(e.target.value)}
                  onBlur={guardar}
                  onKeyDown={e => {
                    if (e.key === "Enter") guardar();
                    if (e.key === "Escape") setEditando(false);
                  }}
                  placeholder="¿En qué estás?"
                  className="w-full rounded-[8px] border border-lime bg-card px-2 py-1.5 text-[12.5px] outline-none" />
              ) : (
                <p onClick={mio ? abrirEdicion : undefined}
                  className={[
                    "text-[12.5px] leading-snug text-ink-2",
                    mio ? "cursor-text -mx-1 rounded-[6px] px-1 py-0.5 transition-colors hover:bg-lime-soft/40" : "",
                  ].join(" ")}>
                  {est.enQue || (
                    mio
                      ? <span className="italic text-ink-3/50">¿En qué estás hoy?</span>
                      : <span className="text-ink-3">—</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
