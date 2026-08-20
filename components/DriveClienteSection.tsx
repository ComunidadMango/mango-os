"use client";

import { useState, useEffect, useRef } from "react";
import {
  FolderOpen, ExternalLink, FileText, ImageIcon, Video, File,
  Loader2, ArrowRight, CheckCircle2, Clock, Upload,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type DriveFile = {
  id: string; name: string; mimeType: string; modifiedTime: string; webViewLink?: string;
};

type Reporte = {
  id: string; cliente_id: string; mes: string;
  entregado: boolean; archivo_url: string | null; entregado_en: string | null;
};

function mesActual(): string { return new Date().toISOString().slice(0, 7); }

function mesLabel(mes: string): string {
  const [anio, m] = mes.split("-");
  const nombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${nombres[parseInt(m) - 1]} ${anio}`;
}

const MIME_FOLDER  = "application/vnd.google-apps.folder";
const SUBCARPETAS  = ["CREATIVOS", "ESTRATEGIA", "GUIONES", "REPORTES", "NOTAS"] as const;
const INIT_KEY     = (nombre: string) => `mango-drive-init:${nombre}`;

function mimeIcon(mime: string) {
  if (mime.startsWith("image/"))                         return { I: ImageIcon, bg: "bg-ok-bg text-ok"        };
  if (mime.startsWith("video/"))                         return { I: Video,     bg: "bg-warn-bg text-warn"    };
  if (mime === "application/pdf")                        return { I: FileText,  bg: "bg-crit-bg text-crit"    };
  if (mime.includes("sheet") || mime.includes("excel"))  return { I: FileText,  bg: "bg-ok-bg text-ok"        };
  return { I: File, bg: "bg-line-soft text-ink-2" };
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

const folderCache = new Map<string, string>();

async function getOrCreateFolder(name: string, parentId: string): Promise<string> {
  const key = `${parentId}:${name}`;
  if (folderCache.has(key)) return folderCache.get(key)!;
  const res = await fetch("/api/drive/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parentId }),
  });
  if (!res.ok) throw new Error("mkdir failed");
  const { folderId } = await res.json() as { folderId: string };
  folderCache.set(key, folderId);
  return folderId;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DriveClienteSection({
  clienteId,
  clienteNombre,
}: {
  clienteId: string;
  clienteNombre: string;
}) {
  const { data: session } = useSession();
  const [items, setItems]         = useState<DriveFile[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [sinDrive, setSinDrive]   = useState(false);

  // Reportes
  const [reportes,   setReportes]   = useState<Reporte[]>([]);
  const [subiendo,   setSubiendo]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const esTheo  = session?.user?.email?.startsWith("theo@");
  const mes     = mesActual();
  const reporteMes = reportes.find(r => r.mes === mes);

  useEffect(() => {
    fetch(`/api/db/reportes?cliente_id=${clienteId}`)
      .then(r => r.ok ? r.json() : [])
      .then(setReportes)
      .catch(() => {});
  }, [clienteId]);

  async function marcarEntregado() {
    const res = await fetch("/api/db/reportes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: clienteId, mes, entregado: true }),
    });
    if (res.ok) {
      const nuevo = await res.json() as Reporte;
      setReportes(prev => { const i = prev.findIndex(r => r.mes === mes); return i >= 0 ? prev.map((r, idx) => idx === i ? nuevo : r) : [nuevo, ...prev]; });
    }
  }

  async function subirPDF(file: File) {
    setSubiendo(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("clienteId", clienteId); fd.append("mes", mes);
      const up = await fetch("/api/db/reportes/upload", { method: "POST", body: fd });
      if (!up.ok) return;
      const { url } = await up.json() as { url: string };
      const res = await fetch("/api/db/reportes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cliente_id: clienteId, mes, entregado: true, archivo_url: url }) });
      if (res.ok) {
        const nuevo = await res.json() as Reporte;
        setReportes(prev => { const i = prev.findIndex(r => r.mes === mes); return i >= 0 ? prev.map((r, idx) => idx === i ? nuevo : r) : [nuevo, ...prev]; });
      }
    } finally { setSubiendo(false); }
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const rootRes = await fetch("/api/drive/root");
        if (!rootRes.ok) { if (!ignore) setSinDrive(true); return; }
        const { clientesFolderId } = await rootRes.json() as { clientesFolderId: string };

        const cFolderId = await getOrCreateFolder(clienteNombre, clientesFolderId);

        // Crear subcarpetas estándar la primera vez
        const initKey = INIT_KEY(clienteNombre);
        if (!localStorage.getItem(initKey)) {
          await Promise.all(SUBCARPETAS.map(n => getOrCreateFolder(n, cFolderId)));
          localStorage.setItem(initKey, "1");
        }

        const listRes = await fetch(`/api/drive/list?folderId=${cFolderId}`);
        const { files } = await listRes.json() as { files: DriveFile[] };

        if (!ignore) setItems(files ?? []);
      } catch {
        if (!ignore) setSinDrive(true);
      } finally {
        if (!ignore) setCargando(false);
      }
    })();
    return () => { ignore = true; };
  }, [clienteNombre]);

  if (sinDrive) {
    return (
      <div className="rounded-card border border-line bg-card p-4">
        <p className="mb-3 font-display text-[13px] font-bold">Archivos</p>
        <div className="rounded-[10px] border border-dashed border-line py-6 text-center">
          <FolderOpen size={20} strokeWidth={1.8} className="mx-auto mb-2 text-ink-3" />
          <p className="text-[12.5px] text-ink-3">Drive no configurado</p>
          <p className="mt-0.5 text-[11.5px] text-ink-3/70">
            Agregá <code>DRIVE_SHARED_ID</code> al .env.local
          </p>
        </div>
      </div>
    );
  }

  const subfolders = items.filter((f) => f.mimeType === MIME_FOLDER);
  const files      = items.filter((f) => f.mimeType !== MIME_FOLDER);
  const recientes  = [...files].sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)).slice(0, 4);

  return (
    <div className="rounded-card border border-line bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[13px] font-bold leading-none">Archivos</span>
        {!cargando && (
          <Link href="/archivos"
            className="flex items-center gap-1 text-[12px] text-ink-3 transition-colors hover:text-ink">
            Ver todos <ArrowRight size={11} strokeWidth={2} />
          </Link>
        )}
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-4 text-[12.5px] text-ink-3">
          <Loader2 size={13} strokeWidth={2} className="animate-spin" /> Cargando desde Drive…
        </div>
      ) : (
        <>
          {/* Subcarpetas como chips */}
          {subfolders.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${recientes.length > 0 ? "mb-3" : ""}`}>
              {subfolders.slice(0, 8).map((f) => (
                <span key={f.id}
                  className="flex items-center gap-1 rounded-[8px] bg-lime-soft px-2.5 py-1.5">
                  <FolderOpen size={12} strokeWidth={1.8} className="shrink-0 text-ink" />
                  <span className="text-[11.5px] font-bold text-ink">{f.name}</span>
                </span>
              ))}
              {subfolders.length > 8 && (
                <span className="flex items-center rounded-[8px] bg-line-soft px-2.5 py-1.5 text-[11.5px] text-ink-3">
                  +{subfolders.length - 8} más
                </span>
              )}
            </div>
          )}

          {/* Archivos recientes */}
          {recientes.length > 0 ? (
            <ul className="flex flex-col">
              {recientes.map((f, i) => {
                const { I, bg } = mimeIcon(f.mimeType);
                return (
                  <li key={f.id}
                    className={`flex items-center gap-2.5 py-2 ${i > 0 ? "border-t border-line-soft" : ""}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${bg}`}>
                      <I size={13} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{f.name}</span>
                      <span className="text-[11px] text-ink-3">{fmtFecha(f.modifiedTime)}</span>
                    </span>
                    {f.webViewLink && (
                      <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-ink-3 transition-colors hover:text-ink">
                        <ExternalLink size={12} strokeWidth={2} />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : subfolders.length === 0 ? (
            <p className="py-3 text-center text-[12.5px] text-ink-3">Sin archivos todavía</p>
          ) : null}
        </>
      )}

      {/* ── Reportes ───────────────────────────────────────────────────────── */}
      <div className="mt-4 border-t border-line-soft pt-4">
        <p className="mb-2.5 font-display text-[12px] uppercase tracking-[0.09em] text-ink-3">Reporte mensual</p>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-paper px-3 py-2.5">
          {reporteMes?.entregado
            ? <CheckCircle2 size={15} strokeWidth={2} className="shrink-0 text-ok" />
            : <Clock        size={15} strokeWidth={2} className="shrink-0 text-warn" />}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">{mesLabel(mes)}</p>
            <p className="text-[11.5px] text-ink-3">
              {reporteMes?.entregado
                ? `Entregado${reporteMes.entregado_en ? ` el ${new Date(reporteMes.entregado_en).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}` : ""}`
                : "Pendiente"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {reporteMes?.archivo_url && (
              <a href={reporteMes.archivo_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 rounded-[7px] border border-line px-2 py-1 text-[11.5px] font-bold transition-colors hover:border-ink hover:bg-lime">
                <ExternalLink size={11} strokeWidth={2} /> PDF
              </a>
            )}
            {esTheo && !reporteMes?.entregado && (
              <>
                <button type="button" onClick={marcarEntregado}
                  className="rounded-[7px] border border-line px-2 py-1 text-[11.5px] font-bold transition-colors hover:border-ok hover:bg-ok-bg hover:text-ok">
                  Marcar entregado
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo}
                  className="flex items-center gap-1 rounded-[7px] bg-lime px-2 py-1 text-[11.5px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50">
                  <Upload size={11} strokeWidth={2} />
                  {subiendo ? "Subiendo…" : "PDF"}
                </button>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirPDF(f); e.target.value = ""; }} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
