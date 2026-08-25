"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import { Plus, Trash2, Search, X, Lock, Users, FolderOpen, Loader2, Check, Share2 } from "lucide-react";
import { equipo } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";
import ConfirmDialog from "@/components/ConfirmDialog";
import { enviarAPapelera } from "@/lib/papelera";
import { createBrowserClient } from "@/lib/supabase";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type Nota = {
  id: string;
  titulo: string;
  contenido: string;
  color: string | null;
  visibilidad: "personal" | "equipo";
  autorId: string;
  creadaEn: string;
  editadaEn: string;
  compartidoCon: string[];
};

// ─── CONFIG ───────────────────────────────────────────────────────────────────

export const KEY_NOTAS_PAGE = "mango-notas-v1";

const PALETA = [
  { id: "lima",    hex: "#daff59", nombre: "Lima"     },
  { id: "verde",   hex: "#33B679", nombre: "Verde"    },
  { id: "celeste", hex: "#039BE5", nombre: "Celeste"  },
  { id: "violeta", hex: "#8E24AA", nombre: "Violeta"  },
  { id: "salmon",  hex: "#E67C73", nombre: "Salmón"   },
  { id: "naranja", hex: "#F4511E", nombre: "Naranja"  },
  { id: "arena",   hex: "#F6BF26", nombre: "Amarillo" },
  { id: "gris",    hex: "#9E9E9E", nombre: "Gris"     },
];

