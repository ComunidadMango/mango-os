"use client";

import { useState, useEffect } from "react";
import {
  Clock, AlertTriangle, Loader2, ExternalLink,
  TrendingUp, X, Phone, Mail, AtSign, Calendar,
} from "lucide-react";
import {
  ETAPAS_HAY_FIT, CAMPO_LABELS,
  type GhlOpportunity, type GhlContactDetail,
} from "@/lib/ghl";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const ETAPA_CFG: Record<string, { punto: string; textColor: string; bg: string }> = {
  "ed3b2dd2-5e85-482d-bbcb-6d621731a059": { punto: "bg-ink-3",  textColor: "text-ink-3",  bg: "bg-line-soft"  },
  "3a9af6a3-7e6e-4dd6-a05e-a66183d221c6": { punto: "bg-warn",   textColor: "text-warn",   bg: "bg-warn-bg"    },
  "b1e3e827-ab6c-4e66-bfb2-90c9b1f906b4": { punto: "bg-warn",   textColor: "text-warn",   bg: "bg-warn-bg"    },
  "37610453-0b3c-4165-845b-ca2c87a2830e": { punto: "bg-ok",     textColor: "text-ok",     bg: "bg-ok-bg"      },
  "82472467-6019-41f0-b6a8-23b78b269a02": { punto: "bg-ok",     textColor: "text-ok",     bg: "bg-ok-bg"      },
  "633ce5f4-d53a-4845-95cb-55b5c4e0dace": { punto: "bg-crit",   textColor: "text-crit",   bg: "bg-crit-bg"    },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function diffDias(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
function diasTexto(d: number) {
  if (d === 0) return "hoy"; if (d === 1) return "ayer"; return `hace ${d}d`;
}
function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nombreCorto(n: string) {
  const p = n.trim().split(" ");
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0];
}
function limpiar(s?: string) { return (s ?? "").replace(/^\s+/, "").trim(); }

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function etapaNombre(stageId: string) {
  return ETAPAS_HAY_FIT.find(e => e.id === stageId)?.nombre ?? stageId;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const [oportunidades, setOportunidades] = useState<GhlOpportunity[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [sinKey,    setSinKey]    = useState(false);
  const [selected,  setSelected]  = useState<GhlOpportunity | null>(null);

  useEffect(() => {
    fetch("/api/pipeline?status=all")
      .then(r => r.json())
      .then(d => {
        if (d.sinKey) { setSinKey(true); return; }
        if (d.error)  { setError(d.error); return; }
        setOportunidades(d.opportunities ?? []);
      })
      .catch(e => setError(String(e)))
      .finally(() => setCargando(false));
  }, []);

  const mes         = mesActual();
  const esteMes     = oportunidades.filter(o => o.createdAt.startsWith(mes));
  const ganados     = oportunidades.filter(o => o.pipelineStageId === "82472467-6019-41f0-b6a8-23b78b269a02");
  const gañadosMes  = esteMes.filter(o => o.pipelineStageId === "82472467-6019-41f0-b6a8-23b78b269a02");
  const enPropuesta = oportunidades.filter(o => o.pipelineStageId === "37610453-0b3c-4165-845b-ca2c87a2830e");
  const tasa        = esteMes.length > 0 ? Math.round((gañadosMes.length / esteMes.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1180px]">

      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] leading-none">Pipeline</h1>
        {!cargando && !sinKey && (
          <span className="text-[12px] text-ink-3">{oportunidades.length} leads</span>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-3">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          GoHighLevel
        </div>
      </header>

      {/* Setup banner */}
      {sinKey && (
        <div className="mb-6 flex items-start gap-3 rounded-[12px] border border-warn/30 bg-warn-bg px-4 py-4">
          <AlertTriangle size={17} strokeWidth={2} className="mt-px shrink-0 text-warn" />
          <div>
            <p className="text-[13.5px] font-bold text-warn">GHL no conectado</p>
            <ol className="mt-1.5 list-decimal pl-4 text-[12.5px] text-warn/80 space-y-0.5">
              <li>GoHighLevel → Settings → Integrations → API Keys</li>
              <li>Crear una "Location API Key" para Mango</li>
              <li>Pegar en <code className="rounded bg-warn/10 px-1">.env.local</code> → <code className="rounded bg-warn/10 px-1">GHL_API_KEY=…</code></li>
              <li>Reiniciar el servidor</li>
            </ol>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-[10px] border border-crit/30 bg-crit-bg px-4 py-3 text-[13px] text-crit">{error}</div>
      )}

      {/* Stats */}
      {!sinKey && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard numero={oportunidades.length} label="Leads totales"      cargando={cargando} />
          <StatCard numero={esteMes.length}        label="Ingresaron este mes" cargando={cargando} />
          <StatCard numero={enPropuesta.length}    label="En propuesta"       cargando={cargando} />
          <StatCard numero={ganados.length}        label="Ganados"            cargando={cargando}
            extra={tasa > 0 ? `${tasa}% conversión este mes` : undefined} Icono={TrendingUp} />
        </div>
      )}

      {/* Kanban */}
      {cargando ? (
        <div className="flex items-center gap-2 py-12 text-[13px] text-ink-3">
          <Loader2 size={15} strokeWidth={2} className="animate-spin" /> Cargando leads de GHL…
        </div>
      ) : !sinKey && (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-[900px] gap-3">
            {ETAPAS_HAY_FIT.map(etapa => {
              const cfg   = ETAPA_CFG[etapa.id];
              const items = oportunidades.filter(o => o.pipelineStageId === etapa.id);
              return (
                <section key={etapa.id} className="flex min-w-0 flex-1 flex-col gap-2">
                  <header className="flex items-center gap-2 border-b-2 border-line pb-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.punto}`} />
                    <h2 className="font-display text-[11px] uppercase tracking-[0.08em] text-ink-3 leading-tight">
                      {etapa.nombre}
                    </h2>
                    <span className="ml-auto text-[12px] tabular-nums text-ink-3">{items.length}</span>
                  </header>
                  {items.length === 0
                    ? <div className="rounded-card border border-dashed border-line py-5 text-center text-[12px] text-ink-3">—</div>
                    : items.map(op => (
                        <LeadCard key={op.id} op={op} cfg={cfg} onClick={() => setSelected(op)} />
                      ))
                  }
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <LeadDrawer op={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ numero, label, extra, cargando, Icono }: {
  numero: number; label: string; extra?: string; cargando?: boolean;
  Icono?: React.ElementType;
}) {
  return (
    <div className="rounded-card border border-line bg-card px-4 py-3.5">
      {cargando
        ? <div className="h-8 w-12 animate-pulse rounded bg-line-soft" />
        : <p className="flex items-center gap-2 font-display text-[32px] leading-none tabular-nums">
            {numero}
            {Icono && <Icono size={18} strokeWidth={2} className="text-ok" />}
          </p>
      }
      <p className="mt-1.5 text-[12.5px] text-ink-2">{label}</p>
      {extra && <p className="mt-0.5 text-[11.5px] text-ink-3">{extra}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAD CARD (kanban)
// ─────────────────────────────────────────────────────────────────────────────

function LeadCard({ op, cfg, onClick }: {
  op: GhlOpportunity;
  cfg: { punto: string; textColor: string; bg: string };
  onClick: () => void;
}) {
  const dias         = diffDias(op.createdAt);
  const diasCambio   = diffDias(op.lastStageChangeAt);
  const sinMovimiento = diasCambio > 3
    && op.pipelineStageId !== "82472467-6019-41f0-b6a8-23b78b269a02"
    && op.pipelineStageId !== "633ce5f4-d53a-4845-95cb-55b5c4e0dace";
  const nombre  = op.contact?.name ? nombreCorto(op.contact.name) : op.name;
  const empresa = op.contact?.companyName ? limpiar(op.contact.companyName) : null;

  return (
    <button type="button" onClick={onClick} className="group w-full overflow-hidden rounded-card border border-line bg-card text-left transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm">
      {sinMovimiento && (
        <div className="flex items-center gap-1.5 bg-warn-bg px-3 py-1.5 text-[10.5px] font-bold text-warn">
          <Clock size={10} strokeWidth={2.2} />
          Sin movimiento · {diasTexto(diasCambio)}
        </div>
      )}
      <div className="p-3">
        <p className="text-[13.5px] font-bold leading-snug">{nombre}</p>
        {empresa && <p className="mt-0.5 text-[11.5px] text-ink-3">{empresa}</p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {op.source && (
            <span className="rounded-chip bg-lime-soft px-1.5 py-px text-[10.5px] font-bold text-ink">
              {op.source}
            </span>
          )}
          <span className="rounded-chip bg-line-soft px-1.5 py-px text-[10.5px] text-ink-3">
            {diasTexto(dias)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAD DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function LeadDrawer({ op, onClose }: { op: GhlOpportunity; onClose: () => void }) {
  const [contacto,  setContacto]  = useState<GhlContactDetail | null>(null);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!op.contact?.id) { setCargando(false); return; }
    fetch(`/api/pipeline/contact?id=${op.contact.id}`)
      .then(r => r.json())
      .then(d => { if (d.contact) setContacto(d.contact); else setError(d.error); })
      .catch(e => setError(String(e)))
      .finally(() => setCargando(false));
  }, [op.contact?.id]);

  const etapaCfg  = ETAPA_CFG[op.pipelineStageId];
  const nombreCompleto = contacto
    ? `${contacto.firstName ?? ""} ${contacto.lastName ?? ""}`.trim()
    : op.contact?.name ?? op.name;
  const empresa   = limpiar(contacto?.companyName ?? op.contact?.companyName);
  const ghlUrl    = op.contact?.id
    ? `https://app.gohighlevel.com/contacts/detail/${op.contact.id}`
    : null;

  // Respuestas del formulario
  const respuestas = (contacto?.customFields ?? [])
    .filter(cf => CAMPO_LABELS[cf.id] && cf.value.trim())
    .map(cf => ({ label: CAMPO_LABELS[cf.id], value: cf.value.trim() }));

  // Clasificación (Hay fit / No hay fit)
  const clasificacion = contacto?.customFields.find(cf => cf.id === "guJSiF82RPAK5Y3CswXr")?.value.trim();

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-line bg-paper shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-display text-[18px] leading-tight">{nombreCompleto}</p>
            {empresa && <p className="mt-0.5 text-[12.5px] text-ink-3">{empresa}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {ghlUrl && (
              <a href={ghlUrl} target="_blank" rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
                title="Ver en GHL">
                <ExternalLink size={14} strokeWidth={2} />
              </a>
            )}
            <button type="button" onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Etapa + clasificación */}
          <div className="flex flex-wrap gap-2">
            <span className={`flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[12px] font-bold ${etapaCfg?.bg ?? "bg-line-soft"} ${etapaCfg?.textColor ?? "text-ink-2"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${etapaCfg?.punto ?? "bg-ink-3"}`} />
              {etapaNombre(op.pipelineStageId)}
            </span>
            {clasificacion && (
              <span className={`rounded-chip px-2.5 py-1 text-[12px] font-bold ${clasificacion === "Hay fit" ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>
                {clasificacion}
              </span>
            )}
          </div>

          {/* Cargando */}
          {cargando && (
            <div className="flex items-center gap-2 text-[13px] text-ink-3">
              <Loader2 size={14} strokeWidth={2} className="animate-spin" /> Cargando datos…
            </div>
          )}

          {error && (
            <p className="text-[12.5px] text-crit">{error}</p>
          )}

          {!cargando && contacto && (
            <>
              {/* Info de contacto */}
              <section>
                <h3 className="mb-2.5 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                  Contacto
                </h3>
                <div className="space-y-2">
                  {contacto.email && (
                    <a href={`mailto:${contacto.email}`}
                      className="flex items-center gap-2.5 text-[13px] text-ink-2 hover:text-ink">
                      <Mail size={13} strokeWidth={2} className="shrink-0 text-ink-3" />
                      {contacto.email}
                    </a>
                  )}
                  {contacto.phone && (
                    <a href={`tel:${contacto.phone}`}
                      className="flex items-center gap-2.5 text-[13px] text-ink-2 hover:text-ink">
                      <Phone size={13} strokeWidth={2} className="shrink-0 text-ink-3" />
                      {contacto.phone}
                    </a>
                  )}
                  {/* Instagram desde custom field */}
                  {(() => {
                    const ig = contacto.customFields.find(cf => cf.id === "pVzhD7yoAKXgZ3ZFhgbW")?.value.trim();
                    return ig ? (
                      <div className="flex items-center gap-2.5 text-[13px] text-ink-2">
                        <AtSign size={13} strokeWidth={2} className="shrink-0 text-ink-3" />
                        {ig}
                      </div>
                    ) : null;
                  })()}
                  <div className="flex items-center gap-2.5 text-[13px] text-ink-3">
                    <Calendar size={13} strokeWidth={2} className="shrink-0" />
                    Ingresó el {fmtFecha(op.createdAt)}
                  </div>
                  {contacto.attributionSource?.sessionSource && (
                    <div className="flex items-center gap-2.5 text-[13px] text-ink-3">
                      <span className="h-[13px] w-[13px] shrink-0 rounded-[3px] bg-lime-soft text-center text-[8px] leading-[13px] font-bold text-ink">
                        {contacto.attributionSource.sessionSource[0]}
                      </span>
                      {contacto.attributionSource.sessionSource}
                      {contacto.attributionSource.adName && (
                        <span className="truncate text-ink-3/70">· {contacto.attributionSource.adName}</span>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Respuestas del formulario */}
              {respuestas.filter(r => r.label !== "Resultado diagnóstico" && r.label !== "Instagram / Redes").length > 0 && (
                <section>
                  <h3 className="mb-2.5 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                    Formulario de diagnóstico
                  </h3>
                  <div className="space-y-2.5">
                    {respuestas
                      .filter(r => r.label !== "Resultado diagnóstico" && r.label !== "Instagram / Redes")
                      .map(r => (
                        <div key={r.label} className="rounded-[10px] border border-line bg-card px-3.5 py-3">
                          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-3">
                            {r.label}
                          </p>
                          <p className="text-[13.5px] text-ink">{r.value}</p>
                        </div>
                      ))
                    }
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
