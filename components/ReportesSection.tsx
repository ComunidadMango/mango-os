"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Clock, Upload, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useSession } from "next-auth/react";

type Reporte = {
  id: string;
  cliente_id: string;
  mes: string;
  entregado: boolean;
  archivo_url: string | null;
  entregado_en: string | null;
};

function mesLabel(mes: string): string {
  const [anio, m] = mes.split("-");
  const nombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${nombres[parseInt(m) - 1]} ${anio}`;
}

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function ReportesSection({ clienteId }: { clienteId: string }) {
  const { data: session } = useSession();
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [expandido, setExpandido] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const esTheo = session?.user?.email?.startsWith("theo@");

  useEffect(() => {
    fetch(`/api/db/reportes?cliente_id=${clienteId}`)
      .then(r => r.json())
      .then(setReportes)
      .catch(() => {});
  }, [clienteId]);

  const mes = mesActual();
  const reporteMes = reportes.find(r => r.mes === mes);

  async function marcarEntregado() {
    const res = await fetch("/api/db/reportes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: clienteId, mes, entregado: true }),
    });
    if (res.ok) {
      const nuevo = await res.json() as Reporte;
      setReportes(prev => {
        const idx = prev.findIndex(r => r.mes === mes);
        return idx >= 0 ? prev.map((r, i) => i === idx ? nuevo : r) : [nuevo, ...prev];
      });
    }
  }

  async function subirArchivo(file: File) {
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clienteId", clienteId);
      formData.append("mes", mes);

      // Subir a Supabase Storage via API
      const uploadRes = await fetch("/api/db/reportes/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) return;
      const { url } = await uploadRes.json() as { url: string };

      // Guardar en DB
      const res = await fetch("/api/db/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, mes, entregado: true, archivo_url: url }),
      });
      if (res.ok) {
        const nuevo = await res.json() as Reporte;
        setReportes(prev => {
          const idx = prev.findIndex(r => r.mes === mes);
          return idx >= 0 ? prev.map((r, i) => i === idx ? nuevo : r) : [nuevo, ...prev];
        });
      }
    } finally {
      setSubiendo(false);
    }
  }

  const historial = reportes.filter(r => r.mes !== mes).slice(0, 6);

  return (
    <div className="rounded-card border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[13px] font-bold leading-none">Reportes</span>
        {historial.length > 0 && (
          <button type="button" onClick={() => setExpandido(e => !e)}
            className="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink transition-colors">
            Historial {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* Mes actual */}
      <div className="flex items-center gap-3 rounded-[10px] border border-line bg-paper p-3">
        {reporteMes?.entregado ? (
          <CheckCircle2 size={18} strokeWidth={2} className="shrink-0 text-ok" />
        ) : (
          <Clock size={18} strokeWidth={2} className="shrink-0 text-warn" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold">{mesLabel(mes)}</p>
          <p className="text-[12px] text-ink-3">
            {reporteMes?.entregado
              ? `Entregado${reporteMes.entregado_en ? ` el ${new Date(reporteMes.entregado_en).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}` : ""}`
              : "Pendiente"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reporteMes?.archivo_url && (
            <a href={reporteMes.archivo_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 rounded-[8px] border border-line px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:border-ink hover:bg-lime">
              <ExternalLink size={12} strokeWidth={2} /> Ver PDF
            </a>
          )}
          {esTheo && !reporteMes?.entregado && (
            <>
              <button type="button" onClick={marcarEntregado}
                className="rounded-[8px] border border-line px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:border-ok hover:bg-ok-bg hover:text-ok">
                Marcar entregado
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo}
                className="flex items-center gap-1 rounded-[8px] bg-lime px-2.5 py-1.5 text-[12px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50">
                <Upload size={12} strokeWidth={2} />
                {subiendo ? "Subiendo…" : "Adjuntar PDF"}
              </button>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f); e.target.value = ""; }} />
            </>
          )}
        </div>
      </div>

      {/* Historial */}
      {expandido && historial.length > 0 && (
        <ul className="mt-3 flex flex-col">
          {historial.map((r, i) => (
            <li key={r.id}
              className={`flex items-center gap-3 py-2 ${i > 0 ? "border-t border-line-soft" : ""}`}>
              {r.entregado
                ? <CheckCircle2 size={14} strokeWidth={2} className="shrink-0 text-ok" />
                : <Clock size={14} strokeWidth={2} className="shrink-0 text-warn" />}
              <span className="flex-1 text-[13px] text-ink-2">{mesLabel(r.mes)}</span>
              {r.archivo_url && (
                <a href={r.archivo_url} target="_blank" rel="noreferrer"
                  className="text-[12px] text-ink-3 hover:text-ink transition-colors flex items-center gap-1">
                  <ExternalLink size={11} /> PDF
                </a>
              )}
              <span className={`text-[11px] font-bold ${r.entregado ? "text-ok" : "text-warn"}`}>
                {r.entregado ? "Entregado" : "Pendiente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