export function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "ahora";
  if (mins < 60)  return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `hace ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  if (dias === 1) return "ayer";
  if (dias < 7)   return `hace ${dias} días`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function isoNow() { return new Date().toISOString(); }

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

type Filtro = "todas" | "personal" | "equipo";

export default function Notas() {
  const usuario = useUsuarioActual();

  const [notas,          setNotas]          = useState<Nota[]>([]);
  const [seleccionada,   setSeleccionada]   = useState<string | null>(null);
  const [busqueda,       setBusqueda]       = useState("");
  const [filtro,         setFiltro]         = useState<Filtro>("todas");
  const [confirmElim,    setConfirmElim]    = useState<string | null>(null);
  const [shareAbierto,   setShareAbierto]   = useState(false);

  // Guardar en cliente
  const [pickerAbierto,    setPickerAbierto]    = useState(false);
  const [clientesBusqueda, setClientesBusqueda] = useState("");
  const [clientesLista,    setClientesLista]    = useState<{ id: string; nombre: string }[]>([]);
  const [guardandoDrive,   setGuardandoDrive]   = useState(false);
  const [driveOk,          setDriveOk]          = useState(false);

  const tituloRef    = useRef<HTMLInputElement>(null);
  const contenidoRef = useRef<HTMLTextAreaElement>(null);
  const syncTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mentionQuery,       setMentionQuery]       = useState<string | null>(null);
  const [mentionSugerencias, setMentionSugerencias] = useState<typeof equipo>([]);

  function detectMention(val: string, cursor: number) {
    const before = val.slice(0, cursor);
    const match  = before.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMentionQuery(q);
      setMentionSugerencias(equipo.filter(p => p.nombre.toLowerCase().startsWith(q)));
    } else {
      setMentionQuery(null);
      setMentionSugerencias([]);
    }
  }

  function insertarMencionContenido(nombre: string) {
    const textarea = contenidoRef.current;
    if (!textarea) return;
    const cursor  = textarea.selectionStart ?? 0;
    const val     = notaActiva?.contenido ?? "";
    const before  = val.slice(0, cursor).replace(/@(\w*)$/, `@${nombre} `);
    const after   = val.slice(cursor);
    const newVal  = before + after;
    actualizarContenido(newVal);
    setMentionQuery(null);
    setMentionSugerencias([]);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(before.length, before.length);
    }, 0);
  }

  // Cargar lista de clientes cuando se abre el picker
  useEffect(() => {
    if (!pickerAbierto || clientesLista.length > 0) return;
    fetch("/api/db/clientes")
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ id: string; nombre: string }>) => setClientesLista(rows.map(r => ({ id: r.id, nombre: r.nombre }))))
      .catch(() => {});
  }, [pickerAbierto, clientesLista.length]);

  async function guardarEnCliente(clienteNombre: string) {
    const nota = notas.find(n => n.id === seleccionada);
    if (!nota) return;
    setGuardandoDrive(true);
    setPickerAbierto(false);
    try {
      // 1. Raíz de Drive
      const rootRes = await fetch("/api/drive/root");
      if (!rootRes.ok) throw new Error("Sin Drive");
      const { clientesFolderId } = await rootRes.json() as { clientesFolderId: string };

      // 2. Carpeta del cliente
      const cRes = await fetch("/api/drive/mkdir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clienteNombre, parentId: clientesFolderId }) });
      const { folderId: cFolderId } = await cRes.json() as { folderId: string };

      // 3. Carpeta NOTAS dentro del cliente
      const nRes = await fetch("/api/drive/mkdir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "NOTAS", parentId: cFolderId }) });
      const { folderId: notasFolderId } = await nRes.json() as { folderId: string };

      // 4. Subir como .txt
      const contenido = `${nota.titulo}\n${"─".repeat(40)}\n\n${nota.contenido}`;
      const blob = new Blob([contenido], { type: "text/plain" });
      const slugTitulo = (nota.titulo || "sin-titulo").slice(0, 40).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-áéíóúñÁÉÍÓÚÑ]/g, "");
      const fecha = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `${fecha}-${slugTitulo}.txt`, { type: "text/plain" });
      const fd = new FormData(); fd.append("file", file); fd.append("parentId", notasFolderId);
      await fetch("/api/drive/upload", { method: "POST", body: fd });

      setDriveOk(true);
      setTimeout(() => setDriveOk(false), 2500);
    } catch { /* silencioso */ }
    finally { setGuardandoDrive(false); setClientesBusqueda(""); }
  }

  // Realtime: cuando alguien del equipo crea/edita/elimina una nota compartida
  useEffect(() => {
    const supabase = createBrowserClient();
    const canal = supabase.channel("notas-equipo-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "notas_equipo" },
        () => {
          // Re-fetch completo para mergear correctamente con las notas locales
          const local = localStorage.getItem(KEY_NOTAS_PAGE);
          const parsed: Nota[] = local ? (JSON.parse(local) as Nota[]) : [];
          fetch("/api/notas-equipo?yo=" + usuario.id)
            .then(r => r.json())
            .then((rows: Array<{ id: string; titulo: string; contenido: string; color: string | null; autor_id: string; creada_en: string; editada_en: string; compartido_con: string[] }>) => {
              const supabaseNotes: Nota[] = rows.map((r) => {
                const cc = r.compartido_con ?? [];
                return {
                  id: r.id, titulo: r.titulo, contenido: r.contenido, color: r.color,
                  visibilidad: cc.length === 0 ? "equipo" as const : "personal" as const,
                  autorId: r.autor_id, creadaEn: r.creada_en ?? r.editada_en,
                  editadaEn: r.editada_en, compartidoCon: cc,
                };
              });
              const supabaseIds = new Set(supabaseNotes.map(n => n.id));
              const soloLocales = parsed.filter(n => !supabaseIds.has(n.id));
              const merged = [...supabaseNotes, ...soloLocales].sort((a, b) => b.editadaEn.localeCompare(a.editadaEn));
              startTransition(() => setNotas(merged));
              try { localStorage.setItem(KEY_NOTAS_PAGE, JSON.stringify(merged)); } catch {}
            })
            .catch(() => {});
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [usuario.id]);

  // Cargar localStorage y luego mergear con notas del equipo desde Supabase
  useEffect(() => {
    const local = localStorage.getItem(KEY_NOTAS_PAGE);
    const parsed: Nota[] = local ? (JSON.parse(local) as Nota[]) : [];

    fetch("/api/notas-equipo?yo=" + usuario.id)
      .then((r) => r.json())
      .then((rows: Array<{ id: string; titulo: string; contenido: string; color: string | null; autor_id: string; creada_en: string; editada_en: string; compartido_con: string[] }>) => {
        const supabaseNotes: Nota[] = rows.map((r) => {
          const cc = r.compartido_con ?? [];
          return {
            id:            r.id,
            titulo:        r.titulo,
            contenido:     r.contenido,
            color:         r.color,
            visibilidad:   cc.length === 0 ? "equipo" as const : "personal" as const,
            autorId:       r.autor_id,
            creadaEn:      r.creada_en ?? r.editada_en,
            editadaEn:     r.editada_en,
            compartidoCon: cc,
          };
        });
        // Merge: notas de Supabase + mis personales que no están en Supabase
        const supabaseIds = new Set(supabaseNotes.map((n) => n.id));
        const soloLocales = parsed.filter((n) => !supabaseIds.has(n.id));
        const merged = [...supabaseNotes, ...soloLocales]
          .sort((a, b) => b.editadaEn.localeCompare(a.editadaEn));
        startTransition(() => {
          setNotas(merged);
          if (merged.length > 0) setSeleccionada(merged[0].id);
        });
        try { localStorage.setItem(KEY_NOTAS_PAGE, JSON.stringify(merged)); } catch {}
      })
      .catch(() => {
        startTransition(() => {
          setNotas(parsed);
          if (parsed.length > 0) setSeleccionada(parsed[0].id);
        });
      });
  }, []);

  function persistir(next: Nota[], notaModificada?: Nota) {
    setNotas(next);
    try { localStorage.setItem(KEY_NOTAS_PAGE, JSON.stringify(next)); } catch {}

    // Sync a Supabase: notas de equipo O personales compartidas con alguien
    const debeSync = notaModificada?.visibilidad === "equipo" || (notaModificada?.compartidoCon ?? []).length > 0;
    if (debeSync && notaModificada) {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        fetch("/api/notas-equipo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id:             notaModificada.id,
            titulo:         notaModificada.titulo,
            contenido:      notaModificada.contenido,
            color:          notaModificada.color,
            autor_id:       notaModificada.autorId,
            editada_en:     notaModificada.editadaEn,
            compartido_con: notaModificada.compartidoCon,
          }),
        }).catch(() => {});
      }, 1500);
    }
  }

  const notaActiva = notas.find(n => n.id === seleccionada) ?? null;

  // Filtros
  const notasFiltradas = notas
    .filter(n => filtro === "todas" || n.visibilidad === filtro)
    .filter(n =>
      !busqueda.trim() ||
      n.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      n.contenido.toLowerCase().includes(busqueda.toLowerCase())
    );

  // ── CRUD ──────────────────────────────────────────────────────────────────

  function nuevaNota(visibilidad: "personal" | "equipo" = "personal") {
    const n: Nota = {
      id: uid(), titulo: "", contenido: "",
      color: null, visibilidad,
      autorId: usuario.id,
      creadaEn: isoNow(), editadaEn: isoNow(),
      compartidoCon: [],
    };
    const next = [n, ...notas];
    persistir(next, visibilidad === "equipo" ? n : undefined);
    setSeleccionada(n.id);
    setFiltro("todas");
    setTimeout(() => tituloRef.current?.focus(), 50);
  }

  function actualizarTitulo(valor: string) {
    if (!seleccionada) return;
    let modificada: Nota | undefined;
    const next = notas.map(n => {
      if (n.id !== seleccionada) return n;
      modificada = { ...n, titulo: valor, editadaEn: isoNow() };
      return modificada;
    });
    persistir(next, modificada);
  }

  function actualizarContenido(valor: string) {
    if (!seleccionada) return;
    let modificada: Nota | undefined;
    const next = notas.map(n => {
      if (n.id !== seleccionada) return n;
      modificada = { ...n, contenido: valor, editadaEn: isoNow() };
      return modificada;
    });
    persistir(next, modificada);
  }

  function cambiarColor(color: string | null) {
    if (!seleccionada) return;
    let modificada: Nota | undefined;
    const next = notas.map(n => {
      if (n.id !== seleccionada) return n;
      modificada = { ...n, color, editadaEn: isoNow() };
      return modificada;
    });
    persistir(next, modificada);
  }

  function cambiarVisibilidad(v: "personal" | "equipo") {
    if (!seleccionada) return;
    const previa = notas.find(n => n.id === seleccionada);
    let modificada: Nota | undefined;
    const next = notas.map(n => {
      if (n.id !== seleccionada) return n;
      modificada = { ...n, visibilidad: v, compartidoCon: [], editadaEn: isoNow() };
      return modificada;
    });
    persistir(next, modificada);
    // Si pasó de equipo/compartida → personal privada, borrar de Supabase
    if ((previa?.visibilidad === "equipo" || (previa?.compartidoCon ?? []).length > 0) && v === "personal") {
      fetch("/api/notas-equipo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seleccionada }),
      }).catch(() => {});
    }
  }

  function compartirCon(personaIds: string[]) {
    if (!seleccionada) return;
    let modificada: Nota | undefined;
    const next = notas.map(n => {
      if (n.id !== seleccionada) return n;
      modificada = { ...n, compartidoCon: personaIds, editadaEn: isoNow() };
      return modificada;
    });
    persistir(next, modificada);
    // Si quedó sin compartir, sacar de Supabase
    if (personaIds.length === 0) {
      fetch("/api/notas-equipo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seleccionada }),
      }).catch(() => {});
    }
    setShareAbierto(false);
  }

  function eliminarNota(id: string) {
    const nota = notas.find(n => n.id === id);
    if (nota) {
      enviarAPapelera({ id: nota.id, tipo: "nota", titulo: nota.titulo || "Sin título", datos: nota });
      // Si era de equipo, borrar de Supabase
      if (nota.visibilidad === "equipo") {
        fetch("/api/notas-equipo", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }).catch(() => {});
      }
    }
    const next = notas.filter(n => n.id !== id);
    persistir(next);
    if (seleccionada === id) setSeleccionada(next.length > 0 ? next[0].id : null);
  }

  function pedirConfirmElim(id: string) {
    setConfirmElim(id);
  }

  const editorBg = notaActiva?.color
    ? PALETA.find(p => p.id === notaActiva.color)?.hex ?? null
    : null;

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex -mx-7 -mt-6 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── Panel izquierdo ─────────────────────────────────────────────── */}
      <div className="flex w-[260px] shrink-0 flex-col border-r border-line bg-card">

        {/* Header */}
        <div className="border-b border-line px-4 py-3.5">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-[17px]">Notas</h1>
            {/* Menú nueva nota */}
            <div className="relative group/new">
              <button type="button"
                className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-lime text-ink transition-opacity hover:opacity-80">
                <Plus size={14} strokeWidth={2.5} />
              </button>
              {/* Dropdown */}
              <div className="absolute right-0 top-full z-20 mt-1 hidden w-[160px] overflow-hidden rounded-[10px] border border-line bg-paper shadow-lg group-focus-within/new:block group-hover/new:block">
                <button type="button" onClick={() => nuevaNota("personal")}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-line-soft">
                  <Lock size={12} strokeWidth={2} className="text-ink-3" /> Personal
                </button>
                <button type="button" onClick={() => nuevaNota("equipo")}
                  className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-[13px] hover:bg-line-soft">
                  <Users size={12} strokeWidth={2} className="text-ink-3" /> Del equipo
                </button>
              </div>
            </div>
          </div>

          {/* Tabs filtro */}
          <div className="mt-2.5 flex gap-1">
            {([["todas", "Todas"], ["personal", "Personal"], ["equipo", "Equipo"]] as [Filtro, string][]).map(([f, label]) => (
              <button key={f} type="button" onClick={() => setFiltro(f)}
                className={[
                  "flex-1 rounded-[7px] py-1 text-[11.5px] font-bold transition-colors",
                  filtro === f ? "bg-lime text-ink" : "text-ink-3 hover:bg-line-soft hover:text-ink",
                ].join(" ")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Búsqueda */}
        <div className="border-b border-line px-3 py-2">
          <div className="flex items-center gap-2 rounded-[8px] bg-line-soft px-2.5 py-1.5">
            <Search size={12} strokeWidth={2} className="shrink-0 text-ink-3" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3" />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")}>
                <X size={11} strokeWidth={2} className="text-ink-3 hover:text-ink" />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {notasFiltradas.length === 0 && (
            <p className="px-4 py-6 text-center text-[12.5px] text-ink-3">
              {busqueda ? "Sin resultados" : "Sin notas todavía"}
            </p>
          )}
          {notasFiltradas.map(n => {
            const colorHex = n.color ? PALETA.find(p => p.id === n.color)?.hex : null;
            const activa   = n.id === seleccionada;
            return (
              <div key={n.id}
                role="button" tabIndex={0}
                onClick={() => setSeleccionada(n.id)}
                onKeyDown={e => e.key === "Enter" && setSeleccionada(n.id)}
                className={[
                  "group relative flex w-full cursor-pointer flex-col items-start border-b border-line-soft px-4 py-3 text-left transition-colors",
                  activa ? "bg-lime-soft/70" : "hover:bg-line-soft/50",
                ].join(" ")}>
                {/* Barra de color */}
                {colorHex && (
                  <span className="absolute left-0 top-0 h-full w-1 rounded-r"
                    style={{ backgroundColor: colorHex }} />
                )}
                <span className="flex w-full items-center gap-1.5 pl-1">
                  {n.visibilidad === "equipo"
                    ? <Users size={10} strokeWidth={2} className="shrink-0 text-ok" />
                    : n.compartidoCon.length > 0
                      ? <Share2 size={10} strokeWidth={2} className={`shrink-0 ${n.autorId === usuario.id ? "text-ink-3" : "text-ok"}`} />
                      : <Lock size={10} strokeWidth={2} className="shrink-0 text-ink-3/50" />
                  }
                  <span className="truncate text-[13px] font-bold text-ink">
                    {n.titulo || <span className="italic font-normal text-ink-3">Sin título</span>}
                  </span>
                </span>
                <span className="mt-0.5 truncate pl-1 text-[11.5px] text-ink-3">
                  {n.contenido.slice(0, 55) || <span className="italic">Nota vacía</span>}
                </span>
                <span className="mt-0.5 pl-1 text-[10.5px] text-ink-3/60">{tiempoRelativo(n.editadaEn)}</span>
                <button type="button"
                  onClick={e => { e.stopPropagation(); pedirConfirmElim(n.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-[6px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-crit-bg hover:text-crit">
                  <Trash2 size={11} strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Editor ──────────────────────────────────────────────────────── */}
      {notaActiva ? (
        <div className="flex min-w-0 flex-1 flex-col transition-colors"
          style={editorBg ? { backgroundColor: editorBg + "18" } : undefined}>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-2.5">

            {/* Toggle personal / equipo */}
            <div className="flex rounded-[8px] border border-line bg-card p-0.5">
              <button type="button" onClick={() => cambiarVisibilidad("personal")}
                className={["flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[12px] font-bold transition-colors",
                  notaActiva.visibilidad === "personal" ? "bg-ink text-paper" : "text-ink-3 hover:text-ink",
                ].join(" ")}>
                <Lock size={11} strokeWidth={2} /> Personal
              </button>
              <button type="button" onClick={() => cambiarVisibilidad("equipo")}
                className={["flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[12px] font-bold transition-colors",
                  notaActiva.visibilidad === "equipo" ? "bg-ok text-white" : "text-ink-3 hover:text-ink",
                ].join(" ")}>
                <Users size={11} strokeWidth={2} /> Equipo
              </button>
            </div>

            {/* Picker de color */}
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => cambiarColor(null)} title="Sin color"
                className={`h-5 w-5 rounded-full border-2 transition-all ${!notaActiva.color ? "border-ink scale-110" : "border-line hover:border-ink-3"}`}
                style={{ backgroundColor: "#dde4de" }} />
              {PALETA.map(c => (
                <button key={c.id} type="button" onClick={() => cambiarColor(c.id)} title={c.nombre}
                  className={`h-5 w-5 rounded-full border-2 transition-all ${notaActiva.color === c.id ? "border-ink scale-110" : "border-transparent hover:scale-105"}`}
                  style={{ backgroundColor: c.hex }} />
              ))}
            </div>

            {/* Compartir nota personal */}
            {notaActiva.visibilidad === "personal" && notaActiva.autorId === usuario.id && (
              <div className="relative">
                <button type="button" onClick={() => setShareAbierto(v => !v)}
                  className={[
                    "flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors",
                    notaActiva.compartidoCon.length > 0
                      ? "border-ink/30 bg-ink/5 text-ink"
                      : "border-line hover:border-ink-3/60 hover:bg-paper",
                  ].join(" ")}>
                  <Share2 size={13} strokeWidth={1.8} />
                  {notaActiva.compartidoCon.length > 0
                    ? `Compartida (${notaActiva.compartidoCon.length})`
                    : "Compartir"}
                </button>

                {shareAbierto && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShareAbierto(false)} />
                    <div className="absolute left-0 top-full z-50 mt-1 w-[200px] overflow-hidden rounded-[12px] border border-line bg-paper shadow-xl">
                      <div className="border-b border-line px-3 py-2">
                        <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-3">Compartir con</p>
                      </div>
                      <div className="flex flex-col p-1.5 gap-0.5">
                        {equipo.filter(p => p.id !== usuario.id).map(p => {
                          const sel = notaActiva.compartidoCon.includes(p.id);
                          return (
                            <button key={p.id} type="button"
                              onClick={() => {
                                const next = sel
                                  ? notaActiva.compartidoCon.filter(id => id !== p.id)
                                  : [...notaActiva.compartidoCon, p.id];
                                compartirCon(next);
                              }}
                              className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] transition-colors hover:bg-line-soft">
                              <span className={[
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                                sel ? "bg-ink text-paper" : "bg-line-soft text-ink-2",
                              ].join(" ")}>{p.inicial}</span>
                              <span className="flex-1 text-left">{p.nombre}</span>
                              {sel && <Check size={12} strokeWidth={2.5} className="text-ink" />}
                            </button>
                          );
                        })}
                      </div>
                      {notaActiva.compartidoCon.length > 0 && (
                        <div className="border-t border-line p-1.5">
                          <button type="button" onClick={() => compartirCon([])}
                            className="w-full rounded-[8px] px-2.5 py-1.5 text-center text-[12px] text-crit transition-colors hover:bg-crit-bg">
                            Dejar de compartir
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Nota compartida conmigo — solo lectura */}
            {notaActiva.visibilidad === "personal" && notaActiva.autorId !== usuario.id && (
              <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <Share2 size={12} strokeWidth={2} />
                Compartida por {equipo.find(p => p.id === notaActiva.autorId)?.nombre ?? notaActiva.autorId}
              </span>
            )}

            {/* Guardar en cliente */}
            <div className="relative ml-auto">
              {driveOk ? (
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-ok">
                  <Check size={13} strokeWidth={2.5} /> Guardado en Drive
                </span>
              ) : guardandoDrive ? (
                <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                  <Loader2 size={13} strokeWidth={2} className="animate-spin" /> Guardando…
                </span>
              ) : (
                <button type="button" onClick={() => setPickerAbierto(v => !v)}
                  className="flex items-center gap-1.5 rounded-[8px] border border-line px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:border-ink-3/60 hover:bg-paper">
                  <FolderOpen size={13} strokeWidth={1.8} /> Guardar en cliente
                </button>
              )}

              {/* Picker de clientes */}
              {pickerAbierto && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setPickerAbierto(false); setClientesBusqueda(""); }} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-[220px] overflow-hidden rounded-[12px] border border-line bg-paper shadow-xl">
                    <div className="border-b border-line px-3 py-2">
                      <input autoFocus value={clientesBusqueda} onChange={e => setClientesBusqueda(e.target.value)}
                        placeholder="Buscar cliente…"
                        className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3" />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {clientesLista
                        .filter(c => c.nombre.toLowerCase().includes(clientesBusqueda.toLowerCase()))
                        .map(c => (
                          <button key={c.id} type="button"
                            onClick={() => guardarEnCliente(c.nombre)}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] text-ink-2 transition-colors hover:bg-line-soft hover:text-ink">
                            <FolderOpen size={13} strokeWidth={1.8} className="shrink-0 text-ink-3" />
                            {c.nombre}
                          </button>
                        ))}
                      {clientesLista.length === 0 && (
                        <p className="px-3 py-3 text-[12.5px] text-ink-3">Cargando…</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <span className="text-[11.5px] text-ink-3">
              Editado {tiempoRelativo(notaActiva.editadaEn)}
            </span>
          </div>

          {/* Bandita equipo */}
          {notaActiva.visibilidad === "equipo" && (
            <div className="flex items-center gap-2 border-b border-ok/20 bg-ok-bg/40 px-6 py-2">
              <Users size={13} strokeWidth={2} className="text-ok" />
              <p className="text-[12.5px] text-ok">
                Visible para todo el equipo · la sincronización entre dispositivos requiere Supabase
              </p>
            </div>
          )}

          {/* Título */}
          <div className="px-8 pt-7">
            <input
              ref={tituloRef}
              value={notaActiva.titulo}
              onChange={e => actualizarTitulo(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); contenidoRef.current?.focus(); } }}
              placeholder="Título…"
              readOnly={notaActiva.visibilidad === "personal" && notaActiva.autorId !== usuario.id}
              className="w-full bg-transparent font-display text-[28px] leading-tight text-ink outline-none placeholder:text-ink-3/40 read-only:cursor-default"
            />
          </div>

          {/* Contenido */}
          <div className="relative flex-1 overflow-y-auto px-8 pb-12 pt-4">
            <textarea
              ref={contenidoRef}
              value={notaActiva.contenido}
              readOnly={notaActiva.visibilidad === "personal" && notaActiva.autorId !== usuario.id}
              onChange={e => {
                actualizarContenido(e.target.value);
                detectMention(e.target.value, e.target.selectionStart ?? 0);
              }}
              onKeyDown={e => {
                if (mentionSugerencias.length > 0) {
                  if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); setMentionSugerencias([]); return; }
                  if (e.key === "Enter" && mentionSugerencias.length === 1) { e.preventDefault(); insertarMencionContenido(mentionSugerencias[0].nombre); return; }
                }
              }}
              onClick={e => detectMention((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              placeholder="Escribí lo que necesitás… usá @nombre para mencionar a alguien"
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink-2 outline-none placeholder:text-ink-3/40"
              style={{ minHeight: "calc(100vh - 260px)" }}
            />

            {/* Dropdown @menciones */}
            {mentionSugerencias.length > 0 && (
              <div className="absolute left-8 top-4 z-50 overflow-hidden rounded-[10px] border border-line bg-paper shadow-lg">
                {mentionSugerencias.map(p => (
                  <button key={p.id} type="button"
                    onMouseDown={e => { e.preventDefault(); insertarMencionContenido(p.nombre); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-line-soft hover:text-ink">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-soft text-[10px] font-bold text-ink">
                      {p.inicial}
                    </span>
                    {p.nombre}
                    <span className="ml-auto text-[11px] text-ink-3">{p.rol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-3">
          <p className="text-[14px]">Seleccioná una nota o creá una nueva</p>
          <button type="button" onClick={() => nuevaNota("personal")}
            className="flex items-center gap-2 rounded-[10px] bg-lime px-4 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85">
            <Plus size={14} strokeWidth={2.5} /> Nueva nota personal
          </button>
        </div>
      )}

      {confirmElim && (
        <ConfirmDialog
          titulo="¿Eliminar nota?"
          mensaje="Se va a mover a la papelera. Podés recuperarla desde ahí."
          labelConfirmar="Mover a papelera"
          onConfirmar={() => { eliminarNota(confirmElim); setConfirmElim(null); }}
          onCancelar={() => setConfirmElim(null)}
        />
      )}
    </div>
  );
}
