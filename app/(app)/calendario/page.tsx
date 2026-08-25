"use client";

import { useState, useEffect, useRef, useMemo, startTransition } from "react";
import {
  ChevronLeft, ChevronRight, Plus, ExternalLink,
  Loader2, AlertTriangle, X, CalendarDays, Check,
  Sparkles, CheckCircle2, Circle, Trash2, Palette,
} from "lucide-react";
import { equipo } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type GcalEvent = {
  id: string; summary?: string; description?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  colorId?: string; htmlLink?: string;
  esEquipo?: boolean; personaId?: string; personaNombre?: string;
  // Orgánico:
  esOrganico?: boolean; organicoId?: string;
  clienteId?: string; clienteNombre?: string;
  tipoContenido?: string; redSocial?: string;
  completado?: boolean; recordatorio?: string;
  visibilidad?: string; personasIds?: string[]; creadoPor?: string;
};

type EventoOrganicoRow = {
  id: string; cliente_id: string; titulo: string;
  descripcion: string | null; fecha: string; hora: string | null;
  tipo: string; red_social: string; creado_por: string;
  visibilidad: "equipo" | "personas"; personas_ids: string[];
  completado: boolean; recordatorio: string; created_at: string;
  clientes: { nombre: string } | null;
};

type Tab   = "mio" | "todos";
type Vista = "mes" | "semana";
type Modo  = "cal" | "org";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const MESES        = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_CORTOS  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

const PALETA_EQUIPO = ["#7986CB","#33B679","#8E24AA","#E67C73","#F6BF26","#F4511E","#039BE5","#0B8043"];
function colorDePersona(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETA_EQUIPO[h % PALETA_EQUIPO.length];
}

// Paleta de fallback para clientes (cuando no tienen color personalizado)
const PALETA_CLIENTES = ["#FF6B6B","#FF9F43","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FC5C7D","#2BCBBA"];
function colorHashCliente(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETA_CLIENTES[h % PALETA_CLIENTES.length];
}

// Paleta completa para el selector de color de cliente
const PALETA_PICKER_CLIENTE = [
  "#EF4444","#F97316","#EAB308","#22C55E","#14B8A6",
  "#3B82F6","#8B5CF6","#EC4899","#F43F5E","#10B981",
  "#0EA5E9","#A855F7","#FB923C","#84CC16","#06B6D4","#6366F1",
];

const GCAL_COLORS: Record<string, string> = {
  "1":"#7986CB","2":"#33B679","3":"#8E24AA","4":"#E67C73",
  "5":"#F6BF26","6":"#F4511E","7":"#039BE5","8":"#616161",
  "9":"#3F51B5","10":"#0B8043","11":"#D50000",
};
const COLORES_PICKER = [
  {id:"11",nombre:"Tomate"},{id:"4",nombre:"Flamenco"},{id:"6",nombre:"Mandarina"},
  {id:"5",nombre:"Banana"},{id:"2",nombre:"Salvia"},{id:"10",nombre:"Albahaca"},
  {id:"7",nombre:"Pavo real"},{id:"9",nombre:"Arándano"},{id:"1",nombre:"Lavanda"},
  {id:"3",nombre:"Uva"},{id:"8",nombre:"Grafito"},
];

const TIPO_LABEL: Record<string, string> = {
  post:"Post", reel:"Reel", story:"Story", carrusel:"Carrusel", otro:"Otro",
};
const RED_LABEL: Record<string, string> = {
  instagram:"IG", tiktok:"TT", facebook:"FB", linkedin:"LI", otro:"Red",
};
const TIPOS_ORGANICO   = ["post","reel","story","carrusel","otro"] as const;
const REDES_ORGANICO   = ["instagram","tiktok","facebook","linkedin","otro"] as const;
const RECORDATORIOS    = [
  {v:"dia-del-evento", l:"El mismo día"},
  {v:"dia-anterior",   l:"Un día antes"},
  {v:"dos-dias-antes", l:"Dos días antes"},
  {v:"ninguno",        l:"Sin recordatorio"},
] as const;

const KEY_COLORES_CLIENTES = "mango-org-colores";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fechaHoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fechaStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function lunesDe(d: Date): Date {
  const r = new Date(d); r.setHours(0,0,0,0);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}
