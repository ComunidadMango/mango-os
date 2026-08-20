"use client";

import { useEffect, useState } from "react";
import {
  Pencil,
  X,
  Check,
  Moon,
  Mail,
  Smartphone,
  Bell,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useUsuarioActual } from "@/lib/useUsuarioActual";
import Card from "@/components/Card";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

type Notif = {
  id: string;
  titulo: string;
  detalle: string;
  activa: boolean;
  mail: boolean;
  push: boolean;
};

const NOTIFS_INIT: Notif[] = [
  {
    id: "lead",
    titulo: "Lead nuevo en el Pipeline",
    detalle: "Cada vez que entra un contacto",
    activa: true,
    mail: true,
    push: true,
  },
  {
    id: "asignada",
    titulo: "Tareas que me asignan",
    detalle: "Cuando alguien me asigna algo",
    activa: true,
    mail: true,
    push: false,
  },
  {
    id: "mencion",
    titulo: "Menciones",
    detalle: "Cuando me nombran en una nota o comentario",
    activa: true,
    mail: false,
    push: true,
  },
  {
    id: "meta",
    titulo: "Estado de Meta de los clientes",
    detalle: "Informe de Manguito, lunes · miércoles · viernes",
    activa: false,
    mail: false,
    push: false,
  },
  {
    id: "reporte",
    titulo: "Reportes enviados a clientes",
    detalle: "Cuando sale un reporte mensual",
    activa: true,
    mail: false,
    push: true,
  },
  {
    id: "seguimiento",
    titulo: "Clientes sin contacto",
    detalle: "Si pasan más de 5 días sin hablar con un cliente",
    activa: true,
    mail: true,
    push: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────────────────────

export default function MiPerfil() {
  const { data: session } = useSession();
  const persona = useUsuarioActual();

  // ── Perfil ────────────────────────────────────────────────────────────────
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState<string>(persona.nombre);
  const [rol, setRol] = useState<string>(persona.rol);
  const [draft, setDraft] = useState<{ nombre: string; rol: string }>({
    nombre: persona.nombre,
    rol: persona.rol,
  });

  // ── App settings ──────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>(NOTIFS_INIT);
  const [guardandoNotif, setGuardandoNotif] = useState<string | null>(null);

  useEffect(() => {
    try {
      const perfil = JSON.parse(localStorage.getItem("mango-perfil") ?? "{}");
      if (perfil.nombre) setNombre(perfil.nombre);
      else if (session?.user?.name) setNombre(session.user.name);
      if (perfil.rol) setRol(perfil.rol);

      const dark = localStorage.getItem("mango-dark") === "true";
      setDarkMode(dark);
      document.documentElement.classList.toggle("dark", dark);
    } catch {}

    // Cargar preferencias de notificaciones desde Supabase
    fetch(`/api/notif-prefs?persona_id=${persona.id}`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ tipo: string; mail: boolean; push: boolean; dashboard: boolean }>) => {
        if (!rows.length) return;
        setNotifs(prev => prev.map(n => {
          const row = rows.find(r => r.tipo === n.id);
          return row ? { ...n, mail: row.mail, push: row.push, activa: row.dashboard } : n;
        }));
      })
      .catch(() => {});
  }, [persona.id, session?.user?.name]);

  // ── Handlers perfil ───────────────────────────────────────────────────────
  function iniciarEdicion() {
    setDraft({ nombre, rol });
    setEditando(true);
  }

  function guardar() {
    const n = draft.nombre.trim() || nombre;
    const r = draft.rol.trim() || rol;
    setNombre(n);
    setRol(r);
    localStorage.setItem("mango-perfil", JSON.stringify({ nombre: n, rol: r }));
    setEditando(false);
  }

  function cancelar() {
    setEditando(false);
  }

  // ── Handlers ajustes ──────────────────────────────────────────────────────
  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("mango-dark", String(next));
    document.documentElement.classList.toggle("dark", next);
  }

  async function toggleNotif(id: string, campo: "activa" | "mail" | "push") {
    const updated = notifs.map(n => n.id === id ? { ...n, [campo]: !n[campo] } : n);
    setNotifs(updated);
    const n = updated.find(x => x.id === id)!;
    setGuardandoNotif(id);
    await fetch("/api/notif-prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona_id: persona.id,
        tipo: id,
        mail: n.mail,
        push: n.push,
        dashboard: n.activa,
      }),
    }).catch(() => {});
    setGuardandoNotif(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mb-6 font-display text-[28px] leading-none">Mi perfil</h1>

      {/* ── Perfil ──────────────────────────────────────────────────────── */}
      <section className="mb-5 overflow-hidden rounded-card border border-line bg-card">
        <div className="flex items-start gap-5 p-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt={nombre}
                width={64}
                height={64}
                className="rounded-[18px] object-cover"
              />
            ) : (
              <span className="notch flex h-16 w-16 items-center justify-center rounded-[18px] bg-lime text-[22px] font-bold text-ink">
                {persona.inicial}
              </span>
            )}
          </div>

          {/* Info / formulario */}
          <div className="flex-1">
            {editando ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={draft.nombre}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, nombre: e.target.value }))
                    }
                    autoFocus
                    className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[14px] outline-none transition-colors focus:border-ink-3"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                    Rol
                  </label>
                  <input
                    type="text"
                    value={draft.rol}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, rol: e.target.value }))
                    }
                    className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-[14px] outline-none transition-colors focus:border-ink-3"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={guardar}
                    className="flex items-center gap-1.5 rounded-[9px] bg-lime px-3 py-1.5 text-[13px] font-bold text-ink hover:opacity-85"
                  >
                    <Check size={13} strokeWidth={2.4} />
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={cancelar}
                    className="flex items-center gap-1.5 rounded-[9px] border border-line px-3 py-1.5 text-[13px] text-ink-3 hover:border-ink-3/50 hover:text-ink"
                  >
                    <X size={13} strokeWidth={2} />
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[21px] leading-none">{nombre}</p>
                  <p className="mt-1.5 text-[13.5px] text-ink-2">{rol}</p>
                  <p className="mt-1 text-[12.5px] text-ink-3">
                    {session?.user?.email ?? ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={iniciarEdicion}
                  className="flex shrink-0 items-center gap-1.5 rounded-[9px] border border-line bg-paper px-3 py-1.5 text-[12.5px] text-ink-3 hover:border-ink-3/50 hover:text-ink"
                >
                  <Pencil size={13} strokeWidth={2} />
                  Editar
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Ajustes de la app ────────────────────────────────────────────── */}
      <Card titulo="Ajustes de la app" className="mb-5">
        {/* Dark mode */}
        <div className="mb-4 flex items-center justify-between border-b border-line-soft pb-4">
          <div className="flex items-center gap-3">
            <Moon size={16} strokeWidth={2} className="shrink-0 text-ink-3" />
            <span>
              <span className="block text-[14px] font-bold">Modo oscuro</span>
              <span className="block text-[12.5px] text-ink-3">
                Cambia la apariencia de la app
              </span>
            </span>
          </div>
          <Toggle value={darkMode} onChange={toggleDark} />
        </div>

        {/* Notificaciones */}
        <p className="mb-3 font-display text-[12px] uppercase tracking-[0.09em] text-ink-3">
          Notificaciones
        </p>
        <ul className="flex flex-col">
          {notifs.map((n, i) => (
            <li
              key={n.id}
              className={[
                "flex flex-wrap items-center gap-3 py-3.5",
                i > 0 ? "border-t border-line-soft" : "",
              ].join(" ")}
            >
              <span className="min-w-[190px] flex-1">
                <span className="block text-[14px] font-bold">{n.titulo}</span>
                <span className="block text-[12.5px] text-ink-3">{n.detalle}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Canal
                  activo={n.activa && n.mail}
                  onClick={() => toggleNotif(n.id, "mail")}
                  Icono={Mail}
                  label="Mail"
                />
                <Canal
                  activo={n.activa && n.push}
                  onClick={() => toggleNotif(n.id, "push")}
                  Icono={Smartphone}
                  label="Push"
                />
                <Canal
                  activo={n.activa}
                  onClick={() => toggleNotif(n.id, "activa")}
                  Icono={Bell}
                  label="Dashboard"
                />
                {guardandoNotif === n.id && (
                  <span className="text-[11px] text-ink-3">Guardando…</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={onChange}
      className={[
        "relative h-[22px] w-10 shrink-0 rounded-full transition-colors",
        value ? "bg-lime" : "bg-line-soft",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[3px] h-4 w-4 rounded-full bg-paper shadow-sm transition-transform",
          value ? "translate-x-5" : "translate-x-[3px]",
        ].join(" ")}
      />
    </button>
  );
}

function Canal({
  activo,
  onClick,
  Icono,
  label,
}: {
  activo: boolean;
  onClick: () => void;
  Icono: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={label}
      className={[
        "flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors",
        activo
          ? "border-ink bg-ink text-paper"
          : "border-line bg-card text-ink-3 hover:border-ink-3/50 hover:text-ink",
      ].join(" ")}
    >
      <Icono size={13} strokeWidth={2.2} />
      {label}
    </button>
  );
}
