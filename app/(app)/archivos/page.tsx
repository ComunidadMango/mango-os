"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import {
  ArrowLeft, FolderOpen, FileText, ImageIcon, Video,
  Archive, Table, File, Upload, Trash2, ExternalLink,
  AlertTriangle, Loader2, FolderPlus, X, Check, HardDrive, Pencil,
  MessageSquare, Send, ChevronDown, Star, GripVertical,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { clientes, equipo, persona } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";
import ConfirmDialog from "@/components/ConfirmDialog";
import { enviarAPapelera } from "@/lib/papelera";

// ─── TIPOS ───────────────────────────────────────────────────────────────────

type DriveFile = {
  id: string; name: string; mimeType: string;
  size?: string; modifiedTime: string; webViewLink?: string;
};

type Crumb = { nombre: string; folderId: string };

type Ruta =
  | { nivel: "root" }
  | { nivel: "cliente";  clienteId: string; nombreCliente: string; folderId: string }
  | { nivel: "seccion";  nombre: string; folderId: string }
  | { nivel: "folder";   nombre: string; folderId: string; path: Crumb[]; parentType: "cliente" | "seccion" | "personal"; parentLabel: string; parentFolderId: string }
  | { nivel: "personal"; folderId: string };

type SeccionCustom  = { id: string; nombre: string; folderId: string };
type CarpetaCustom  = { id: string; nombre: string; folderId: string };

type NotaFolder = { id: string; autorId: string; texto: string; fecha: string; menciones: string[] };
type NotasMap   = Record<string, NotaFolder[]>;

// ─── HELPERS VISUALES ────────────────────────────────────────────────────────

const MIME_FOLDER = "application/vnd.google-apps.folder";

function mimeIcon(mimeType: string): { Icono: LucideIcon; bg: string } {
  if (mimeType.startsWith("image/"))                               return { Icono: ImageIcon, bg: "bg-ok-bg text-ok"        };
  if (mimeType.startsWith("video/"))                               return { Icono: Video,     bg: "bg-warn-bg text-warn"    };
  if (mimeType === "application/pdf")                              return { Icono: FileText,  bg: "bg-crit-bg text-crit"    };
  if (mimeType.includes("sheet") || mimeType.includes("excel"))   return { Icono: Table,     bg: "bg-ok-bg text-ok"        };
  if (mimeType.includes("document") || mimeType.includes("word")) return { Icono: FileText,  bg: "bg-line-soft text-ink-2" };
  if (mimeType.includes("zip") || mimeType.includes("tar"))       return { Icono: Archive,   bg: "bg-line-soft text-ink-2" };
  return { Icono: File, bg: "bg-line-soft text-ink-2" };
}

