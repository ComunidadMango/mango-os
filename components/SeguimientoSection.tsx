"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  X,
  MessageSquare,
  Mail,
  Phone,
  Users2,
  CircleSlash,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import {
  canalTexto,
  persona,
  type Canal,
  type Contacto,
  type Tono,
} from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

export function claveSegLS(clienteId: string) { return `mango-seg-${clienteId}`; }

export function leerSegLS(clienteId: string): Contacto[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(claveSegLS(clienteId)) ?? "[]"); }
  catch { return []; }
}

function guardarSegLS(clienteId: string, entradas: Contacto[]) {
  localStorage.setItem(claveSegLS(clienteId), JSON.stringify(entradas));
}

export function contactadoHoy(clienteId: string): boolean {
  const hoy = new Date().toISOString().slice(0, 10);
  return leerSegLS(clienteId).some(c => c.fecha === hoy && c.canal !== "sin_contacto");
}

// ─────────────────────────────────────────────────────────────────────────────

const CANALES: { id: Exclude<Canal, "sin_contacto">; label: string; Icono: LucideIcon }[] = [
  { id: "whatsapp", label: "WhatsApp", Icono: MessageSquare },
  { id: "mail",     label: "Mail",     Icono: Mail },
  { id: "llamada",  label: "Llamada",  Icono: Phone },
  { id: "reunion",  label: "Reunión",  Icono: Users2 },
];

const TONOS: { id: Tono; label: string; activo: string; inactivo: string }[] = [
  { id: "bien",   label: "Bien",   activo: "bg-ok text-paper",       inactivo: "border border-line bg-card text-ink-3 hover:border-ok/50 hover:text-ok" },
  { id: "neutro", label: "Neutro", activo: "bg-ink text-paper",      inactivo: "border border-line bg-card text-ink-3 hover:border-ink-3/50 hover:text-ink" },
  { id: "tenso",  label: "Tenso",  activo: "bg-crit text-paper",     inactivo: "border border-line bg-card text-ink-3 hover:border-crit/50 hover:text-crit" },
];

const CANAL_ICONO: Record<Canal, LucideIcon> = {
  whatsapp:    MessageSquare,
  mail:        Mail,
  llamada:     Phone,
  reunion:     Users2,
  sin_contacto: CircleSlash,
};

const TONO_CLASE: Record<Tono, string> = {
  bien:   "bg-ok-bg text-ok",
  neutro: "bg-line-soft text-ink-2",
  tenso:  "bg-crit-bg text-crit",
};

const TONO_TEXTO: Record<Tono, string> = {
  bien: "Bien", neutro: "Neutro", tenso: "Tenso",
};

