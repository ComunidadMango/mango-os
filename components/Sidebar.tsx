"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, CheckSquare, Users, Calendar, Folder, Filter, Wallet,
  BookText, Plus, Trash2, LogOut, File, MoreHorizontal, Pencil, NotebookPen,
  ChevronDown, ChevronLeft, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { tareas } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";
import { ICONOS_PAGINA, type PaginaCustom } from "@/lib/paginas";
import ConfirmDialog from "@/components/ConfirmDialog";

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };

function principalesPara(usuarioId: string): Item[] {
  return [
    { href: "/", label: "Inicio", icon: Home },
    {
      href: "/tareas",
      label: "Tareas",
      icon: CheckSquare,
      badge: tareas.filter((t) => t.responsable === usuarioId && t.estado !== "hecha").length,
    },
    { href: "/clientes",   label: "Clientes",   icon: Users,     badge: 9 },
    { href: "/calendario", label: "Calendario", icon: Calendar },
    { href: "/archivos",   label: "Archivos",   icon: Folder },
    { href: "/pipeline",   label: "Pipeline",   icon: Filter,    badge: 2 },
  ];
}

const paginas: Item[] = [
  { href: "/finanzas", label: "Finanzas", icon: Wallet      },
  { href: "/procesos", label: "Procesos", icon: BookText     },
  { href: "/notas",    label: "Notas",    icon: NotebookPen  },
];

