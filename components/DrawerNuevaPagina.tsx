"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronLeft,
  Lightbulb,
  Target,
  FileText,
  File,
  BarChart2,
  Users,
  Star,
  Zap,
  BookOpen,
  Heart,
  Rocket,
  Hash,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { type PaginaCustom, type TipoPagina, type VisibilidadPagina } from "@/lib/paginas";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

type Template = {
  tipo: TipoPagina;
  titulo: string;
  desc: string;
  Icono: LucideIcon;
  iconoDefecto: string;
};

const TEMPLATES: Template[] = [
  {
    tipo: "banco-ideas",
    titulo: "Banco de ideas",
    desc: "Lista compartida de ideas de contenido y estrategias.",
    Icono: Lightbulb,
    iconoDefecto: "Lightbulb",
  },
  {
    tipo: "objetivos",
    titulo: "Objetivos del mes",
    desc: "Las metas del equipo para el mes, con seguimiento.",
    Icono: Target,
    iconoDefecto: "Target",
  },
  {
    tipo: "actas",
    titulo: "Actas de reuniones",
    desc: "Registro de reuniones: qué se discutió y qué sigue.",
    Icono: FileText,
    iconoDefecto: "FileText",
  },
];

const ICONOS_DISPONIBLES: { nombre: string; Icono: LucideIcon }[] = [
  { nombre: "Lightbulb", Icono: Lightbulb },
  { nombre: "Target",    Icono: Target },
  { nombre: "FileText",  Icono: FileText },
  { nombre: "File",      Icono: File },
  { nombre: "BarChart2", Icono: BarChart2 },
  { nombre: "Users",     Icono: Users },
  { nombre: "Star",      Icono: Star },
  { nombre: "Zap",       Icono: Zap },
  { nombre: "BookOpen",  Icono: BookOpen },
  { nombre: "Heart",     Icono: Heart },
  { nombre: "Rocket",    Icono: Rocket },
  { nombre: "Hash",      Icono: Hash },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────

export default function DrawerNuevaPagina({
  abierto,
  onCerrar,
  onCrear,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCrear: (p: PaginaCustom) => void;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [tipo, setTipo] = useState<TipoPagina | null>(null);
  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("Lightbulb");
  const [visibilidad, setVisibilidad] = useState<VisibilidadPagina>("equipo");

  function handleSelectTipo(t: Template) {
    setTipo(t.tipo);
    setNombre(t.titulo);
    setIcono(t.iconoDefecto);
    setPaso(2);
  }

  async function handleCrear() {
    if (!nombre.trim() || !tipo) return;
    const creadoEn = new Date().toISOString().slice(0, 10);

    // Guardar en Supabase y obtener el ID real
    try {
      const res = await fetch("/api/db/paginas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), tipo, icono, visibilidad }),
      });
      if (res.ok) {
        const data = await res.json() as { id: string };
        onCrear({ id: data.id, nombre: nombre.trim(), tipo, icono, visibilidad, creadoEn });
        reset();
        onCerrar();
        router.push(`/paginas/${data.id}`);
        return;
      }
    } catch { /* fallback a ID local */ }

    // Fallback si Supabase falla: ID local
    const id = `${tipo}-${Date.now()}`;
    onCrear({ id, nombre: nombre.trim(), tipo, icono, visibilidad, creadoEn });
    reset();
    onCerrar();
    router.push(`/paginas/${id}`);
  }

  function reset() {
    setPaso(1);
    setTipo(null);
    setNombre("");
    setIcono("Lightbulb");
    setVisibilidad("equipo");
  }

  function handleCerrar() {
    reset();
    onCerrar();
  }

  if (!abierto) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]"
        onClick={handleCerrar}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col bg-paper shadow-2xl">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          {paso === 2 && (
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
          )}
          <h2 className="font-display text-[19px] leading-none">
            {paso === 1 ? "Nueva página" : "Configurar página"}
          </h2>
          <button
            type="button"
            onClick={handleCerrar}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {/* ── Contenido ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5">
          {paso === 1 ? (
            <>
              <p className="mb-4 text-[13px] text-ink-3">
                Elegí el tipo de página que querés agregar al sidebar.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.tipo}
                    type="button"
                    onClick={() => handleSelectTipo(t)}
                    className="group flex flex-col items-start gap-3 rounded-card border border-line bg-card p-4 text-left transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-lime-soft text-ink transition-colors group-hover:bg-lime">
                      <t.Icono size={18} strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-[13.5px] font-bold leading-snug">
                        {t.titulo}
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-ink-3">
                        {t.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-6">
              {/* ── Nombre ──────────────────────────────────────────── */}
              <div>
                <label className="mb-1.5 block font-display text-[11.5px] uppercase tracking-[0.09em] text-ink-3">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre de la página"
                  autoFocus
                  className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
                />
              </div>

              {/* ── Ícono ───────────────────────────────────────────── */}
              <div>
                <label className="mb-1.5 block font-display text-[11.5px] uppercase tracking-[0.09em] text-ink-3">
                  Ícono
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {ICONOS_DISPONIBLES.map(({ nombre: n, Icono }) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setIcono(n)}
                      className={[
                        "flex h-10 w-full items-center justify-center rounded-[10px] border transition-colors",
                        icono === n
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-card text-ink-2 hover:border-ink-3 hover:text-ink",
                      ].join(" ")}
                    >
                      <Icono size={16} strokeWidth={2} />
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Visibilidad ─────────────────────────────────────── */}
              <div>
                <label className="mb-1.5 block font-display text-[11.5px] uppercase tracking-[0.09em] text-ink-3">
                  Visibilidad
                </label>
                <div className="flex flex-col gap-1.5 overflow-hidden rounded-[10px] border border-line bg-card p-1.5">
                  {(
                    [
                      {
                        val: "equipo" as VisibilidadPagina,
                        label: "Todo el equipo",
                        desc: "Todos en Mango pueden verla",
                      },
                      {
                        val: "solo-yo" as VisibilidadPagina,
                        label: "Solo yo",
                        desc: "Solo vos podés ver esta página",
                      },
                    ]
                  ).map(({ val, label, desc }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setVisibilidad(val)}
                      className={[
                        "flex items-start gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors",
                        visibilidad === val ? "bg-lime-soft" : "hover:bg-line-soft",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          visibilidad === val ? "border-ink" : "border-line-soft",
                        ].join(" ")}
                      >
                        {visibilidad === val && (
                          <span className="h-2 w-2 rounded-full bg-ink" />
                        )}
                      </span>
                      <span>
                        <span className="block text-[13.5px] font-bold">
                          {label}
                        </span>
                        <span className="text-[12px] text-ink-3">{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {paso === 2 && (
          <div className="border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={handleCrear}
              disabled={!nombre.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-lime px-4 py-2.5 text-[14px] font-bold text-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Crear página →
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