function fmtFecha(iso: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  if (iso === hoy) return "hoy";
  const [, m, d] = iso.split("-").map(Number);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[m - 1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────

type Paso = "inicio" | "form";

export default function SeguimientoSection({
  contactos,
  clienteId,
}: {
  contactos: Contacto[];
  clienteId: string;
}) {
  const usuarioActual = useUsuarioActual();

  const [entradas, setEntradas] = useState<Contacto[]>(contactos);
  const [expandido, setExpandido] = useState(false);

  // Cargar desde Supabase al montar; si falla, usar localStorage como fallback
  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      try {
        const res = await fetch(`/api/db/seguimiento/${clienteId}`);
        if (!res.ok) throw new Error("fetch failed");
        const rows = await res.json() as Array<{
          id: string; cliente_id: string; fecha: string;
          quien: string | null; canal: string; tono: string; resumen: string;
        }>;
        if (cancelled) return;
        const fromDb: Contacto[] = rows.map(r => ({
          id:        r.id,
          clienteId: r.cliente_id,
          fecha:     r.fecha,
          quien:     r.quien,
          canal:     r.canal as Canal,
          tono:      r.tono as Tono,
          resumen:   r.resumen,
        }));
        // Fusionar: Supabase + localStorage (para entradas offline recientes)
        const locales = leerSegLS(clienteId);
        const dbIds = new Set(fromDb.map(e => e.id));
        const soloLocales = locales.filter(e => !dbIds.has(e.id));
        const merged = [...fromDb, ...soloLocales].sort((a, b) => b.fecha.localeCompare(a.fecha));
        setEntradas(merged);
      } catch {
        // Fallback: localStorage
        const guardados = leerSegLS(clienteId);
        if (guardados.length === 0 || cancelled) return;
        const ids = new Set(guardados.map(c => c.id));
        const merged = [...guardados, ...contactos.filter(c => !ids.has(c.id))];
        merged.sort((a, b) => b.fecha.localeCompare(a.fecha));
        setEntradas(merged);
      }
    }
    cargar();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>("inicio");
  const [canal, setCanal] = useState<Exclude<Canal, "sin_contacto">>("whatsapp");
  const [tono, setTono] = useState<Tono>("bien");
  const [resumen, setResumen] = useState("");

  function abrir() {
    setPaso("inicio");
    setCanal("whatsapp");
    setTono("bien");
    setResumen("");
    setAbierto(true);
  }

  function cerrar() { setAbierto(false); }

  function guardarSinContacto() {
    agregar("sin_contacto", "neutro", "Sin contacto hoy.");
  }

  function guardarContacto() {
    const txt = resumen.trim();
    if (!txt) return;
    agregar(canal, tono, txt);
  }

  async function agregar(c: Canal, t: Tono, r: string) {
    const fecha = new Date().toISOString().slice(0, 10);
    // Guardar en localStorage optimísticamente
    const nueva: Contacto = {
      id: `local-${Date.now()}`,
      clienteId,
      fecha,
      quien: usuarioActual.id,
      canal: c,
      tono: t,
      resumen: r,
    };
    setEntradas(prev => {
      const next = [nueva, ...prev];
      const locales = next.filter(e => e.id.startsWith("local-"));
      guardarSegLS(clienteId, locales);
      return next;
    });
    cerrar();

    // Persistir en Supabase
    try {
      const res = await fetch("/api/db/seguimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          fecha,
          quien: usuarioActual.id,
          canal: c,
          tono: t,
          resumen: r,
        }),
      });
      if (res.ok) {
        const saved = await res.json() as { id: string };
        // Reemplazar la entrada local con el id real de Supabase
        setEntradas(prev =>
          prev.map(e => e.id === nueva.id ? { ...e, id: saved.id } : e)
        );
        // Limpiar localStorage (el dato ya está en Supabase)
        guardarSegLS(clienteId, leerSegLS(clienteId).filter(e => e.id !== nueva.id));
      }
    } catch {
      // Se quedó en localStorage; se sincronizará en la próxima carga
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const hayContactoHoy = entradas.some(e => e.fecha === hoy && e.canal !== "sin_contacto");

  return (
    <>
      {/* ── Card de seguimiento ─────────────────────────────────────── */}
      <div className="rounded-card border border-line bg-card p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-[13px] font-bold leading-none">
            Seguimiento diario
          </span>
          <div className="flex items-center gap-2">
            {hayContactoHoy && (
              <span className="flex items-center gap-1 text-[11.5px] font-bold text-ok">
                <CheckCircle2 size={12} strokeWidth={2.5} /> Contactado hoy
              </span>
            )}
            <span className="text-[12px] text-ink-3">{entradas.length} registros</span>
          </div>
        </div>

        {/* Botón registrar */}
        <button
          type="button"
          onClick={abrir}
          className="mb-3 flex w-full items-center gap-2 rounded-soft border border-dashed border-line px-3.5 py-2.5 text-[13px] text-ink-3 transition-colors hover:border-ink-3/50 hover:bg-paper hover:text-ink"
        >
          <Plus size={15} strokeWidth={2.2} />
          Registrar el contacto de hoy
        </button>

        {/* Lista */}
        {entradas.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-3">Sin registros todavía</p>
        ) : (
          <ul className="flex flex-col">
            {(expandido ? entradas : entradas.slice(0, 5)).map((s, i) => {
              const Icono = CANAL_ICONO[s.canal];
              const quien = s.quien ? persona(s.quien) : null;
              return (
                <li
                  key={s.id}
                  className={`flex gap-3 py-3 ${i > 0 ? "border-t border-line-soft" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${TONO_CLASE[s.tono]}`}
                  >
                    <Icono size={15} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
                      <span className="font-bold text-ink">
                        {quien ? quien.nombre : "Nadie"}
                      </span>
                      <span>· {canalTexto[s.canal]}</span>
                      <span>· {fmtFecha(s.fecha)}</span>
                      <span
                        className={`rounded-chip px-1.5 py-px text-[10.5px] font-bold ${TONO_CLASE[s.tono]}`}
                      >
                        {TONO_TEXTO[s.tono]}
                      </span>
                    </p>
                    <p className="mt-1 text-[13.5px] leading-snug">{s.resumen}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {entradas.length > 5 && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="mt-2 w-full text-center text-[12.5px] text-ink-3 transition-colors hover:text-ink"
          >
            {expandido
              ? "Ocultar semanas anteriores"
              : `Ver ${entradas.length - 5} registros anteriores`}
          </button>
        )}
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────── */}
      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]"
            onClick={cerrar}
          />

          <aside className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col bg-paper shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-center border-b border-line px-5 py-4">
              <h2 className="font-display text-[19px] leading-none">
                {paso === "inicio" ? "Registrar contacto" : "Detalle del contacto"}
              </h2>
              <button
                type="button"
                onClick={cerrar}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              {paso === "inicio" ? (
                /* ── Paso 1: ¿Hablaron? ──────────────────────────── */
                <div className="flex flex-col gap-3">
                  <p className="text-[13.5px] text-ink-3">¿Hablaron hoy con el cliente?</p>

                  <button
                    type="button"
                    onClick={() => setPaso("form")}
                    className="flex w-full flex-col items-start gap-1 rounded-card border border-line bg-card p-4 text-left transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm"
                  >
                    <span className="text-[14px] font-bold text-ink">Sí, hablamos</span>
                    <span className="text-[12.5px] text-ink-3">
                      Completá canal, tono y un resumen breve.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={guardarSinContacto}
                    className="flex w-full flex-col items-start gap-1 rounded-card border border-line bg-card p-4 text-left transition-all hover:-translate-y-px hover:border-ink-3/40 hover:shadow-sm"
                  >
                    <span className="text-[14px] font-bold text-ink">No hubo contacto</span>
                    <span className="text-[12.5px] text-ink-3">
                      Quedará registrado que hoy no se habló.
                    </span>
                  </button>
                </div>
              ) : (
                /* ── Paso 2: Detalle ─────────────────────────────── */
                <div className="flex flex-col gap-6">
                  {/* Canal */}
                  <div>
                    <p className="mb-2 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                      Canal
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {CANALES.map(({ id, label, Icono }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCanal(id)}
                          className={[
                            "flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-[13px] transition-all",
                            canal === id
                              ? "border-ink bg-ink text-paper"
                              : "border-line bg-card text-ink-2 hover:border-ink-3/50",
                          ].join(" ")}
                        >
                          <Icono size={15} strokeWidth={2} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tono */}
                  <div>
                    <p className="mb-2 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                      Tono
                    </p>
                    <div className="flex gap-2">
                      {TONOS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTono(t.id)}
                          className={[
                            "flex-1 rounded-chip py-2 text-[13px] font-medium transition-all",
                            tono === t.id ? t.activo : t.inactivo,
                          ].join(" ")}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resumen */}
                  <div>
                    <p className="mb-2 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                      Resumen
                    </p>
                    <textarea
                      autoFocus
                      value={resumen}
                      onChange={(e) => setResumen(e.target.value)}
                      placeholder="¿De qué hablaron?"
                      rows={4}
                      className="w-full resize-none rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer — solo en paso form */}
            {paso === "form" && (
              <div className="shrink-0 border-t border-line px-5 py-4">
                <button
                  type="button"
                  onClick={guardarContacto}
                  disabled={!resumen.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-lime px-4 py-2.5 text-[14px] font-bold text-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Guardar registro →
                </button>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