export default function Sidebar({
  paginasCustom = [],
  onNuevaPagina,
  onEliminarPagina,
  onRenombrarPagina,
}: {
  paginasCustom?: PaginaCustom[];
  onNuevaPagina?: () => void;
  onEliminarPagina?: (id: string) => void;
  onRenombrarPagina?: (id: string, nuevoNombre: string) => void;
}) {
  const path = usePathname();
  const { data: session } = useSession();
  const usuario = useUsuarioActual();
  const principales = principalesPara(usuario.id);
  const [menuAbierto,      setMenuAbierto]      = useState<string | null>(null);
  const [tareasExpandido,  setTareasExpandido]  = useState(false);
  const [editandoId,       setEditandoId]       = useState<string | null>(null);
  const [nombreEditando,   setNombreEditando]   = useState("");
  const [colapsado,        setColapsado]        = useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  // Leer preferencia guardada
  useEffect(() => {
    setColapsado(localStorage.getItem("mango-sidebar-collapsed") === "1");
  }, []);

  useEffect(() => {
    if (path.startsWith("/tareas")) setTareasExpandido(true);
  }, [path]);

  function toggleColapso() {
    setColapsado((v) => {
      localStorage.setItem("mango-sidebar-collapsed", v ? "0" : "1");
      return !v;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function abrirMenu(id: string)  { setMenuAbierto(id); }

  function iniciarRenombre(p: PaginaCustom) {
    setMenuAbierto(null);
    setEditandoId(p.id);
    setNombreEditando(p.nombre);
  }

  function guardarRenombre(id: string) {
    if (nombreEditando.trim()) onRenombrarPagina?.(id, nombreEditando.trim());
    setEditandoId(null);
    setNombreEditando("");
  }

  function eliminar(id: string) { setMenuAbierto(null); onEliminarPagina?.(id); }

  // ── Render de un link normal ──────────────────────────────────────────────

  function renderLink(item: Item) {
    const activo = item.href === "/" ? path === "/" : path.startsWith(item.href);
    const Icon   = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={colapsado ? item.label : undefined}
        aria-current={activo ? "page" : undefined}
        className={[
          "relative mx-3 flex items-center rounded-[10px] px-3 py-2 text-[13.5px] transition-colors",
          colapsado ? "justify-center" : "gap-2.5",
          activo
            ? "notch bg-lime font-bold text-ink"
            : "text-white/65 hover:bg-white/10 hover:text-white",
        ].join(" ")}
      >
        <Icon size={16} strokeWidth={2} className="shrink-0" />

        {!colapsado && (
          <>
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span className={["ml-auto rounded-full px-1.5 py-px text-[10px] tabular-nums", activo ? "bg-ink/15 text-ink" : "bg-white/15 text-white/80"].join(" ")}>
                {item.badge}
              </span>
            ) : null}
          </>
        )}

        {/* Punto badge cuando colapsado */}
        {colapsado && item.badge ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-lime" />
        ) : null}
      </Link>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {menuAbierto && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuAbierto(null)} />
      )}

      <aside
        className="flex shrink-0 flex-col gap-0.5 bg-ink py-4 transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width: colapsado ? 60 : 212 }}
      >

        {/* ── Logo + toggle ────────────────────────────────────────────── */}
        <div className={["mb-4 flex items-center", colapsado ? "flex-col gap-2 px-2" : "px-6 gap-2.5"].join(" ")}>
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/isotipo-lima.png" alt="Mango" width={26} height={26} className="shrink-0" />
            {!colapsado && (
              <span className="font-display text-[17px] text-paper whitespace-nowrap">Mango OS</span>
            )}
          </Link>

          <button
            type="button"
            onClick={toggleColapso}
            title={colapsado ? "Expandir menú" : "Colapsar menú"}
            className={[
              "flex items-center justify-center rounded-[7px] text-white/35 transition-colors hover:bg-white/10 hover:text-white/70",
              colapsado ? "h-6 w-6" : "ml-auto h-6 w-6 shrink-0",
            ].join(" ")}
          >
            {colapsado
              ? <ChevronRight size={13} strokeWidth={2.5} />
              : <ChevronLeft  size={13} strokeWidth={2.5} />
            }
          </button>
        </div>

        {/* ── Items principales ────────────────────────────────────────── */}
        {principales.map((item) => {
          if (item.href !== "/tareas") return renderLink(item);

          const enSeccion  = path.startsWith("/tareas");
          const todoActivo = path === "/tareas/todo";
          const badgeCount = item.badge ?? 0;

          return (
            <div key="/tareas-group">
              <div className="relative mx-3">
                <Link
                  href="/tareas"
                  title={colapsado ? "Tareas" : undefined}
                  aria-current={enSeccion ? "page" : undefined}
                  className={[
                    "relative flex items-center rounded-[10px] px-3 py-2 text-[13.5px] transition-colors",
                    colapsado ? "justify-center" : "gap-2.5 pr-10",
                    enSeccion
                      ? "notch bg-lime font-bold text-ink"
                      : "text-white/65 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <CheckSquare size={16} strokeWidth={2} className="shrink-0" />
                  {!colapsado && (
                    <>
                      <span className="truncate">Tareas</span>
                      {badgeCount > 0 && (
                        <span className={["ml-auto rounded-full px-1.5 py-px text-[10px] tabular-nums", enSeccion ? "bg-ink/15 text-ink" : "bg-white/15 text-white/80"].join(" ")}>
                          {badgeCount}
                        </span>
                      )}
                    </>
                  )}
                  {colapsado && badgeCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-lime" />
                  )}
                </Link>

                {/* Chevron expandir sub-items (solo visible expandido) */}
                {!colapsado && (
                  <button
                    type="button"
                    onClick={() => setTareasExpandido((v) => !v)}
                    className={["absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-[5px] transition-all hover:bg-black/10", enSeccion ? "text-ink/50 hover:bg-ink/10" : "text-white/40 hover:bg-white/10"].join(" ")}
                  >
                    <ChevronDown size={13} strokeWidth={2.5} className={["transition-transform duration-200", tareasExpandido ? "rotate-0" : "-rotate-90"].join(" ")} />
                  </button>
                )}
              </div>

              {/* Sub-items colapsables (solo cuando sidebar expandido) */}
              {!colapsado && tareasExpandido && (
                <div className="mx-3 mb-0.5 mt-0.5">
                  <div className="ml-[22px] border-l border-white/10 pl-3">
                    <Link
                      href="/tareas/todo"
                      className={["flex items-center rounded-[8px] px-2 py-1.5 text-[12.5px] transition-colors", todoActivo ? "font-medium text-white" : "text-white/40 hover:bg-white/8 hover:text-white/70"].join(" ")}
                    >
                      To do list
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Divisor ─────────────────────────────────────────────────── */}
        <div className="mx-6 my-3 h-px bg-white/12" />

        {/* ── Finanzas y páginas fijas ─────────────────────────────────── */}
        {paginas.map(renderLink)}

        {/* ── Páginas personalizadas ────────────────────────────────────── */}
        {paginasCustom.map((p) => {
          const Icono  = ICONOS_PAGINA[p.icono] ?? File;
          const href   = `/paginas/${p.id}`;
          const activo = path === href;

          if (editandoId === p.id) {
            return (
              <div key={p.id} className="mx-3 flex items-center gap-2.5 rounded-[10px] bg-white/10 px-3 py-2 ring-1 ring-white/25">
                <Icono size={16} strokeWidth={2} className="shrink-0 text-white/70" />
                {!colapsado && (
                  <input
                    type="text"
                    autoFocus
                    value={nombreEditando}
                    onChange={(e) => setNombreEditando(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") guardarRenombre(p.id);
                      if (e.key === "Escape") { setEditandoId(null); setNombreEditando(""); }
                    }}
                    onBlur={() => guardarRenombre(p.id)}
                    className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white/90 outline-none"
                  />
                )}
              </div>
            );
          }

          return (
            <div key={p.id} className="group relative">
              <Link
                href={href}
                title={colapsado ? p.nombre : undefined}
                aria-current={activo ? "page" : undefined}
                className={[
                  "mx-3 flex items-center rounded-[10px] px-3 py-2 text-[13.5px] transition-colors",
                  colapsado ? "justify-center" : "gap-2.5 pr-8",
                  activo ? "notch bg-lime font-bold text-ink" : "text-white/65 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                <Icono size={16} strokeWidth={2} className="shrink-0" />
                {!colapsado && <span className="min-w-0 truncate">{p.nombre}</span>}
              </Link>

              {!colapsado && (
                <button
                  type="button"
                  onClick={() => abrirMenu(p.id)}
                  className={["absolute right-4 top-1/2 z-50 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[5px] opacity-0 transition-all group-hover:opacity-100", activo ? "text-ink/50 hover:bg-ink/10" : "text-white/50 hover:bg-white/15 hover:text-white/80"].join(" ")}
                >
                  <MoreHorizontal size={13} strokeWidth={2} />
                </button>
              )}

              {menuAbierto === p.id && (
                <div className="absolute left-3 top-full z-50 mt-1 w-[152px] overflow-hidden rounded-[10px] border border-white/12 bg-[#141414] py-1 shadow-2xl">
                  <button type="button" onClick={() => iniciarRenombre(p)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-white/75 hover:bg-white/10 hover:text-white">
                    <Pencil size={13} strokeWidth={2} /> Renombrar
                  </button>
                  <button type="button" onClick={() => eliminar(p.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-red-400 hover:bg-white/10 hover:text-red-300">
                    <Trash2 size={13} strokeWidth={2} /> Eliminar página
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Nueva página ─────────────────────────────────────────────── */}
        <button
          type="button"
          title={colapsado ? "Nueva página" : undefined}
          onClick={onNuevaPagina}
          className={["mx-3 flex items-center rounded-[10px] px-3 py-2 text-[13.5px] text-white/45 transition-colors hover:bg-white/10 hover:text-white/80", colapsado ? "justify-center" : "gap-2.5"].join(" ")}
        >
          <Plus size={16} strokeWidth={2} />
          {!colapsado && "Nueva página"}
        </button>

        {/* ── Footer: papelera + perfil ─────────────────────────────────── */}
        <div className="mt-auto flex flex-col gap-0.5 pt-4">
          <div className="mx-6 mb-3 h-px bg-white/12" />
          {renderLink({ href: "/papelera", label: "Papelera", icon: Trash2 })}

          {session?.user ? (
            <Link
              href="/perfil"
              title={colapsado ? (session.user.name ?? "Perfil") : undefined}
              className={["mx-3 mt-1 flex items-center rounded-[10px] px-3 py-2 transition-colors hover:bg-white/10", colapsado ? "justify-center" : "gap-2.5"].join(" ")}
            >
              {session.user.image ? (
                <Image src={session.user.image} alt={session.user.name ?? ""} width={26} height={26} className="shrink-0 rounded-full" />
              ) : (
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-lime text-[11px] font-bold text-ink">
                  {session.user.name?.slice(0, 1)}
                </span>
              )}
              {!colapsado && (
                <>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/65">{session.user.name}</span>
                  <button
                    type="button"
                    title="Cerrar sesión"
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmandoSalida(true);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
                  >
                    <LogOut size={13} strokeWidth={2} />
                  </button>
                </>
              )}
            </Link>
          ) : (
            <div className={["mx-3 mt-1 flex items-center rounded-[10px] px-3 py-2", colapsado ? "justify-center" : "gap-2.5"].join(" ")}>
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-lime text-[11px] font-bold text-ink">
                {usuario.inicial}
              </span>
              {!colapsado && (
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/65">{usuario.nombre}</span>
              )}
            </div>
          )}
        </div>
      </aside>

      {confirmandoSalida && (
        <ConfirmDialog
          titulo="¿Seguro que querés cerrar sesión?"
          labelConfirmar="Cerrar sesión"
          onConfirmar={() => signOut({ callbackUrl: "/login" })}
          onCancelar={() => setConfirmandoSalida(false)}
        />
      )}
    </>
  );
}