function rangoMes(base: Date): {timeMin:string;timeMax:string} {
  const y = base.getFullYear(), m = base.getMonth();
  const first  = new Date(y, m, 1);
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const start  = new Date(y, m, 1 - offset);
  const last   = new Date(y, m + 1, 0);
  const trailing = last.getDay() === 0 ? 0 : 7 - last.getDay();
  const end    = new Date(y, m + 1, trailing + 1);
  return {timeMin: start.toISOString(), timeMax: end.toISOString()};
}
function rangoSemana(lunes: Date): {timeMin:string;timeMax:string} {
  const end = new Date(lunes); end.setDate(end.getDate() + 7);
  return {timeMin: lunes.toISOString(), timeMax: end.toISOString()};
}
function eventFecha(e: GcalEvent): string {
  return (e.start.dateTime ?? e.start.date ?? "").slice(0, 10);
}
function eventHora(e: GcalEvent): string | null {
  if (!e.start.dateTime) return null;
  return new Date(e.start.dateTime).toLocaleTimeString("es-AR", {hour:"2-digit", minute:"2-digit"});
}
function isoLocal(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00`;
}
function organicoToGcal(ev: EventoOrganicoRow): GcalEvent {
  return {
    id: `organico-${ev.id}`, summary: ev.titulo, description: ev.descripcion ?? undefined,
    start: ev.hora ? {dateTime:`${ev.fecha}T${ev.hora}:00`} : {date: ev.fecha},
    end:   ev.hora ? {dateTime:`${ev.fecha}T${ev.hora}:00`} : {date: ev.fecha},
    esOrganico: true, organicoId: ev.id, clienteId: ev.cliente_id,
    clienteNombre: ev.clientes?.nombre ?? ev.cliente_id,
    tipoContenido: ev.tipo, redSocial: ev.red_social, completado: ev.completado,
    recordatorio: ev.recordatorio, visibilidad: ev.visibilidad,
    personasIds: ev.personas_ids, creadoPor: ev.creado_por,
  };
}
function loadColoresClientes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY_COLORES_CLIENTES) ?? "{}"); } catch { return {}; }
}
function saveColoresClientes(m: Record<string, string>) {
  localStorage.setItem(KEY_COLORES_CLIENTES, JSON.stringify(m));
}

// ─────────────────────────────────────────────────────────────────────────────
// API GCAL
// ─────────────────────────────────────────────────────────────────────────────

async function apiEventos(cal: Tab, timeMin: string, timeMax: string) {
  const res = await fetch(`/api/calendar/events?cal=${cal}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`);
  const data = await res.json();
  if (data.error === "no-configurado") return {events: [] as GcalEvent[], sinConfig: true};
  if (!res.ok) throw new Error(data.error ?? "Error al cargar eventos");
  return {events: (data.events ?? []) as GcalEvent[], sinConfig: false};
}
async function apiCrear(cal: Tab, payload: {summary:string;startDateTime:string;endDateTime:string;description?:string;colorId?:string}): Promise<GcalEvent> {
  const res = await fetch("/api/calendar/events", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({cal, ...payload}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function Calendario() {
  const HOY = fechaHoy();
  const personaId = useUsuarioActual().id;

  const tab = "mio" as const;
  const [modo,       setModo]       = useState<Modo>("cal");
  const [vista,      setVista]      = useState<Vista>("mes");
  const [mesBase,    setMesBase]    = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [semanaBase, setSemanaBase] = useState<Date>(() => lunesDe(new Date()));

  // GCal
  const [eventos,   setEventos]   = useState<GcalEvent[]>([]);
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [sinConfig, setSinConfig] = useState(false);

  // Orgánico
  const [organicos,       setOrganicos]       = useState<GcalEvent[]>([]);
  const [clientesFiltro,  setClientesFiltro]  = useState<Set<string>>(new Set());
  const [clienteColores,  setClienteColores]  = useState<Record<string, string>>({});
  const [pickerColorId,   setPickerColorId]   = useState<string | null>(null);

  // Modales
  const [modal,              setModal]              = useState(false);
  const [modalOrganico,      setModalOrganico]      = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<GcalEvent | null>(null);

  // Cargar colores de localStorage
  useEffect(() => { setClienteColores(loadColoresClientes()); }, []);

  // Cerrar color picker al hacer click fuera
  useEffect(() => {
    if (!pickerColorId) return;
    const fn = () => setPickerColorId(null);
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, [pickerColorId]);

  // Fetch GCal (solo en modo cal)
  useEffect(() => {
    if (modo !== "cal") return;
    let ignore = false;
    const {timeMin, timeMax} = vista === "mes" ? rangoMes(mesBase) : rangoSemana(semanaBase);
    startTransition(() => { setCargando(true); setError(null); setSinConfig(false); });
    apiEventos(tab, timeMin, timeMax)
      .then(({events, sinConfig: sc}) => { if (!ignore) { setEventos(events); setSinConfig(sc); } })
      .catch((e: Error) => { if (!ignore) setError(e.message); })
      .finally(() => { if (!ignore) setCargando(false); });
    return () => { ignore = true; };
  }, [tab, modo, vista, mesBase, semanaBase]);

  // Fetch orgánico
  useEffect(() => {
    let ignore = false;
    const {timeMin, timeMax} = vista === "mes" ? rangoMes(mesBase) : rangoSemana(semanaBase);
    fetch(`/api/db/eventos-organico?desde=${timeMin.slice(0,10)}&hasta=${timeMax.slice(0,10)}`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: EventoOrganicoRow[]) => { if (!ignore) setOrganicos(rows.map(organicoToGcal)); })
      .catch(() => {});
    return () => { ignore = true; };
  }, [vista, mesBase, semanaBase]);

  // Clientes únicos con eventos orgánicos
  const clientesUnicos = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of organicos) {
      if (e.clienteId && e.clienteNombre && !seen.has(e.clienteId))
        seen.set(e.clienteId, e.clienteNombre);
    }
    return Array.from(seen.entries()).map(([id, nombre]) => ({id, nombre}));
  }, [organicos]);

  // Orgánicos filtrados por cliente + visibilidad
  const organicosFiltrados = useMemo(() => {
    return organicos.filter(e => {
      if (clientesFiltro.size > 0 && !clientesFiltro.has(e.clienteId ?? "")) return false;
      if (e.visibilidad === "personas" && personaId !== e.creadoPor && !e.personasIds?.includes(personaId)) return false;
      return true;
    });
  }, [organicos, clientesFiltro, personaId]);

  function colorCliente(id: string): string {
    return clienteColores[id] ?? colorHashCliente(id);
  }

  function guardarColorCliente(id: string, color: string) {
    const next = {...clienteColores, [id]: color};
    setClienteColores(next);
    saveColoresClientes(next);
    setPickerColorId(null);
  }
  function borrarColorCliente(id: string) {
    const next = {...clienteColores};
    delete next[id];
    setClienteColores(next);
    saveColoresClientes(next);
    setPickerColorId(null);
  }

  // Mutaciones
  const agregarEvento      = (e: GcalEvent) => setEventos(prev => [e, ...prev]);
  const agregarOrganico    = (e: GcalEvent) => setOrganicos(prev => [e, ...prev]);
  const actualizarOrganico = (u: GcalEvent) => setOrganicos(prev => prev.map(e => e.id === u.id ? u : e));
  const eliminarOrganico   = (id: string)   => setOrganicos(prev => prev.filter(e => e.id !== id));

  // Eventos a mostrar según modo
  const eventosDe = (fecha: string) => {
    if (modo === "cal") {
      return eventos.filter(e => eventFecha(e) === fecha)
                    .sort((a,b) => (a.start.dateTime ?? "").localeCompare(b.start.dateTime ?? ""));
    }
    return organicosFiltrados.filter(e => eventFecha(e) === fecha)
                              .sort((a,b) => (a.start.dateTime ?? a.start.date ?? "").localeCompare(b.start.dateTime ?? b.start.date ?? ""));
  };

  // Navegación
  function prevMes()    { setMesBase(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMes()    { setMesBase(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }
  function prevSemana() { setSemanaBase(d => { const n = new Date(d); n.setDate(n.getDate()-7); return n; }); }
  function nextSemana() { setSemanaBase(d => { const n = new Date(d); n.setDate(n.getDate()+7); return n; }); }

  const tituloMes    = `${MESES[mesBase.getMonth()]} ${mesBase.getFullYear()}`;
  const diasSemana   = Array.from({length:7}, (_,i) => { const d = new Date(semanaBase); d.setDate(d.getDate()+i); return d; });
  const tituloSemana = (() => {
    const d0=diasSemana[0], d6=diasSemana[6];
    const m0=MESES[d0.getMonth()], m6=MESES[d6.getMonth()];
    return m0===m6 ? `${d0.getDate()} — ${d6.getDate()} de ${m0}` : `${d0.getDate()} de ${m0} — ${d6.getDate()} de ${m6}`;
  })();

  function toggleClienteFiltro(id: string) {
    setClientesFiltro(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-[1180px]">

      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] leading-none">Calendario</h1>

        {/* Modo: Calendario / Orgánico */}
        <div className="flex rounded-[10px] border border-line bg-card p-0.5">
          {([["cal","Calendario"],["org","Orgánico"]] as [Modo,string][]).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setModo(m)}
              className={["rounded-[8px] px-3 py-1.5 text-[13px] transition-colors",
                modo === m ? "bg-ink font-medium text-paper" : "text-ink-3 hover:bg-line-soft hover:text-ink",
              ].join(" ")}>
              {label}
            </button>
          ))}
        </div>

        {/* Vista mes/semana */}
        <div className="flex rounded-[10px] border border-line bg-card p-0.5">
          {(["mes","semana"] as Vista[]).map(v => (
            <button key={v} type="button" onClick={() => setVista(v)}
              className={["rounded-[8px] px-3 py-1.5 text-[13px] transition-colors",
                vista === v ? "bg-ink font-medium text-paper" : "text-ink-3 hover:bg-line-soft hover:text-ink",
              ].join(" ")}>
              {v === "mes" ? "Mes" : "Semana"}
            </button>
          ))}
        </div>

        {/* Botones contextuales */}
        <div className="ml-auto flex items-center gap-2">
          {modo === "org" && (
            <button type="button" onClick={() => setModalOrganico(true)}
              className="flex items-center gap-2 rounded-[10px] bg-lime px-3.5 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85">
              <Plus size={15} strokeWidth={2.4} />
              Nueva publicación
            </button>
          )}
          {modo === "cal" && (
            <button type="button" onClick={() => setModal(true)}
              className="flex items-center gap-2 rounded-[10px] bg-lime px-3.5 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85">
              <Plus size={15} strokeWidth={2.4} />
              Nuevo evento
            </button>
          )}
        </div>
      </header>

      {/* Aviso sin config (solo modo cal) */}
      {modo === "cal" && sinConfig && (
        <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-warn/30 bg-warn-bg px-4 py-3.5">
          <AlertTriangle size={17} strokeWidth={2} className="mt-px shrink-0 text-warn" />
          <div>
            <p className="text-[13.5px] font-bold text-warn">Calendario compartido no configurado</p>
            <ol className="mt-1 list-decimal pl-4 text-[12.5px] text-warn/80 space-y-0.5">
              <li>Creá un nuevo calendario en Google Calendar llamado <strong>Mango OS</strong></li>
              <li>Compartilo con todos los miembros del equipo</li>
              <li>Abrí configuración → ID del calendario (termina en <code className="rounded bg-warn/10 px-1">@group.calendar.google.com</code>)</li>
              <li>Pegalo en <code className="rounded bg-warn/10 px-1">.env.local</code> → <code className="rounded bg-warn/10 px-1">CALENDAR_MANGO_ID=…</code></li>
            </ol>
          </div>
        </div>
      )}

      {/* Error GCal */}
      {modo === "cal" && error && (
        <div className="mb-5 rounded-[10px] border border-crit/30 bg-crit-bg px-4 py-3 text-[13px] text-crit">
          {error}
        </div>
      )}

      {/* Calendario */}
      <div className="overflow-hidden rounded-card border border-line bg-card">

        {/* Nav fila */}
        <div className="border-b border-line">
          <div className="flex items-center justify-between px-5 py-3">
            <button type="button" onClick={vista === "mes" ? prevMes : prevSemana}
              className="flex h-8 w-8 items-center justify-center rounded-soft text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <span className="font-display text-[16px]">
              {vista === "mes" ? tituloMes : tituloSemana}
              {cargando && <Loader2 size={13} strokeWidth={2} className="ml-2 inline animate-spin text-ink-3" />}
            </span>
            <button type="button" onClick={vista === "mes" ? nextMes : nextSemana}
              className="flex h-8 w-8 items-center justify-center rounded-soft text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Filtros de clientes — solo modo orgánico */}
          {modo === "org" && clientesUnicos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-2.5">
              {clientesUnicos.map(({id, nombre}) => {
                const hex    = colorCliente(id);
                const activo = clientesFiltro.has(id);
                const esPicker = pickerColorId === id;
                return (
                  <div key={id} className="relative">
                    <div className={[
                      "flex items-center gap-0 overflow-hidden rounded-[8px] border text-[12.5px] font-medium transition-all",
                      activo ? "border-transparent shadow-sm" : "border-line bg-card text-ink-2",
                    ].join(" ")}
                    style={activo ? {backgroundColor: hex + "22", borderColor: hex} : undefined}>

                      {/* Botón color */}
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setPickerColorId(esPicker ? null : id); }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center transition-opacity hover:opacity-75"
                        title="Cambiar color">
                        <span className="h-3.5 w-3.5 rounded-full border border-white/30 shadow-sm"
                          style={{backgroundColor: hex}} />
                      </button>

                      {/* Nombre (toggle filtro) */}
                      <button type="button" onClick={() => toggleClienteFiltro(id)}
                        className="pr-2.5 py-1.5 text-left leading-none"
                        style={activo ? {color: hex} : undefined}>
                        {nombre}
                      </button>
                    </div>

                    {/* Color picker popover */}
                    {esPicker && (
                      <div className="absolute left-0 top-full z-20 mt-1.5 w-[192px] rounded-[12px] border border-line bg-paper p-3 shadow-xl"
                        onClick={e => e.stopPropagation()}>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">{nombre}</p>
                        <div className="grid grid-cols-8 gap-1.5">
                          {PALETA_PICKER_CLIENTE.map(color => (
                            <button key={color} type="button"
                              onClick={() => guardarColorCliente(id, color)}
                              className={[
                                "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all",
                                clienteColores[id] === color ? "border-ink scale-110" : "border-transparent hover:scale-110",
                              ].join(" ")}
                              style={{backgroundColor: color}}>
                              {clienteColores[id] === color && <Check size={10} strokeWidth={3} className="text-white drop-shadow" />}
                            </button>
                          ))}
                        </div>
                        {clienteColores[id] && (
                          <button type="button" onClick={() => borrarColorCliente(id)}
                            className="mt-2 text-[11px] text-ink-3 transition-colors hover:text-ink">
                            Restablecer color
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {clientesFiltro.size > 0 && (
                <button type="button" onClick={() => setClientesFiltro(new Set())}
                  className="rounded-chip px-2.5 py-1 text-[12px] text-ink-3 transition-colors hover:text-ink">
                  ✕ Todos
                </button>
              )}

              {clientesUnicos.length === 0 && (
                <span className="text-[12.5px] text-ink-3/60">Sin publicaciones en este período</span>
              )}
            </div>
          )}

          {/* Leyenda vacía modo org sin clientes */}
          {modo === "org" && clientesUnicos.length === 0 && (
            <div className="flex items-center gap-2 border-t border-line-soft px-5 py-2.5">
              <Sparkles size={13} strokeWidth={2} className="text-ink-3" />
              <span className="text-[12.5px] text-ink-3/70">Sin publicaciones en este período</span>
            </div>
          )}
        </div>

        {vista === "mes"
          ? <VistaMes mesBase={mesBase} HOY={HOY} eventosDe={eventosDe} onSelect={setEventoSeleccionado} colorCliente={colorCliente} />
          : <VistaSemana dias={diasSemana} HOY={HOY} eventosDe={eventosDe} onSelect={setEventoSeleccionado} colorCliente={colorCliente} />
        }
      </div>

      {/* Modales */}
      {modal && (
        <ModalEvento tab={tab} HOY={HOY}
          onClose={() => setModal(false)}
          onCreado={(e) => { agregarEvento(e); setModal(false); }} />
      )}
      {modalOrganico && (
        <ModalOrganico HOY={HOY}
          onClose={() => setModalOrganico(false)}
          onCreado={(e) => { agregarOrganico(e); setModalOrganico(false); }} />
      )}
      {eventoSeleccionado && (
        <ModalDetalle
          evento={eventoSeleccionado} tab={tab} personaId={personaId}
          colorCliente={colorCliente}
          onClose={() => setEventoSeleccionado(null)}
          onColorChange={(id, colorId) =>
            setEventos(prev => prev.map(e => e.id === id ? {...e, colorId: colorId ?? undefined} : e))
          }
          onOrganicUpdate={(u) => { actualizarOrganico(u); setEventoSeleccionado(u); }}
          onOrganicDelete={(id) => { eliminarOrganico(id); setEventoSeleccionado(null); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA MES
// ─────────────────────────────────────────────────────────────────────────────

function VistaMes({mesBase, HOY, eventosDe, onSelect, colorCliente}: {
  mesBase: Date; HOY: string;
  eventosDe: (f: string) => GcalEvent[];
  onSelect: (e: GcalEvent) => void;
  colorCliente: (id: string) => string;
}) {
  const y = mesBase.getFullYear(), m = mesBase.getMonth();
  const firstDay  = new Date(y, m, 1);
  const offset    = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const totalDias = new Date(y, m + 1, 0).getDate();

  const celdas: (string|null)[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let i = 1; i <= totalDias; i++) celdas.push(fechaStr(new Date(y, m, i)));
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <>
      <div className="grid grid-cols-7 border-b border-line">
        {DIAS_CORTOS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-wide text-ink-3">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((fecha, i) => {
          const esFin = (i + 1) % 7 === 0;
          if (!fecha) return (
            <div key={`e-${i}`} className={`min-h-[88px] border-b border-line-soft bg-paper/50${!esFin?" border-r":""}`} />
          );
          const evs     = eventosDe(fecha);
          const dia     = parseInt(fecha.slice(8), 10);
          const esHoy   = fecha === HOY;
          const esPasado = fecha < HOY;
          return (
            <div key={fecha} className={[
              "min-h-[88px] border-b border-line-soft p-1.5",
              !esFin ? "border-r" : "",
              esHoy ? "bg-lime-soft/40" : esPasado ? "bg-paper/50" : "hover:bg-paper/60",
            ].filter(Boolean).join(" ")}>
              <span className={[
                "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold",
                esHoy ? "bg-ink text-lime" : esPasado ? "text-ink-3/50" : "text-ink",
              ].join(" ")}>{dia}</span>
              <div className="flex flex-col gap-px">
                {evs.slice(0,2).map(e => <ChipEvento key={e.id} evento={e} compacto onSelect={onSelect} colorCliente={colorCliente} />)}
                {evs.length > 2 && <span className="px-1 text-[10px] text-ink-3">+{evs.length - 2} más</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA SEMANA
// ─────────────────────────────────────────────────────────────────────────────

function VistaSemana({dias, HOY, eventosDe, onSelect, colorCliente}: {
  dias: Date[]; HOY: string;
  eventosDe: (f: string) => GcalEvent[];
  onSelect: (e: GcalEvent) => void;
  colorCliente: (id: string) => string;
}) {
  return (
    <div className="divide-y divide-line-soft">
      {dias.map((d, i) => {
        const fecha = fechaStr(d);
        const evs   = eventosDe(fecha);
        const esHoy = fecha === HOY;
        return (
          <div key={fecha} className={`px-5 py-4 ${esHoy?"bg-lime-soft/30":""}`}>
            <div className="mb-2.5 flex items-center gap-2">
              <span className={[
                "flex h-7 w-7 items-center justify-center rounded-[9px] text-[12px] font-bold",
                esHoy ? "bg-ink text-lime" : "bg-line-soft text-ink-2",
              ].join(" ")}>{d.getDate()}</span>
              <span className={`text-[12.5px] font-bold uppercase tracking-[0.07em] ${esHoy?"text-ink":"text-ink-3"}`}>
                {DIAS_CORTOS[i]}
              </span>
              {esHoy && <span className="rounded-chip bg-ink px-2 py-px text-[10px] font-bold text-lime">Hoy</span>}
            </div>
            {evs.length === 0
              ? <p className="text-[12.5px] text-ink-3/60">Sin eventos</p>
              : <div className="flex flex-col gap-2">{evs.map(e => <ChipEvento key={e.id} evento={e} onSelect={onSelect} colorCliente={colorCliente} />)}</div>
            }
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHIP DE EVENTO
// ─────────────────────────────────────────────────────────────────────────────

function ChipEvento({evento, compacto=false, onSelect, colorCliente}: {
  evento: GcalEvent; compacto?: boolean;
  onSelect: (e: GcalEvent) => void;
  colorCliente: (id: string) => string;
}) {
  // ── Orgánico ─────────────────────────────────────────────────────────────
  if (evento.esOrganico) {
    const hex       = colorCliente(evento.clienteId ?? "");
    const tipoLabel = TIPO_LABEL[evento.tipoContenido ?? "otro"] ?? "Pub.";
    const redLabel  = RED_LABEL[evento.redSocial ?? "otro"] ?? "IG";
    const done      = evento.completado;
    const hora      = eventHora(evento);

    if (compacto) {
      return (
        <button type="button" onClick={() => onSelect(evento)}
          style={{backgroundColor: hex+"22", borderLeft:`2px solid ${hex}`}}
          className={`flex w-full items-center gap-1 rounded-[5px] px-1 py-px text-[10px] font-bold transition-opacity hover:opacity-75 ${done?"opacity-40":""}`}>
          <span className="shrink-0 rounded-[3px] px-1 py-px text-[8px] font-bold uppercase text-white" style={{backgroundColor:hex}}>
            {tipoLabel}
          </span>
          <span className={`truncate text-ink ${done?"line-through":""}`}>{evento.summary ?? "(sin título)"}</span>
        </button>
      );
    }
    return (
      <button type="button" onClick={() => onSelect(evento)}
        style={{backgroundColor: hex+"18", borderLeft:`3px solid ${hex}`}}
        className={`flex w-full items-center gap-3 rounded-soft p-3 text-left transition-opacity hover:opacity-80 ${done?"opacity-50":""}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold uppercase text-white" style={{backgroundColor:hex}}>
          {redLabel}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] font-bold ${done?"line-through":""}`}>{evento.summary ?? "(sin título)"}</p>
          <p className="mt-0.5 text-[12px] opacity-60">{evento.clienteNombre} · {tipoLabel}</p>
          {hora && <p className="mt-0.5 text-[12px] opacity-70">{hora}</p>}
        </div>
        {done && <Check size={13} strokeWidth={2.5} className="shrink-0 text-ink-3" />}
      </button>
    );
  }

  // ── GCal ─────────────────────────────────────────────────────────────────
  const hex    = evento.esEquipo && evento.personaId
    ? colorDePersona(evento.personaId)
    : (evento.colorId ? GCAL_COLORS[evento.colorId] : null);
  const hora   = eventHora(evento);
  const titulo = evento.summary ?? "(sin título)";
  const inicial = evento.esEquipo && evento.personaNombre
    ? evento.personaNombre.charAt(0).toUpperCase() : null;

  if (compacto) {
    return (
      <button type="button" onClick={() => onSelect(evento)}
        style={hex ? {backgroundColor: hex+"22", borderLeft:`2px solid ${hex}`} : undefined}
        className={`flex w-full items-center gap-1 rounded-[5px] px-1 py-px text-[10px] font-bold transition-opacity hover:opacity-75 ${hex?"text-ink":"bg-line-soft text-ink-2"}`}>
        {inicial
          ? <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7px] font-bold text-white" style={{backgroundColor:hex??"#888"}}>{inicial}</span>
          : hex ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:hex}} />
                : <CalendarDays size={8} strokeWidth={2} className="shrink-0" />
        }
        <span className="truncate">{hora ? `${hora} · ` : ""}{titulo}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onSelect(evento)}
      style={hex ? {backgroundColor: hex+"18", borderLeft:`3px solid ${hex}`} : undefined}
      className={`flex w-full items-center gap-3 rounded-soft p-3 text-left transition-opacity hover:opacity-80 ${hex?"text-ink":"bg-line-soft text-ink-2"}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-bold text-white"
        style={{backgroundColor: hex ?? "rgba(200,200,200,0.5)"}}>
        {inicial ?? <CalendarDays size={14} strokeWidth={2} style={hex?{color:"white"}:{color:"#666"}} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold">{titulo}</p>
        {evento.personaNombre && <p className="mt-0.5 text-[12px] opacity-60">{evento.personaNombre}</p>}
        {hora && <p className="mt-0.5 text-[12px] opacity-70">{hora}</p>}
        {evento.description && !evento.personaNombre && <p className="mt-0.5 truncate text-[12px] opacity-60">{evento.description}</p>}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DETALLE
// ─────────────────────────────────────────────────────────────────────────────

function ModalDetalle({evento, tab, personaId, colorCliente, onClose, onColorChange, onOrganicUpdate, onOrganicDelete}: {
  evento: GcalEvent; tab: Tab; personaId: string;
  colorCliente: (id: string) => string;
  onClose: () => void;
  onColorChange: (eventId: string, colorId: string | null) => void;
  onOrganicUpdate?: (u: GcalEvent) => void;
  onOrganicDelete?: (id: string) => void;
}) {
  const fecha  = eventFecha(evento);
  const hora   = eventHora(evento);
  const titulo = evento.summary ?? "(sin título)";
  const fechaFormateada = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR",
    {weekday:"long", day:"numeric", month:"long", year:"numeric"});

  // ── Rama orgánica ─────────────────────────────────────────────────────────
  if (evento.esOrganico) {
    const hex       = colorCliente(evento.clienteId ?? "");
    const tipoLabel = TIPO_LABEL[evento.tipoContenido ?? "otro"] ?? "Publicación";
    const redLabel  = RED_LABEL[evento.redSocial ?? "otro"] ?? "IG";
    const done      = evento.completado;
    const esCreador = personaId === evento.creadoPor;

    const [toggling,   setToggling]   = useState(false);
    const [deleting,   setDeleting]   = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);

    async function toggleCompletado() {
      setToggling(true);
      try {
        const res = await fetch("/api/db/eventos-organico", {
          method:"PATCH", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({id: evento.organicoId, completado: !done}),
        });
        if (!res.ok) return;
        onOrganicUpdate?.(organicoToGcal(await res.json()));
      } finally { setToggling(false); }
    }
    async function eliminar() {
      setDeleting(true);
      try {
        await fetch("/api/db/eventos-organico", {
          method:"DELETE", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({id: evento.organicoId}),
        });
        onOrganicDelete?.(evento.id);
      } finally { setDeleting(false); }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-line bg-paper shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="relative border-b border-line px-5 py-4" style={{borderLeft:`4px solid ${hex}`}}>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-[5px] px-2 py-0.5 text-[11px] font-bold uppercase text-white" style={{backgroundColor:hex}}>
                {tipoLabel}
              </span>
              <span className="text-[11px] text-ink-3">{redLabel}</span>
              {done && <span className="rounded-chip bg-ok-bg px-2 py-px text-[10px] font-bold text-ok">Publicado</span>}
            </div>
            <h2 className={`pr-8 font-display text-[17px] leading-snug ${done?"line-through opacity-60":""}`}>{titulo}</h2>
            <button type="button" onClick={onClose}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
              <X size={15} strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="text-[13px] font-medium text-ink-2">{evento.clienteNombre}</p>
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <CalendarDays size={14} strokeWidth={2} className="shrink-0 text-ink-3" />
              <span className="capitalize">{fechaFormateada}</span>
              {hora && <span className="text-ink-3">· {hora}</span>}
            </div>
            {evento.description && (
              <div className="rounded-[10px] bg-line-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2 whitespace-pre-wrap">
                {evento.description}
              </div>
            )}
            <button type="button" onClick={toggleCompletado} disabled={toggling}
              className={["flex items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[13px] font-medium transition-colors",
                done ? "border-line bg-card text-ink-3 hover:bg-line-soft"
                     : "border-ok/40 bg-ok-bg text-ok hover:bg-ok/10",
              ].join(" ")}>
              {toggling ? <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                        : done ? <Circle size={15} strokeWidth={2} />
                               : <CheckCircle2 size={15} strokeWidth={2} />}
              {done ? "Marcar como pendiente" : "Marcar como publicado"}
            </button>
          </div>

          {esCreador && (
            <div className="border-t border-line px-5 py-3">
              {!confirmDel
                ? <button type="button" onClick={() => setConfirmDel(true)}
                    className="flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-crit">
                    <Trash2 size={12} strokeWidth={2} /> Eliminar publicación
                  </button>
                : <div className="flex items-center gap-2">
                    <span className="text-[12.5px] text-ink-2">¿Eliminar?</span>
                    <button type="button" onClick={eliminar} disabled={deleting}
                      className="rounded-[8px] bg-crit px-3 py-1 text-[12px] font-bold text-white disabled:opacity-40">
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : "Sí, eliminar"}
                    </button>
                    <button type="button" onClick={() => setConfirmDel(false)} className="text-[12px] text-ink-3 hover:text-ink">
                      Cancelar
                    </button>
                  </div>
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Rama GCal ─────────────────────────────────────────────────────────────
  const [colorId,    setColorId]    = useState<string | null>(evento.colorId ?? null);
  const [guardando,  setGuardando]  = useState(false);
  const [errorColor, setErrorColor] = useState<string | null>(null);
  const hexPersona = evento.personaId ? colorDePersona(evento.personaId) : null;
  const hex = hexPersona ?? (colorId ? GCAL_COLORS[colorId] : null);
  let horaFin: string | null = null;
  if (evento.end.dateTime)
    horaFin = new Date(evento.end.dateTime).toLocaleTimeString("es-AR", {hour:"2-digit",minute:"2-digit"});

  async function cambiarColor(nuevoId: string | null) {
    setColorId(nuevoId); setGuardando(true); setErrorColor(null);
    try {
      const res = await fetch("/api/calendar/events", {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({cal:tab, eventId:evento.id, colorId:nuevoId}),
      });
      if (!res.ok) throw new Error(await res.text());
      onColorChange(evento.id, nuevoId);
    } catch {
      setErrorColor("No se pudo guardar el color.");
      setColorId(evento.colorId ?? null);
    } finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-line bg-paper shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="relative border-b border-line px-5 py-4" style={hex?{borderLeft:`4px solid ${hex}`}:undefined}>
          <h2 className="pr-8 font-display text-[18px] leading-snug">{titulo}</h2>
          <button type="button" onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <CalendarDays size={15} strokeWidth={2} className="mt-px shrink-0 text-ink-3" />
            <div>
              <p className="text-[13.5px] font-medium capitalize">{fechaFormateada}</p>
              {hora
                ? <p className="text-[13px] text-ink-3">{hora}{horaFin&&horaFin!==hora?` → ${horaFin}`:""}</p>
                : <p className="text-[13px] text-ink-3">Todo el día</p>}
            </div>
          </div>
          {evento.description && (
            <div className="rounded-[10px] bg-line-soft/60 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2 whitespace-pre-wrap">
              {evento.description}
            </div>
          )}
          {tab === "mio" && (
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-3">
                Color {guardando && <span className="font-normal normal-case text-ink-3/60">Guardando…</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => cambiarColor(null)} title="Sin color"
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${!colorId?"border-ink":"border-line hover:border-ink-3"}`}
                  style={{backgroundColor:"#dde4de"}}>
                  {!colorId && <Check size={11} strokeWidth={3} className="text-ink" />}
                </button>
                {COLORES_PICKER.map(c => (
                  <button key={c.id} type="button" onClick={() => cambiarColor(c.id)} title={c.nombre}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${colorId===c.id?"border-ink scale-110":"border-transparent hover:scale-105"}`}
                    style={{backgroundColor:GCAL_COLORS[c.id]}}>
                    {colorId===c.id && <Check size={11} strokeWidth={3} className="text-white drop-shadow" />}
                  </button>
                ))}
              </div>
              {errorColor && <p className="mt-1.5 text-[11.5px] text-crit">{errorColor}</p>}
            </div>
          )}
        </div>

        {evento.htmlLink && (
          <div className="border-t border-line px-5 py-3">
            <a href={evento.htmlLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink">
              <ExternalLink size={12} strokeWidth={2} /> Abrir en Google Calendar
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL NUEVA PUBLICACIÓN ORGÁNICA
// ─────────────────────────────────────────────────────────────────────────────

function ModalOrganico({HOY, onClose, onCreado}: {
  HOY: string; onClose: () => void; onCreado: (e: GcalEvent) => void;
}) {
  const [clientes,     setClientes]     = useState<{id:string;nombre:string}[]>([]);
  const [clienteId,    setClienteId]    = useState("");
  const [titulo,       setTitulo]       = useState("");
  const [tipo,         setTipo]         = useState("reel");
  const [redSocial,    setRedSocial]    = useState("instagram");
  const [fecha,        setFecha]        = useState(HOY);
  const [hora,         setHora]         = useState("");
  const [descripcion,  setDescripcion]  = useState("");
  const [recordatorio, setRecordatorio] = useState("dia-anterior");
  const [visibilidad,  setVisibilidad]  = useState<"equipo"|"personas">("equipo");
  const [personasIds,  setPersonasIds]  = useState<string[]>([]);
  const [guardando,    setGuardando]    = useState(false);
  const [error,        setError]        = useState<string|null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch("/api/db/clientes").then(r=>r.json())
      .then((rows:{id:string;nombre:string}[]) => setClientes(rows))
      .catch(()=>{});
  }, []);

  function togglePersona(id: string) {
    setPersonasIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }

  async function guardar() {
    if (!clienteId || !titulo.trim() || !fecha) { setError("Cliente, título y fecha son obligatorios."); return; }
    if (visibilidad === "personas" && personasIds.length === 0) { setError("Seleccioná al menos una persona."); return; }
    setGuardando(true); setError(null);
    try {
      const res = await fetch("/api/db/eventos-organico", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          cliente_id:   clienteId,
          titulo:       titulo.trim(),
          descripcion:  descripcion || undefined,
          fecha, hora: hora||undefined,
          tipo, red_social: redSocial,
          visibilidad, personas_ids: visibilidad==="personas"?personasIds:[],
          recordatorio,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreado(organicoToGcal(await res.json()));
    } catch(err) {
      setError((err as Error).message);
    } finally { setGuardando(false); }
  }

  const chip = (active: boolean) =>
    `rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-all ${
      active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink-3/40 hover:text-ink"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-card border border-line bg-paper shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-[17px]">
            <Sparkles size={15} strokeWidth={2} className="text-lime" />
            Nueva publicación orgánica
          </h2>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Cliente</label>
            <select value={clienteId} onChange={e=>setClienteId(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-ink-3/50">
              <option value="">Seleccionar cliente…</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Título del contenido</label>
            <input ref={inputRef} value={titulo} onChange={e=>setTitulo(e.target.value)}
              placeholder="Ej: Reel proceso de producción, Post de lanzamiento…"
              className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-ink-3/50 placeholder:text-ink-3/50" />
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_ORGANICO.map(t=>(
                <button key={t} type="button" onClick={()=>setTipo(t)} className={chip(tipo===t)}>
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Red social</label>
            <div className="flex flex-wrap gap-2">
              {REDES_ORGANICO.map(r=>(
                <button key={r} type="button" onClick={()=>setRedSocial(r)} className={chip(redSocial===r)}>
                  {r.charAt(0).toUpperCase()+r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Fecha</label>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-ink-3/50" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
                Hora <span className="font-normal normal-case text-ink-3/60">(opcional)</span>
              </label>
              <input type="time" value={hora} onChange={e=>setHora(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink-3/50" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
              Notas <span className="font-normal normal-case text-ink-3/60">(opcional)</span>
            </label>
            <textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)} rows={2}
              placeholder="Referencias, links, indicaciones de edición…"
              className="w-full resize-none rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-ink-3/50 placeholder:text-ink-3/50" />
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Recordatorio</label>
            <div className="flex flex-wrap gap-2">
              {RECORDATORIOS.map(({v,l})=>(
                <button key={v} type="button" onClick={()=>setRecordatorio(v)} className={chip(recordatorio===v)}>{l}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Visible para</label>
            <div className="flex gap-2">
              <button type="button" onClick={()=>setVisibilidad("equipo")} className={chip(visibilidad==="equipo")}>Todo el equipo</button>
              <button type="button" onClick={()=>setVisibilidad("personas")} className={chip(visibilidad==="personas")}>Personas específicas</button>
            </div>
            {visibilidad === "personas" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {equipo.map(p=>(
                  <button key={p.id} type="button" onClick={()=>togglePersona(p.id)}
                    className={["flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[12.5px] transition-all",
                      personasIds.includes(p.id) ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink-3/40",
                    ].join(" ")}>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink-3/20 text-[9px] font-bold">{p.inicial}</span>
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-[12.5px] text-crit">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-[10px] px-4 py-2 text-[13px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando}
            className="flex items-center gap-2 rounded-[10px] bg-lime px-4 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-40">
            {guardando && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
            Guardar publicación
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL NUEVO EVENTO GCAL
// ─────────────────────────────────────────────────────────────────────────────

function ModalEvento({tab, HOY, onClose, onCreado}: {
  tab: Tab; HOY: string; onClose: ()=>void; onCreado:(e:GcalEvent)=>void;
}) {
  const [titulo,      setTitulo]      = useState("");
  const [fecha,       setFecha]       = useState(HOY);
  const [horaInicio,  setHoraInicio]  = useState("09:00");
  const [horaFin,     setHoraFin]     = useState("10:00");
  const [descripcion, setDescripcion] = useState("");
  const [colorId,     setColorId]     = useState<string|undefined>(undefined);
  const [guardando,   setGuardando]   = useState(false);
  const [error,       setError]       = useState<string|null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function guardar() {
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    setGuardando(true); setError(null);
    try {
      const e = await apiCrear(tab, {
        summary: titulo.trim(),
        startDateTime: isoLocal(fecha, horaInicio),
        endDateTime:   isoLocal(fecha, horaFin),
        description: descripcion||undefined, colorId,
      });
      onCreado(e);
    } catch(err) { setError((err as Error).message); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] overflow-hidden rounded-card border border-line bg-paper shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-[17px]">Nuevo evento</h2>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Título</label>
            <input ref={inputRef} value={titulo} onChange={e=>setTitulo(e.target.value)}
              placeholder="Reunión con cliente, grabación…"
              className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-ink-3/50 placeholder:text-ink-3/50" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Fecha</label>
              <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-ink-3/50" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Inicio</label>
              <input type="time" value={horaInicio} onChange={e=>setHoraInicio(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink-3/50" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Fin</label>
              <input type="time" value={horaFin} onChange={e=>setHoraFin(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[14px] outline-none focus:border-ink-3/50" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Calendario</label>
              <span className="flex h-[42px] items-center rounded-[10px] border border-line bg-line-soft px-3 text-[13px] font-bold text-ink-2">Mi calen.</span>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Color</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={()=>setColorId(undefined)}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${!colorId?"border-ink":"border-line hover:border-ink-3"}`}
                style={{backgroundColor:"#dde4de"}}>
                {!colorId && <Check size={11} strokeWidth={3} className="text-ink" />}
              </button>
              {COLORES_PICKER.map(c=>(
                <button key={c.id} type="button" onClick={()=>setColorId(c.id)} title={c.nombre}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${colorId===c.id?"border-ink scale-110 shadow-sm":"border-transparent hover:scale-105"}`}
                  style={{backgroundColor:GCAL_COLORS[c.id]}}>
                  {colorId===c.id && <Check size={11} strokeWidth={3} className="text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-3">Descripción <span className="font-normal normal-case text-ink-3/60">(opcional)</span></label>
            <textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)} rows={2}
              placeholder="Notas adicionales…"
              className="w-full resize-none rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-ink-3/50 placeholder:text-ink-3/50" />
          </div>
          {error && <p className="text-[12.5px] text-crit">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-[10px] px-4 py-2 text-[13px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando}
            className="flex items-center gap-2 rounded-[10px] bg-lime px-4 py-2 text-[13px] font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-40">
            {guardando && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
            Guardar evento
          </button>
        </div>
      </div>
    </div>
  );
}
