"use client";

import { useState } from "react";
import { Plus, X, ChevronDown, Clock, Users2, type LucideIcon } from "lucide-react";
import { equipo, persona, type Reunion, type TipoReunion } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────

const TIPO_CFG: Record<TipoReunion, { label: string; bg: string; text: string }> = {
  kickoff:      { label: "Kickoff",     bg: "bg-lime-soft",   text: "text-ink"    },
  mensual:      { label: "Mensual",     bg: "bg-ok-bg",       text: "text-ok"     },
  estrategia:   { label: "Estrategia",  bg: "bg-warn-bg",     text: "text-warn"   },
  seguimiento:  { label: "Seguimiento", bg: "bg-line-soft",   text: "text-ink-2"  },
  otro:         { label: "Otro",        bg: "bg-line-soft",   text: "text-ink-3"  },
};

const TIPOS: TipoReunion[] = ["kickoff", "mensual", "estrategia", "seguimiento", "otro"];

function fmtFecha(iso: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  if (iso === hoy) return "hoy";
  const [, m, d] = iso.split("-").map(Number);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[m - 1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ReunionesSection({
  reuniones,
  clienteId,
}: {
  reuniones: Reunion[];
  clienteId: string;
}) {
  const usuario = useUsuarioActual();
  const [entradas, setEntradas] = useState<Reunion[]>(reuniones);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  // Form state
  const [fecha,          setFecha]          = useState(() => new Date().toISOString().slice(0, 10));
  const [titulo,         setTitulo]         = useState("");
  const [tipo,           setTipo]           = useState<TipoReunion>("mensual");
  const [asistentes,     setAsistentes]     = useState<string[]>([usuario.id]);
  const [duracion,       setDuracion]       = useState("");
  const [notas,          setNotas]          = useState("");
  const [transcripcion,  setTranscripcion]  = useState("");

  function toggleAsistente(id: string) {
    setAsistentes(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  function abrir() {
    setFecha(new Date().toISOString().slice(0, 10));
    setTitulo(""); setTipo("mensual"); setAsistentes([usuario.id]);
    setDuracion(""); setNotas(""); setTranscripcion("");
    setDrawer(true);
  }

  function guardar() {
    if (!titulo.trim()) return;
    const nueva: Reunion = {
      id: `local-${Date.now()}`,
      clienteId,
      fecha,
      titulo: titulo.trim(),
      tipo,
      asistentes,
      duracion: duracion ? parseInt(duracion) : undefined,
      notas: notas.trim() || undefined,
      transcripcion: transcripcion.trim() || undefined,
    };
    setEntradas(prev => [nueva, ...prev].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setDrawer(false);
  }

  return (
    <>
      <div className="rounded-card border border-line bg-card p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-[13px] font-bold leading-none">Reuniones</span>
          <span className="text-[12px] text-ink-3">{entradas.length} registradas</span>
        </div>

        {/* Botón nueva */}
        <button type="button" onClick={abrir}
          className="mb-3 flex w-full items-center gap-2 rounded-soft border border-dashed border-line px-3.5 py-2.5 text-[13px] text-ink-3 transition-colors hover:border-ink-3/50 hover:bg-paper hover:text-ink">
          <Plus size={15} strokeWidth={2.2} />
          Registrar reunión
        </button>

        {/* Lista */}
        {entradas.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-3">Sin reuniones registradas</p>
        ) : (
          <ul className="flex flex-col">
            {entradas.map((r, i) => {
              const cfg = TIPO_CFG[r.tipo];
              const abierto = expandidoId === r.id;
              return (
                <li key={r.id} className={i > 0 ? "border-t border-line-soft" : ""}>
                  {/* Fila principal */}
                  <button type="button"
                    onClick={() => setExpandidoId(abierto ? null : r.id)}
                    className="flex w-full items-start gap-3 py-3 text-left">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${cfg.bg}`}>
                      <Users2 size={15} strokeWidth={2} className={cfg.text} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
                        <span className="font-bold text-ink">{r.titulo}</span>
                        <span className={`rounded-chip px-1.5 py-px text-[10.5px] font-bold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        <span>· {fmtFecha(r.fecha)}</span>
                        {r.duracion && (
                          <span className="flex items-center gap-1">
                            <Clock size={10} strokeWidth={2} />
                            {r.duracion} min
                          </span>
                        )}
                      </p>
                      {/* Asistentes */}
                      <p className="mt-0.5 text-[11.5px] text-ink-3">
                        {r.asistentes.map(id => persona(id)?.nombre).filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <ChevronDown size={14} strokeWidth={2}
                      className={`mt-1.5 shrink-0 text-ink-3 transition-transform ${abierto ? "rotate-180" : ""}`} />
                  </button>

                  {/* Expandido */}
                  {abierto && (
                    <div className="mb-3 ml-11 space-y-3">
                      {r.notas && (
                        <div>
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-3">
                            Notas / acción
                          </p>
                          <p className="text-[13px] leading-relaxed text-ink">{r.notas}</p>
                        </div>
                      )}
                      {r.transcripcion && (
                        <div>
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-3">
                            Transcripción
                          </p>
                          <pre className="max-h-60 overflow-y-auto rounded-[10px] border border-line bg-paper p-3 font-sans text-[12.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">
                            {r.transcripcion}
                          </pre>
                        </div>
                      )}
                      {!r.notas && !r.transcripcion && (
                        <p className="text-[12.5px] text-ink-3/60">Sin notas ni transcripción.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Drawer nueva reunión ─────────────────────────────────── */}
      {drawer && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]" onClick={() => setDrawer(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col bg-paper shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-center border-b border-line px-5 py-4">
              <h2 className="font-display text-[19px] leading-none">Registrar reunión</h2>
              <button type="button" onClick={() => setDrawer(false)}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 hover:bg-line-soft hover:text-ink">
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Título */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Título</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus
                  placeholder="Revisión mensual, kickoff, estrategia Q4…"
                  className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] outline-none focus:border-ink-3/50 placeholder:text-ink-3/50" />
              </div>

              {/* Fecha + Duración */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Fecha</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] outline-none focus:border-ink-3/50" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Duración (min)</label>
                  <input type="number" value={duracion} onChange={e => setDuracion(e.target.value)}
                    placeholder="45"
                    className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] outline-none focus:border-ink-3/50 placeholder:text-ink-3/50" />
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map(t => {
                    const c = TIPO_CFG[t];
                    return (
                      <button key={t} type="button" onClick={() => setTipo(t)}
                        className={["rounded-chip px-2.5 py-1.5 text-[12px] font-bold transition-colors border",
                          tipo === t ? "bg-ink text-paper border-ink" : `border-line ${c.bg} ${c.text}`,
                        ].join(" ")}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Asistentes */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">Asistentes</label>
                <div className="flex flex-wrap gap-2">
                  {equipo.map(p => (
                    <button key={p.id} type="button" onClick={() => toggleAsistente(p.id)}
                      className={["flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 text-[12px] font-bold transition-colors border",
                        asistentes.includes(p.id) ? "bg-ink text-paper border-ink" : "border-line bg-card text-ink-3",
                      ].join(" ")}>
                      <span className={["flex h-4 w-4 items-center justify-center rounded-[4px] text-[9px] font-bold",
                        asistentes.includes(p.id) ? "bg-lime text-ink" : "bg-lime-soft text-ink",
                      ].join(" ")}>{p.inicial}</span>
                      {p.nombre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">
                  Notas / puntos de acción <span className="font-normal normal-case text-ink-3/60">(opcional)</span>
                </label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                  placeholder="Qué se acordó, próximos pasos…"
                  className="w-full resize-none rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] outline-none focus:border-ink-3/50 placeholder:text-ink-3/50" />
              </div>

              {/* Transcripción */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">
                  Transcripción <span className="font-normal normal-case text-ink-3/60">(opcional — pegá desde Zoom, Meet, etc.)</span>
                </label>
                <textarea value={transcripcion} onChange={e => setTranscripcion(e.target.value)} rows={6}
                  placeholder="Pegá la transcripción completa aquí…"
                  className="w-full resize-none rounded-[10px] border border-line bg-card px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed outline-none focus:border-ink-3/50 placeholder:font-sans placeholder:text-ink-3/50" />
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-line px-5 py-4">
              <button type="button" onClick={guardar} disabled={!titulo.trim()}
                className="flex w-full items-center justify-center rounded-[10px] bg-lime px-4 py-2.5 text-[14px] font-bold text-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40">
                Guardar reunión →
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