function fmtTamaño(bytes?: string): string {
  if (!bytes) return "";
  const n = parseInt(bytes);
  if (n < 1024)          return `${n} B`;
  if (n < 1_048_576)     return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${(n / 1_073_741_824).toFixed(1)} GB`;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function tiempoRelativo(iso: string): string {
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

function uid(): string { return Math.random().toString(36).slice(2, 10); }

// ─── CACHE ────────────────────────────────────────────────────────────────────

function cacheGet(key: string): string | null {
  try { return localStorage.getItem(`mango-drive:${key}`); } catch { return null; }
}
function cacheSet(key: string, value: string): void {
  try { localStorage.setItem(`mango-drive:${key}`, value); } catch {}
}

const KEY_SECCIONES     = "mango-archivos-secciones";
const KEY_CARPETAS_EXTRA = "mango-archivos-carpetas-extra";
const KEY_NOTAS         = "mango-archivos-notas";

// ─── API ─────────────────────────────────────────────────────────────────────

async function apiRoot(): Promise<{ clientesFolderId: string; equipoFolderId: string; seccionesFolderId: string }> {
  const res = await fetch("/api/drive/root");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiMkdir(name: string, parentId: string): Promise<string> {
  const res = await fetch("/api/drive/mkdir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId }) });
  if (!res.ok) throw new Error(await res.text());
  return ((await res.json()) as { folderId: string }).folderId;
}
async function apiList(folderId: string): Promise<DriveFile[]> {
  const res = await fetch(`/api/drive/list?folderId=${folderId}`);
  if (!res.ok) throw new Error(await res.text());
  return ((await res.json()) as { files: DriveFile[] }).files;
}
async function apiUpload(file: File, parentId: string): Promise<DriveFile> {
  const fd = new FormData(); fd.append("file", file); fd.append("parentId", parentId);
  const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DriveFile>;
}
async function apiDelete(fileId: string): Promise<void> {
  await fetch("/api/drive/delete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId }) });
}
async function apiRename(fileId: string, newName: string): Promise<void> {
  const res = await fetch("/api/drive/rename", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId, newName }) });
  if (!res.ok) throw new Error(await res.text());
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Archivos() {
  const usuario           = useUsuarioActual();
  const { data: session } = useSession();

  const [ruta,            setRuta]            = useState<Ruta>({ nivel: "root" });
  const [items,           setItems]           = useState<DriveFile[]>([]);
  const [cargando,        setCargando]        = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [subiendo,        setSubiendo]        = useState(false);
  const [raiz,            setRaiz]            = useState<{ clientesFolderId: string; equipoFolderId: string; seccionesFolderId: string } | null>(null);
  const [sinDrive,        setSinDrive]        = useState(false);
  const [mostrarInput,    setMostrarInput]    = useState(false);
  const [nombreNueva,     setNombreNueva]     = useState("");
  const [creando,         setCreando]         = useState(false);
  const [confirmEliminar,  setConfirmEliminar]  = useState<{ id: string; nombre: string } | null>(null);
  const [confirmSeccion,   setConfirmSeccion]   = useState<{ id: string; nombre: string } | null>(null);
  const [confirmCarpeta,   setConfirmCarpeta]   = useState<{ id: string; nombre: string } | null>(null);

  // Secciones personalizadas
  const [secciones,        setSecciones]        = useState<SeccionCustom[]>([]);
  const [modalSeccion,     setModalSeccion]     = useState(false);
  const [nombreSeccion,    setNombreSeccion]    = useState("");
  const [creandoSeccion,   setCreandoSeccion]   = useState(false);
  const seccionInputRef = useRef<HTMLInputElement>(null);

  // Carpetas extra en Clientes
  const [carpetasExtra,      setCarpetasExtra]      = useState<CarpetaCustom[]>([]);
  const [modalCarpeta,       setModalCarpeta]       = useState(false);
  const [nombreCarpeta,      setNombreCarpeta]      = useState("");
  const [creandoCarpeta,     setCreandoCarpeta]     = useState(false);
  const carpetaInputRef = useRef<HTMLInputElement>(null);

  // Notas
  const [notasMap, setNotasMap] = useState<NotasMap>({});

  const fileRef  = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    apiRoot()
      .then((r) => { setRaiz(r); cacheSet("root-clientes", r.clientesFolderId); cacheSet("root-equipo", r.equipoFolderId); cacheSet("root-secciones", r.seccionesFolderId); })
      .catch(() => setSinDrive(true));

    startTransition(() => {
      try {
        const s = localStorage.getItem(KEY_SECCIONES);
        if (s) setSecciones(JSON.parse(s));
      } catch {}
      try {
        const c = localStorage.getItem(KEY_CARPETAS_EXTRA);
        if (c) setCarpetasExtra(JSON.parse(c));
      } catch {}
      try {
        const n = localStorage.getItem(KEY_NOTAS);
        if (n) setNotasMap(JSON.parse(n));
      } catch {}
    });
  }, []);

  useEffect(() => { if (modalSeccion) seccionInputRef.current?.focus(); }, [modalSeccion]);
  useEffect(() => { if (modalCarpeta) carpetaInputRef.current?.focus(); }, [modalCarpeta]);

  // ── Cargar Drive al cambiar de carpeta ────────────────────────────────────

  const cargarItems = useCallback(async (folderId: string) => {
    startTransition(() => { setCargando(true); setError(null); setItems([]); });
    try { const data = await apiList(folderId); startTransition(() => setItems(data)); }
    catch { startTransition(() => setError("No se pudo cargar el contenido.")); }
    finally { startTransition(() => setCargando(false)); }
  }, []);

  useEffect(() => {
    startTransition(() => { setItems([]); setMostrarInput(false); setNombreNueva(""); });
    const folderId = "folderId" in ruta ? ruta.folderId : null;
    if (folderId) cargarItems(folderId);
  }, [ruta, cargarItems]);

  useEffect(() => { if (mostrarInput) inputRef.current?.focus(); }, [mostrarInput]);

  // ── Navegación ────────────────────────────────────────────────────────────

  const SUBCARPETAS_CLIENTE = ["CREATIVOS", "ESTRATEGIA", "GUIONES", "REPORTES", "NOTAS"] as const;

  async function abrirCliente(clienteId: string, nombreCliente: string) {
    if (!raiz) return; setCargando(true);
    try {
      const key = `cliente:${clienteId}`;
      let folderId = cacheGet(key);
      if (!folderId) { folderId = await apiMkdir(nombreCliente, raiz.clientesFolderId); cacheSet(key, folderId); }

      // Crear subcarpetas estándar la primera vez
      const initKey = `mango-drive-init:${nombreCliente}`;
      if (!localStorage.getItem(initKey)) {
        await Promise.all(SUBCARPETAS_CLIENTE.map(n => apiMkdir(n, folderId!)));
        localStorage.setItem(initKey, "1");
      }

      setRuta({ nivel: "cliente", clienteId, nombreCliente, folderId });
    } catch { setError("No se pudo abrir la carpeta del cliente."); }
    finally { setCargando(false); }
  }

  function abrirSubcarpeta(folder: DriveFile) {
    if (ruta.nivel === "cliente") {
      setRuta({ nivel: "folder", nombre: folder.name, folderId: folder.id, path: [], parentType: "cliente", parentLabel: ruta.nombreCliente, parentFolderId: ruta.folderId });
    } else if (ruta.nivel === "seccion") {
      setRuta({ nivel: "folder", nombre: folder.name, folderId: folder.id, path: [], parentType: "seccion", parentLabel: ruta.nombre, parentFolderId: ruta.folderId });
    } else if (ruta.nivel === "personal") {
      setRuta({ nivel: "folder", nombre: folder.name, folderId: folder.id, path: [], parentType: "personal", parentLabel: "Mis archivos", parentFolderId: ruta.folderId });
    } else if (ruta.nivel === "folder") {
      setRuta({ ...ruta, nombre: folder.name, folderId: folder.id, path: [...ruta.path, { nombre: ruta.nombre, folderId: ruta.folderId }] });
    }
  }

  async function abrirPersonal() {
    if (!raiz) return; setCargando(true);
    try {
      const key = `personal:${usuario.id}`;
      let folderId = cacheGet(key);
      if (!folderId) { folderId = await apiMkdir(usuario.nombre, raiz.equipoFolderId); cacheSet(key, folderId); }
      setRuta({ nivel: "personal", folderId });
    } catch { setError("No se pudo abrir tu carpeta personal."); }
    finally { setCargando(false); }
  }

  function abrirSeccion(s: SeccionCustom) {
    setRuta({ nivel: "seccion", nombre: s.nombre, folderId: s.folderId });
  }

  function volver() {
    if (ruta.nivel === "root") return;
    if (ruta.nivel === "cliente" || ruta.nivel === "personal" || ruta.nivel === "seccion") { setRuta({ nivel: "root" }); return; }
    if (ruta.nivel === "folder") {
      const { path, parentType, parentLabel, parentFolderId } = ruta;
      if (path.length > 0) {
        const prev = path[path.length - 1];
        setRuta({ ...ruta, nombre: prev.nombre, folderId: prev.folderId, path: path.slice(0, -1) });
        return;
      }
      if (parentType === "cliente") {
        const c = clientes.find(c => c.nombre === parentLabel);
        setRuta({ nivel: "cliente", clienteId: c?.id ?? "", nombreCliente: parentLabel, folderId: parentFolderId });
      } else if (parentType === "seccion") {
        setRuta({ nivel: "seccion", nombre: parentLabel, folderId: parentFolderId });
      } else {
        setRuta({ nivel: "personal", folderId: parentFolderId });
      }
    }
  }

  function navegarACrumb(crumb: Crumb, idx: number) {
    if (ruta.nivel !== "folder") return;
    if (idx < 0) {
      volver();
    } else {
      setRuta({ ...ruta, nombre: crumb.nombre, folderId: crumb.folderId, path: ruta.path.slice(0, idx) });
    }
  }

  // ── Secciones personalizadas ──────────────────────────────────────────────

  async function crearSeccion() {
    const nombre = nombreSeccion.trim();
    if (!nombre || !raiz) return;
    setCreandoSeccion(true);
    try {
      const folderId = await apiMkdir(nombre, raiz.seccionesFolderId);
      const nueva: SeccionCustom = { id: uid(), nombre, folderId };
      const next = [...secciones, nueva];
      setSecciones(next);
      localStorage.setItem(KEY_SECCIONES, JSON.stringify(next));
      setModalSeccion(false);
      setNombreSeccion("");
    } catch { setError("No se pudo crear la sección."); }
    finally { setCreandoSeccion(false); }
  }

  function eliminarSeccion(id: string) {
    const sec = secciones.find(s => s.id === id);
    if (sec) enviarAPapelera({ id: sec.id, tipo: "seccion", titulo: sec.nombre, datos: sec });
    const next = secciones.filter(s => s.id !== id);
    setSecciones(next);
    localStorage.setItem(KEY_SECCIONES, JSON.stringify(next));
    if (ruta.nivel === "seccion" && sec?.folderId === ruta.folderId) {
      setRuta({ nivel: "root" });
    }
  }

  async function crearCarpetaCliente() {
    const nombre = nombreCarpeta.trim();
    if (!nombre || !raiz) return;
    setCreandoCarpeta(true);
    try {
      const folderId = await apiMkdir(nombre, raiz.clientesFolderId);
      const nueva: CarpetaCustom = { id: uid(), nombre, folderId };
      const next = [...carpetasExtra, nueva];
      setCarpetasExtra(next);
      localStorage.setItem(KEY_CARPETAS_EXTRA, JSON.stringify(next));
      setModalCarpeta(false);
      setNombreCarpeta("");
    } catch { setError("No se pudo crear la carpeta."); }
    finally { setCreandoCarpeta(false); }
  }

  function eliminarCarpetaExtra(id: string) {
    const carpeta = carpetasExtra.find(c => c.id === id);
    if (carpeta) enviarAPapelera({ id: carpeta.id, tipo: "carpeta-extra", titulo: carpeta.nombre, datos: carpeta });
    const next = carpetasExtra.filter(c => c.id !== id);
    setCarpetasExtra(next);
    localStorage.setItem(KEY_CARPETAS_EXTRA, JSON.stringify(next));
  }

  function abrirCarpetaExtra(carpeta: CarpetaCustom) {
    setRuta({ nivel: "cliente", clienteId: carpeta.id, nombreCliente: carpeta.nombre, folderId: carpeta.folderId });
  }

  // ── Notas ─────────────────────────────────────────────────────────────────

  function publicarNota(folderId: string, texto: string) {
    const menciones = [...texto.matchAll(/@(\w+)/g)]
      .map(m => m[1].toLowerCase())
      .filter(nombre => equipo.some(p => p.nombre.toLowerCase() === nombre));

    const nota: NotaFolder = { id: uid(), autorId: usuario.id, texto, fecha: new Date().toISOString(), menciones };
    const prev = notasMap[folderId] ?? [];
    const next = { ...notasMap, [folderId]: [...prev, nota] };
    setNotasMap(next);
    localStorage.setItem(KEY_NOTAS, JSON.stringify(next));
  }

  function eliminarNota(folderId: string, notaId: string) {
    const next = { ...notasMap, [folderId]: (notasMap[folderId] ?? []).filter(n => n.id !== notaId) };
    setNotasMap(next);
    localStorage.setItem(KEY_NOTAS, JSON.stringify(next));
  }

  // ── Drive Picker ──────────────────────────────────────────────────────────

  function abrirPicker() {
    const token    = session?.accessToken;
    const parentId = "folderId" in ruta ? ruta.folderId : null;
    if (!token || !parentId) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY!;
    const appId  = process.env.NEXT_PUBLIC_GOOGLE_APP_ID!;

    function buildPicker() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gp = (window as any).google.picker;
      new gp.PickerBuilder()
        .addView(new gp.DocsView().setIncludeFolders(false))
        .addView(new gp.DocsView().setIncludeFolders(false).setEnableDrives(true))
        .setOAuthToken(token!)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .setCallback(async (data: any) => {
          if (data.action !== gp.Action.PICKED) return;
          const picked = data.docs[0] as { id: string };
          const res = await fetch("/api/drive/move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: picked.id, targetFolderId: parentId }) });
          if (res.ok) { const moved = await res.json() as DriveFile; setItems((prev) => [moved, ...prev]); }
          else setError("No se pudo mover el archivo.");
        })
        .build().setVisible(true);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.gapi?.load) w.gapi.load("picker", buildPicker);
    else { const s = document.createElement("script"); s.src = "https://apis.google.com/js/api.js"; s.onload = () => w.gapi.load("picker", buildPicker); document.head.appendChild(s); }
  }

  // ── Nueva carpeta ─────────────────────────────────────────────────────────

  async function crearCarpeta() {
    const parentId = "folderId" in ruta ? ruta.folderId : null;
    if (!nombreNueva.trim() || !parentId) return;
    setCreando(true);
    try {
      const folderId = await apiMkdir(nombreNueva.trim(), parentId);
      const nueva: DriveFile = { id: folderId, name: nombreNueva.trim(), mimeType: MIME_FOLDER, modifiedTime: new Date().toISOString() };
      setItems((prev) => [nueva, ...prev]);
      setMostrarInput(false); setNombreNueva("");
    } catch { setError("No se pudo crear la carpeta."); }
    finally { setCreando(false); }
  }

  // ── Renombrar / Eliminar ──────────────────────────────────────────────────

  async function renombrar(id: string, newName: string) {
    try {
      await apiRename(id, newName);
      setItems((prev) => prev.map((f) => f.id === id ? { ...f, name: newName } : f));
    } catch { setError("No se pudo renombrar."); }
  }

  async function ejecutarEliminar(id: string) {
    await apiDelete(id);
    setItems((prev) => prev.filter((f) => f.id !== id));
    setConfirmEliminar(null);
  }

  // ── Subir ─────────────────────────────────────────────────────────────────

  async function subir(file: File) {
    const parentId = "folderId" in ruta ? ruta.folderId : null;
    if (!parentId) return;
    setSubiendo(true);
    try { const nuevo = await apiUpload(file, parentId); setItems((prev) => [nuevo, ...prev]); }
    catch { setError("No se pudo subir el archivo."); }
    finally { setSubiendo(false); }
  }

  // ── Títulos y estado ──────────────────────────────────────────────────────

  const tituloActual =
    ruta.nivel === "root"     ? "Archivos" :
    ruta.nivel === "personal" ? "Mis archivos" :
    ruta.nivel === "cliente"  ? ruta.nombreCliente :
    ruta.nivel === "seccion"  ? ruta.nombre :
    ruta.nombre;

  const enCarpeta  = ruta.nivel !== "root";
  const subfolders = items.filter((f) => f.mimeType === MIME_FOLDER);
  const soloArch   = items.filter((f) => f.mimeType !== MIME_FOLDER);
  const folderActual = "folderId" in ruta ? ruta.folderId : null;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1180px]">

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {enCarpeta && (
          <button type="button" onClick={volver}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink">
            <ArrowLeft size={14} strokeWidth={2} />
            {ruta.nivel === "folder"
              ? ruta.path.length > 0
                ? ruta.path[ruta.path.length - 1].nombre
                : ruta.parentLabel
              : "Archivos"}
          </button>
        )}

        <h1 className="font-display text-[28px] leading-none">{tituloActual}</h1>

        {/* Breadcrumb intermedio (solo en nivel folder) */}
        {ruta.nivel === "folder" && (
          <div className="flex flex-wrap items-center gap-1 text-[12px] text-ink-3">
            <button onClick={() => setRuta({ nivel: "root" })} className="transition-colors hover:text-ink">Archivos</button>
            <span className="opacity-40">›</span>
            <button onClick={() => navegarACrumb({ nombre: ruta.parentLabel, folderId: ruta.parentFolderId }, -1)}
              className="transition-colors hover:text-ink">{ruta.parentLabel}</button>
            {ruta.path.map((crumb, i) => (
              <span key={crumb.folderId} className="flex items-center gap-1">
                <span className="opacity-40">›</span>
                <button onClick={() => navegarACrumb(crumb, i)} className="transition-colors hover:text-ink">{crumb.nombre}</button>
              </span>
            ))}
            <span className="opacity-40">›</span>
          </div>
        )}

        {/* Acciones dentro de carpeta */}
        {enCarpeta && (
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setMostrarInput((v) => !v)}
              className="flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-2 text-[13px] font-bold transition-colors hover:border-ink-3/60 hover:bg-paper">
              <FolderPlus size={14} strokeWidth={2} /> Nueva carpeta
            </button>
            <button type="button" onClick={abrirPicker}
              className="flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-2 text-[13px] font-bold transition-colors hover:border-ink-3/60 hover:bg-paper">
              <HardDrive size={14} strokeWidth={2} /> Desde Drive
            </button>
            <input ref={fileRef} type="file" className="hidden" multiple
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo}
              className="flex items-center gap-2 rounded-[10px] bg-lime px-3.5 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-40">
              {subiendo ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <Upload size={15} strokeWidth={2.4} />}
              Subir archivo
            </button>
          </div>
        )}
      </div>

      {/* Input nueva carpeta */}
      {mostrarInput && (
        <div className="mb-4 flex items-center gap-2">
          <input ref={inputRef} value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") crearCarpeta(); if (e.key === "Escape") { setMostrarInput(false); setNombreNueva(""); } }}
            placeholder="Nombre de la carpeta…"
            className="flex-1 rounded-[10px] border border-line bg-card px-3.5 py-2 text-[13.5px] outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10" />
          <button type="button" onClick={crearCarpeta} disabled={!nombreNueva.trim() || creando}
            className="flex items-center gap-1.5 rounded-[10px] bg-lime px-3.5 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-40">
            {creando ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Check size={14} strokeWidth={2.4} />}
            Crear
          </button>
          <button type="button" onClick={() => { setMostrarInput(false); setNombreNueva(""); }}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line text-ink-3 transition-colors hover:bg-paper hover:text-ink">
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Avisos */}
      {sinDrive && (
        <div className="mb-6 flex items-start gap-3 rounded-[12px] border border-warn/30 bg-warn-bg px-4 py-3.5">
          <AlertTriangle size={17} strokeWidth={2} className="mt-px shrink-0 text-warn" />
          <div>
            <p className="text-[13.5px] font-bold text-warn">Google Drive no configurado</p>
            <p className="mt-0.5 text-[12.5px] text-warn/80">Agregá <code className="rounded bg-warn/10 px-1">DRIVE_SHARED_ID</code> al .env.local</p>
          </div>
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center justify-between rounded-[10px] border border-crit/30 bg-crit-bg px-4 py-3 text-[13px] text-crit">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-4 opacity-60 hover:opacity-100"><X size={14} strokeWidth={2} /></button>
        </div>
      )}

      {/* ── ROOT ──────────────────────────────────────────────────────────── */}
      {ruta.nivel === "root" && (
        <>
          {/* Clientes */}
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">Clientes</h2>
              <button type="button" onClick={() => setModalCarpeta(true)} disabled={!raiz || sinDrive}
                className="flex items-center gap-1 rounded-[7px] border border-line px-2 py-1 text-[11.5px] text-ink-3 transition-colors hover:border-ink-3/50 hover:text-ink disabled:opacity-40">
                + Nueva carpeta
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {clientes.map((c) => (
                <button key={c.id} type="button" onClick={() => abrirCliente(c.id, c.nombre)}
                  disabled={!raiz || sinDrive}
                  className="group flex flex-col items-start gap-2.5 rounded-card border border-line bg-card p-4 text-left transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-lime-soft text-ink transition-colors group-hover:bg-lime">
                    <FolderOpen size={18} strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-bold leading-snug">{c.nombre}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">{c.rubro}</p>
                  </div>
                </button>
              ))}
              {carpetasExtra.map((c) => (
                <div key={c.id} className="group relative">
                  <button type="button" onClick={() => abrirCarpetaExtra(c)}
                    className="flex w-full flex-col items-start gap-2.5 rounded-card border border-line bg-card p-4 text-left transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-lime-soft text-ink transition-colors group-hover:bg-lime">
                      <FolderOpen size={18} strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="text-[13.5px] font-bold leading-snug">{c.nombre}</p>
                      <p className="mt-0.5 text-[11.5px] text-ink-3">Carpeta manual</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => setConfirmCarpeta({ id: c.id, nombre: c.nombre })} title="Quitar carpeta"
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[7px] border border-line bg-card text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-crit-bg hover:text-crit">
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Mis archivos */}
          <section className="mb-8">
            <h2 className="mb-3 font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">Mis archivos</h2>
            <button type="button" onClick={abrirPersonal} disabled={!raiz || sinDrive}
              className="group flex items-center gap-3 rounded-card border border-line bg-card p-4 transition-all hover:border-ink-3/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-line-soft text-ink-2 transition-colors group-hover:bg-lime-soft group-hover:text-ink">
                <FolderOpen size={18} strokeWidth={1.8} />
              </span>
              <div className="text-left">
                <p className="text-[13.5px] font-bold">{usuario.nombre}</p>
                <p className="text-[11.5px] text-ink-3">Solo vos podés ver esto</p>
              </div>
            </button>
          </section>

          {/* Secciones personalizadas */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">Secciones</h2>
              <button type="button" onClick={() => setModalSeccion(true)} disabled={!raiz || sinDrive}
                className="flex items-center gap-1 rounded-[7px] border border-line px-2 py-1 text-[11.5px] text-ink-3 transition-colors hover:border-ink-3/50 hover:text-ink disabled:opacity-40">
                + Nueva carpeta
              </button>
            </div>
            {secciones.length === 0 ? (
              <p className="text-[13px] text-ink-3">Sin secciones todavía. Creá una para organizar archivos generales.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {secciones.map((s) => (
                  <div key={s.id} className="group relative">
                    <button type="button" onClick={() => abrirSeccion(s)}
                      className="flex w-full flex-col items-start gap-2.5 rounded-card border border-line bg-card p-4 text-left transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-line-soft text-ink-2 transition-colors group-hover:bg-lime-soft group-hover:text-ink">
                        <FolderOpen size={18} strokeWidth={1.8} />
                      </span>
                      <p className="text-[13.5px] font-bold leading-snug">{s.nombre}</p>
                    </button>
                    <button type="button" onClick={() => setConfirmSeccion({ id: s.id, nombre: s.nombre })} title="Eliminar sección"
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[7px] border border-line bg-card text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-crit-bg hover:text-crit">
                      <Trash2 size={11} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── CARPETA ───────────────────────────────────────────────────────── */}
      {enCarpeta && (
        <>
          {cargando ? (
            <div className="flex items-center gap-2 py-12 text-[13px] text-ink-3">
              <Loader2 size={16} strokeWidth={2} className="animate-spin" /> Cargando…
            </div>
          ) : (
            <>
              {/* Subcarpetas */}
              {subfolders.length > 0 && (
                <section className={soloArch.length > 0 ? "mb-6" : ""}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {subfolders.map((f) => (
                      <FolderCard key={f.id} folder={f}
                        onNavigate={() => abrirSubcarpeta(f)}
                        onRename={(n) => renombrar(f.id, n)}
                        onDelete={() => setConfirmEliminar({ id: f.id, nombre: f.name })} />
                    ))}
                  </div>
                </section>
              )}

              {/* Archivos */}
              {soloArch.length > 0 && (
                <section className={subfolders.length > 0 ? "mb-6" : ""}>
                  {subfolders.length > 0 && (
                    <h3 className="mb-3 font-display text-[12px] uppercase tracking-[0.09em] text-ink-3">Archivos</h3>
                  )}
                  <ListaArchivos archivos={soloArch}
                    folderId={folderActual ?? undefined}
                    onEliminar={(id, nombre) => setConfirmEliminar({ id, nombre })}
                    onRenombrar={renombrar} />
                </section>
              )}

              {/* Vacío */}
              {items.length === 0 && (
                <div className="mb-6 rounded-card border border-dashed border-line py-16 text-center">
                  <FolderOpen size={22} strokeWidth={1.8} className="mx-auto mb-3 text-ink-3" />
                  <p className="text-[13.5px] text-ink-3">Esta carpeta está vacía</p>
                  <p className="mt-1 text-[12px] text-ink-3/70">Creá una subcarpeta o subí un archivo</p>
                </div>
              )}

              {/* Notas */}
              {folderActual && (
                <NotasSection
                  notas={notasMap[folderActual] ?? []}
                  usuarioId={usuario.id}
                  onPublicar={(texto) => publicarNota(folderActual, texto)}
                  onEliminar={(notaId) => eliminarNota(folderActual, notaId)}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Modal nueva carpeta en Clientes */}
      {modalCarpeta && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]" onClick={() => setModalCarpeta(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-line bg-paper p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 font-display text-[16px] font-bold">Nueva carpeta en Clientes</p>
            <p className="mb-4 text-[12.5px] text-ink-3">Se crea en Google Drive dentro de la carpeta Clientes.</p>
            <input
              ref={carpetaInputRef}
              type="text"
              value={nombreCarpeta}
              onChange={(e) => setNombreCarpeta(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") crearCarpetaCliente(); if (e.key === "Escape") setModalCarpeta(false); }}
              placeholder="Ej: Casa del Lago, Inner Space…"
              className="mb-4 w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[13.5px] outline-none focus:border-ink-3"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalCarpeta(false)}
                className="flex-1 rounded-[10px] border border-line py-2 text-[13px] text-ink-2 hover:bg-line-soft">
                Cancelar
              </button>
              <button type="button" onClick={crearCarpetaCliente} disabled={!nombreCarpeta.trim() || creandoCarpeta}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-lime py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-40">
                {creandoCarpeta ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : null}
                Crear
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal nueva sección */}
      {modalSeccion && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]" onClick={() => setModalSeccion(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-line bg-paper p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 font-display text-[16px] font-bold">Nueva sección</p>
            <input
              ref={seccionInputRef}
              type="text"
              value={nombreSeccion}
              onChange={(e) => setNombreSeccion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") crearSeccion(); if (e.key === "Escape") setModalSeccion(false); }}
              placeholder="Ej: Contenido interno, Templates…"
              className="mb-4 w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[13.5px] outline-none focus:border-ink-3"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalSeccion(false)}
                className="flex-1 rounded-[10px] border border-line py-2 text-[13px] text-ink-2 hover:bg-line-soft">
                Cancelar
              </button>
              <button type="button" onClick={crearSeccion} disabled={!nombreSeccion.trim() || creandoSeccion}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-lime py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-40">
                {creandoSeccion ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : null}
                Crear
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmación — Drive */}
      {confirmEliminar && (
        <ConfirmDialog
          titulo={`¿Mover "${confirmEliminar.nombre}" a la papelera?`}
          mensaje="Se va a la papelera de Google Drive. Podés recuperarlo desde ahí."
          labelConfirmar="Mover a papelera"
          onConfirmar={() => { ejecutarEliminar(confirmEliminar.id); }}
          onCancelar={() => setConfirmEliminar(null)}
        />
      )}

      {/* Confirmación — Sección */}
      {confirmSeccion && (
        <ConfirmDialog
          titulo={`¿Eliminar sección "${confirmSeccion.nombre}"?`}
          mensaje="Se va a mover a la papelera de Mango. La carpeta en Drive no se borra."
          labelConfirmar="Mover a papelera"
          onConfirmar={() => { eliminarSeccion(confirmSeccion.id); setConfirmSeccion(null); }}
          onCancelar={() => setConfirmSeccion(null)}
        />
      )}

      {/* Confirmación — Carpeta extra */}
      {confirmCarpeta && (
        <ConfirmDialog
          titulo={`¿Quitar "${confirmCarpeta.nombre}" de Clientes?`}
          mensaje="Se va a mover a la papelera de Mango. La carpeta en Drive no se borra."
          labelConfirmar="Mover a papelera"
          onConfirmar={() => { eliminarCarpetaExtra(confirmCarpeta.id); setConfirmCarpeta(null); }}
          onCancelar={() => setConfirmCarpeta(null)}
        />
      )}
    </div>
  );
}

// ─── NOTAS ────────────────────────────────────────────────────────────────────

function renderTexto(texto: string) {
  return texto.split(/(@\w+)/g).map((parte, i) =>
    parte.startsWith("@")
      ? <mark key={i} className="rounded-[4px] bg-lime-soft px-1 text-[12px] font-semibold text-ink not-italic">{parte}</mark>
      : <span key={i}>{parte}</span>
  );
}

function NotasSection({ notas, usuarioId, onPublicar, onEliminar }: {
  notas: NotaFolder[];
  usuarioId: string;
  onPublicar: (texto: string) => void;
  onEliminar: (notaId: string) => void;
}) {
  const [abierto,      setAbierto]      = useState(true);
  const [texto,        setTexto]        = useState("");
  const [sugerencias,  setSugerencias]  = useState<typeof equipo>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleTexto(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setTexto(val);
    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1 && lastAt === val.length - 1 - (val.length - 1 - lastAt)) {
      const fragment = val.slice(lastAt + 1).toLowerCase();
      const matches = equipo.filter(p => p.nombre.toLowerCase().startsWith(fragment));
      setSugerencias(matches);
    } else if (lastAt !== -1) {
      const fragment = val.slice(lastAt + 1).toLowerCase();
      if (!fragment.includes(" ")) {
        setSugerencias(equipo.filter(p => p.nombre.toLowerCase().startsWith(fragment)));
      } else {
        setSugerencias([]);
      }
    } else {
      setSugerencias([]);
    }
  }

  function insertar(nombre: string) {
    const lastAt = texto.lastIndexOf("@");
    setTexto(texto.slice(0, lastAt) + `@${nombre} `);
    setSugerencias([]);
    textareaRef.current?.focus();
  }

  function publicar() {
    const t = texto.trim();
    if (!t) return;
    onPublicar(t);
    setTexto("");
    setSugerencias([]);
  }

  return (
    <div className="mt-8">
      {/* Header */}
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink"
      >
        <MessageSquare size={14} strokeWidth={2} className="text-ink-3" />
        Notas
        {notas.length > 0 && (
          <span className="rounded-full bg-line-soft px-1.5 py-px text-[11px] font-normal text-ink-3">
            {notas.length}
          </span>
        )}
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={["ml-1 text-ink-3 transition-transform", abierto ? "" : "-rotate-90"].join(" ")}
        />
      </button>

      {abierto && (
        <div className="flex flex-col gap-3">
          {/* Lista de notas */}
          {notas.map((nota) => {
            const autor = equipo.find(p => p.id === nota.autorId);
            const esMia = nota.autorId === usuarioId;
            return (
              <div key={nota.id} className="group flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-soft text-[11px] font-bold text-ink">
                  {autor?.inicial ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold">{autor?.nombre ?? "—"}</span>
                    <span className="text-[11.5px] text-ink-3">{tiempoRelativo(nota.fecha)}</span>
                    {esMia && (
                      <button type="button" onClick={() => onEliminar(nota.id)}
                        className="ml-auto text-[11.5px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-crit">
                        Eliminar
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
                    {renderTexto(nota.texto)}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Input nueva nota */}
          <div className="relative flex items-end gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime text-[11px] font-bold text-ink">
              {persona(usuarioId)?.inicial ?? usuarioId.slice(0, 1).toUpperCase()}
            </span>
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={texto}
                onChange={handleTexto}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); publicar(); } }}
                placeholder="Dejá una nota… usá @nombre para mencionar a alguien"
                rows={2}
                className="w-full resize-none rounded-[10px] border border-line bg-card px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition-colors focus:border-ink-3 placeholder:text-ink-3"
              />
              {/* Dropdown @menciones */}
              {sugerencias.length > 0 && (
                <div className="absolute bottom-full left-0 z-50 mb-1 overflow-hidden rounded-[10px] border border-line bg-paper shadow-lg">
                  {sugerencias.map(p => (
                    <button key={p.id} type="button" onClick={() => insertar(p.nombre)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-ink-2 hover:bg-line-soft hover:text-ink">
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
            <button type="button" onClick={publicar} disabled={!texto.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-lime text-ink transition-opacity hover:opacity-85 disabled:opacity-30">
              <Send size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FOLDER CARD ─────────────────────────────────────────────────────────────

function FolderCard({ folder, onNavigate, onRename, onDelete }: {
  folder: DriveFile;
  onNavigate: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [tempName, setTempName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  function submit() {
    const n = tempName.trim();
    if (n && n !== folder.name) onRename(n);
    setRenaming(false);
  }

  return (
    <div className="group relative rounded-card border border-line bg-card transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm">
      <button type="button" onClick={onNavigate} className="flex w-full flex-col items-start gap-2.5 p-4 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-lime-soft text-ink transition-colors group-hover:bg-lime">
          <FolderOpen size={18} strokeWidth={1.8} />
        </span>
        {renaming ? (
          <input ref={inputRef} value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") setRenaming(false); }}
            onClick={(e) => e.stopPropagation()}
            onBlur={submit}
            className="w-full rounded-[6px] border border-line bg-paper px-2 py-0.5 text-[13.5px] font-bold outline-none focus:border-ink/40" />
        ) : (
          <p className="text-[13.5px] font-bold leading-snug">{folder.name}</p>
        )}
      </button>
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" title="Renombrar"
          onClick={(e) => { e.stopPropagation(); setTempName(folder.name); setRenaming(true); }}
          className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-line bg-card text-ink-3 transition-colors hover:bg-paper hover:text-ink">
          <Pencil size={10} strokeWidth={2} />
        </button>
        <button type="button" title="Mover a papelera"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-line bg-card text-ink-3 transition-colors hover:bg-crit-bg hover:text-crit">
          <Trash2 size={10} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── LISTA DE ARCHIVOS ────────────────────────────────────────────────────────

const KEY_FAVS  = "mango-drive-favs";
const KEY_ORDER = (folderId: string) => `mango-drive-order:${folderId}`;

function loadFavs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY_FAVS) ?? "[]")); } catch { return new Set(); }
}
function saveFavs(favs: Set<string>) {
  try { localStorage.setItem(KEY_FAVS, JSON.stringify([...favs])); } catch {}
}
function loadOrder(folderId: string): string[] {
  try { return JSON.parse(localStorage.getItem(KEY_ORDER(folderId)) ?? "[]"); } catch { return []; }
}
function saveOrder(folderId: string, ids: string[]) {
  try { localStorage.setItem(KEY_ORDER(folderId), JSON.stringify(ids)); } catch {}
}

function sortByOrder(archivos: DriveFile[], savedOrder: string[]): DriveFile[] {
  if (!savedOrder.length) return archivos;
  const map = new Map(archivos.map(f => [f.id, f]));
  const ordered = savedOrder.map(id => map.get(id)).filter(Boolean) as DriveFile[];
  const rest = archivos.filter(f => !savedOrder.includes(f.id));
  return [...ordered, ...rest];
}

function ListaArchivos({ archivos, folderId, onEliminar, onRenombrar }: {
  archivos: DriveFile[];
  folderId?: string;
  onEliminar: (id: string, nombre: string) => void;
  onRenombrar: (id: string, newName: string) => void;
}) {
  const [renaming,  setRenaming]  = useState<string | null>(null);
  const [favs,      setFavs]      = useState<Set<string>>(new Set());
  const [orden,     setOrden]     = useState<DriveFile[]>(archivos);
  const [dragIdx,   setDragIdx]   = useState<number | null>(null);
  const [overIdx,   setOverIdx]   = useState<number | null>(null);

  // Init: load favs + saved order
  useEffect(() => {
    setFavs(loadFavs());
    if (folderId) {
      const saved = loadOrder(folderId);
      setOrden(sortByOrder(archivos, saved));
    } else {
      setOrden(archivos);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivos, folderId]);

  function toggleFav(id: string) {
    setFavs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveFavs(next);
      return next;
    });
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, idx: number) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== overIdx) setOverIdx(idx);
  }

  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...orden];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setOrden(next);
    if (folderId) saveOrder(folderId, next.map(f => f.id));
    setDragIdx(null);
    setOverIdx(null);
  }

  function onDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
  }

  // Favorites pinned first, then rest — respecting drag order within each group
  const favFiles  = orden.filter(f => favs.has(f.id));
  const restFiles = orden.filter(f => !favs.has(f.id));
  const lista     = [...favFiles, ...restFiles];

  return (
    <div className="overflow-hidden rounded-card border border-line bg-card">
      <div className="grid grid-cols-[20px_1fr_100px_120px_auto] border-b border-line bg-paper/70 px-5 py-2.5">
        <span />
        {["Nombre", "Tamaño", "Modificado", ""].map((col, i) => (
          <span key={i} className={["font-display text-[11px] uppercase tracking-[0.09em] text-ink-3", i > 0 ? "text-right" : ""].join(" ")}>{col}</span>
        ))}
      </div>
      {lista.map((f, i) => {
        const { Icono, bg } = mimeIcon(f.mimeType);
        const esFav   = favs.has(f.id);
        const isDragging = dragIdx === i;
        const isOver     = overIdx === i && dragIdx !== i;
        return (
          <div key={f.id}
            draggable
            onDragStart={(e) => onDragStart(e, i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDrop={(e) => onDrop(e, i)}
            onDragEnd={onDragEnd}
            className={[
              "group grid grid-cols-[20px_1fr_100px_120px_auto] items-center px-5 py-3 transition-colors",
              i > 0 ? "border-t border-line-soft" : "",
              isDragging ? "opacity-40" : "hover:bg-paper",
              isOver     ? "border-t-2 border-t-lime" : "",
            ].join(" ")}
          >
            {/* Drag handle */}
            <span className="flex cursor-grab items-center text-ink-3 opacity-0 transition-opacity group-hover:opacity-60 active:cursor-grabbing">
              <GripVertical size={14} strokeWidth={1.8} />
            </span>

            <span className="flex min-w-0 items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${bg}`}>
                <Icono size={15} strokeWidth={1.8} />
              </span>
              {renaming === f.id ? (
                <input defaultValue={f.name} autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { onRenombrar(f.id, e.currentTarget.value); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }}
                  onBlur={(e) => { onRenombrar(f.id, e.target.value); setRenaming(null); }}
                  className="min-w-0 flex-1 rounded-[6px] border border-line bg-paper px-2 py-0.5 text-[13.5px] outline-none focus:border-ink/40" />
              ) : (
                <span className="truncate text-[13.5px] font-medium">{f.name}</span>
              )}
            </span>
            <span className="text-right text-[12px] text-ink-3">{fmtTamaño(f.size)}</span>
            <span className="text-right text-[12px] text-ink-3">{fmtFecha(f.modifiedTime)}</span>
            <span className="flex items-center gap-1 pl-4">
              {/* Favorito */}
              <button type="button" onClick={() => toggleFav(f.id)} title={esFav ? "Quitar de favoritos" : "Marcar como favorito"}
                className={["flex h-7 w-7 items-center justify-center rounded-[7px] transition-all",
                  esFav
                    ? "text-amber-400 hover:bg-amber-50"
                    : "text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-line-soft hover:text-amber-400",
                ].join(" ")}>
                <Star size={13} strokeWidth={2} fill={esFav ? "currentColor" : "none"} />
              </button>
              {f.webViewLink && (
                <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-line-soft hover:text-ink">
                  <ExternalLink size={13} strokeWidth={2} />
                </a>
              )}
              <button type="button" onClick={() => setRenaming(f.id)}
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-line-soft hover:text-ink">
                <Pencil size={12} strokeWidth={2} />
              </button>
              <button type="button" onClick={() => onEliminar(f.id, f.name)}
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-crit-bg hover:text-crit">
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

