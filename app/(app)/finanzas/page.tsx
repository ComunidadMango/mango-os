"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import {
  Lock, RefreshCw, MoreHorizontal, Check, AlertTriangle,
  Pencil, TrendingUp, TrendingDown, Minus, Plus, Trash2, X, ChevronDown,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { enviarAPapelera } from "@/lib/papelera";
import {
  clientes as clientesData,
  equipo as equipoData,
  ROLES_FINANZAS,
  type CategoriaGasto,
  type EstadoCobro,
  type EstadoPagoPersona,
  type Moneda,
} from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type ClienteEntry = {
  id: string; nombre: string; fee: number;
  moneda: Moneda; estadoCobro: EstadoCobro; fechaPago: string | null;
};
type EquipoEntry = {
  id: string; nombre: string; rol: string; honorario: number;
  moneda: Moneda; estado: EstadoPagoPersona; fechaPago: string | null;
};
type GastoEntry = {
  id: string; nombre: string; monto: number;
  moneda: Moneda; categoria: CategoriaGasto; recurrente: boolean;
};

type EstadoFinanzas = {
  mes: string;
  clientes: ClienteEntry[];
  equipo:   EquipoEntry[];
  gastos:   GastoEntry[];
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA
// ─────────────────────────────────────────────────────────────────────────────

const MES_ACTUAL  = new Date().toISOString().slice(0, 7);
const KEY_ESTADO  = "mango-finanzas-estado-v3";
const KEY_ACCESOS = "mango-finanzas-accesos";

function estadoInicial(): EstadoFinanzas {
  return { mes: MES_ACTUAL, clientes: [], equipo: [], gastos: [] };
}

function leerEstado(): EstadoFinanzas {
  if (typeof window === "undefined") return estadoInicial();
  try {
    const raw = localStorage.getItem(KEY_ESTADO);
    if (!raw) return estadoInicial();
    const parsed = JSON.parse(raw) as Partial<EstadoFinanzas> & { mes?: string };
    if (parsed.mes !== MES_ACTUAL) return estadoInicial();
    return {
      mes: MES_ACTUAL,
      clientes: Array.isArray(parsed.clientes) ? parsed.clientes : [],
      equipo:   Array.isArray(parsed.equipo)   ? parsed.equipo   : [],
      gastos:   Array.isArray(parsed.gastos)   ? parsed.gastos   : [],
    };
  } catch { return estadoInicial(); }
}

function guardarEstado(s: EstadoFinanzas): void {
  localStorage.setItem(KEY_ESTADO, JSON.stringify(s));
}

function leerAccesos(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY_ACCESOS) ?? "[]"); } catch { return []; }
}
function guardarAccesos(ids: string[]): void {
  localStorage.setItem(KEY_ACCESOS, JSON.stringify(ids));
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtUSD(n: number) { return `USD ${n.toLocaleString("en-US")}`; }
function fmtARS(n: number) { return `$ ${n.toLocaleString("es-AR")}`; }
function fmt(n: number, moneda: Moneda) { return moneda === "usd" ? fmtUSD(n) : fmtARS(n); }

const MESES_LARGO = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTO = ["","ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function nombreMes(isoMes: string) {
  const [year, month] = isoMes.split("-").map(Number);
  return `${MESES_LARGO[month]} ${year}`;
}
function fechaCorta(iso: string | null) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTO[m]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE ESTADOS
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "clientes" | "equipo" | "gastos" | "historial";
const TABS: { id: Tab; label: string }[] = [
  { id: "clientes",  label: "Clientes"  },
  { id: "equipo",    label: "Equipo"    },
  { id: "gastos",    label: "Gastos"    },
  { id: "historial", label: "Historial" },
];

const COBRO_CICLO: EstadoCobro[]       = ["pendiente", "al_dia", "vencido"];
const PAGO_CICLO:  EstadoPagoPersona[] = ["pendiente", "pagado"];
const CAT_LABELS: Record<CategoriaGasto, string> = {
  herramienta: "Herramienta", tecnico: "Técnico", operativo: "Operativo", otro: "Otro",
};
const CAT_OPCIONES: CategoriaGasto[] = ["herramienta", "tecnico", "operativo", "otro"];
const CAT_CICLO: CategoriaGasto[]    = ["herramienta", "tecnico", "operativo", "otro"];

const COBRO_CFG: Record<EstadoCobro, { texto: string; clase: string }> = {
  al_dia:    { texto: "Al día",    clase: "bg-ok-bg text-ok"     },
  pendiente: { texto: "Pendiente", clase: "bg-warn-bg text-warn" },
  vencido:   { texto: "Vencido",   clase: "bg-crit-bg text-crit" },
};
const PAGO_CFG: Record<EstadoPagoPersona, { texto: string; clase: string }> = {
  pagado:    { texto: "Pagado",    clase: "bg-ok-bg text-ok"     },
  pendiente: { texto: "Pendiente", clase: "bg-warn-bg text-warn" },
};
const CATEGORIA_CFG: Record<CategoriaGasto, { texto: string; clase: string }> = {
  herramienta: { texto: "Herramienta", clase: "bg-line-soft text-ink-2" },
  tecnico:     { texto: "Técnico",     clase: "bg-line-soft text-ink-2" },
  operativo:   { texto: "Operativo",   clase: "bg-warn-bg text-warn"    },
  otro:        { texto: "Otro",        clase: "bg-line-soft text-ink-2" },
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL MOCK
// ─────────────────────────────────────────────────────────────────────────────

type MesHistorial = { mes: string; ingresos: number; gastoEquipo: number; gastosOp: number; resultado: number };
const HISTORIAL_PASADO: MesHistorial[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────────────────────

export default function Finanzas() {
  const usuarioActual = useUsuarioActual();
  const [tab, setTab] = useState<Tab>("clientes");
  const [estado, setEstadoRaw]               = useState<EstadoFinanzas | null>(null);
  const [accesosGranted, setAccesosGrantedState] = useState<string[]>([]);
  const [menuAbierto, setMenuAbierto]        = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmFin, setConfirmFin]          = useState<{ tipo: "cliente" | "equipo" | "gasto"; id: string; titulo: string } | null>(null);

  useEffect(() => {
    startTransition(() => {
      setEstadoRaw(leerEstado());
      setAccesosGrantedState(leerAccesos());
    });
  }, []);

  useEffect(() => {
    if (!menuAbierto) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuAbierto]);

  const esAdmin     = ROLES_FINANZAS.includes(usuarioActual.id);
  const tieneAcceso = esAdmin || accesosGranted.includes(usuarioActual.id);

  function setEstado(fn: (prev: EstadoFinanzas) => EstadoFinanzas) {
    setEstadoRaw((prev) => {
      const next = fn(prev ?? estadoInicial());
      guardarEstado(next);
      return next;
    });
  }

  function toggleAcceso(personaId: string) {
    const actual = leerAccesos();
    const nueva  = actual.includes(personaId) ? actual.filter((id) => id !== personaId) : [...actual, personaId];
    guardarAccesos(nueva);
    setAccesosGrantedState(nueva);
  }

  if (!tieneAcceso) return <SinAcceso />;
  if (!estado)      return null;

  // ── Alerta día 10 ────────────────────────────────────────────────────────
  const diaHoy = new Date().getDate();
  const clientesPendientes = estado.clientes.filter((c) => c.estadoCobro === "pendiente");
  const equipoPendiente    = estado.equipo.filter((p) => p.estado === "pendiente");
  const hayAlerta = diaHoy >= 10 && (clientesPendientes.length > 0 || equipoPendiente.length > 0);

  // ── Totales ───────────────────────────────────────────────────────────────
  const ingUSD = estado.clientes.filter((c) => c.moneda === "usd").reduce((s, c) => s + c.fee, 0);
  const ingARS = estado.clientes.filter((c) => c.moneda === "ars").reduce((s, c) => s + c.fee, 0);
  const eqUSD  = estado.equipo.filter((p) => p.moneda === "usd").reduce((s, p) => s + p.honorario, 0);
  const eqARS  = estado.equipo.filter((p) => p.moneda === "ars").reduce((s, p) => s + p.honorario, 0);
  const gstUSD = estado.gastos.filter((g) => g.moneda === "usd").reduce((s, g) => s + g.monto, 0);
  const gstARS = estado.gastos.filter((g) => g.moneda === "ars").reduce((s, g) => s + g.monto, 0);
  const netUSD = ingUSD - eqUSD - gstUSD;
  const netARS = ingARS - eqARS - gstARS;

  const miembrosExternos = equipoData.filter((p) => !ROLES_FINANZAS.includes(p.id));

  // ── Mutaciones clientes ───────────────────────────────────────────────────
  function agregarCliente(e: Omit<ClienteEntry, "id">) {
    setEstado((prev) => ({ ...prev, clientes: [...prev.clientes, { id: `c-${Date.now()}`, ...e }] }));
  }
  function updateCliente(id: string, patch: Partial<ClienteEntry>) {
    setEstado((prev) => ({ ...prev, clientes: prev.clientes.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  }
  function eliminarCliente(id: string) {
    const item = estado?.clientes.find((c) => c.id === id);
    if (item) enviarAPapelera({ id: item.id, tipo: "finanza-cliente", titulo: item.nombre, datos: item });
    setEstado((prev) => ({ ...prev, clientes: prev.clientes.filter((c) => c.id !== id) }));
  }
  function pedirElimCliente(id: string) {
    const item = estado?.clientes.find((c) => c.id === id);
    if (item) setConfirmFin({ tipo: "cliente", id, titulo: item.nombre });
  }

  // ── Mutaciones equipo ─────────────────────────────────────────────────────
  function agregarEquipo(e: Omit<EquipoEntry, "id">) {
    setEstado((prev) => ({ ...prev, equipo: [...prev.equipo, { id: `p-${Date.now()}`, ...e }] }));
  }
  function updateEquipo(id: string, patch: Partial<EquipoEntry>) {
    setEstado((prev) => ({ ...prev, equipo: prev.equipo.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  }
  function eliminarEquipo(id: string) {
    const item = estado?.equipo.find((p) => p.id === id);
    if (item) enviarAPapelera({ id: item.id, tipo: "finanza-equipo", titulo: item.nombre, datos: item });
    setEstado((prev) => ({ ...prev, equipo: prev.equipo.filter((p) => p.id !== id) }));
  }
  function pedirElimEquipo(id: string) {
    const item = estado?.equipo.find((p) => p.id === id);
    if (item) setConfirmFin({ tipo: "equipo", id, titulo: item.nombre });
  }

  // ── Mutaciones gastos ─────────────────────────────────────────────────────
  function agregarGasto(g: Omit<GastoEntry, "id">) {
    setEstado((prev) => ({ ...prev, gastos: [...prev.gastos, { id: `g-${Date.now()}`, ...g }] }));
  }
  function updateGasto(id: string, patch: Partial<GastoEntry>) {
    setEstado((prev) => ({ ...prev, gastos: prev.gastos.map((g) => g.id === id ? { ...g, ...patch } : g) }));
  }
  function eliminarGasto(id: string) {
    const item = estado?.gastos.find((g) => g.id === id);
    if (item) enviarAPapelera({ id: item.id, tipo: "finanza-gasto", titulo: item.nombre, datos: item });
    setEstado((prev) => ({ ...prev, gastos: prev.gastos.filter((g) => g.id !== id) }));
  }
  function pedirElimGasto(id: string) {
    const item = estado?.gastos.find((g) => g.id === id);
    if (item) setConfirmFin({ tipo: "gasto", id, titulo: item.nombre });
  }

  function ejecutarEliminarFin() {
    if (!confirmFin) return;
    if (confirmFin.tipo === "cliente") eliminarCliente(confirmFin.id);
    if (confirmFin.tipo === "equipo")  eliminarEquipo(confirmFin.id);
    if (confirmFin.tipo === "gasto")   eliminarGasto(confirmFin.id);
    setConfirmFin(null);
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] leading-none">Finanzas</h1>
        <span className="flex items-center gap-1.5 rounded-chip border border-line-soft bg-line-soft px-2.5 py-1.5 text-[12px] text-ink-3">
          <Lock size={12} strokeWidth={2.2} />
          Solo Cami y Maru
        </span>
        <span className="ml-auto text-[12px] text-ink-3">{nombreMes(MES_ACTUAL)}</span>

        {esAdmin && (
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenuAbierto((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-card text-ink-3 transition-colors hover:border-ink-3/50 hover:text-ink">
              <MoreHorizontal size={16} strokeWidth={2} />
            </button>
            {menuAbierto && (
              <div className="absolute right-0 top-full z-50 mt-2 w-[230px] overflow-hidden rounded-[12px] border border-line bg-paper shadow-xl">
                <div className="border-b border-line-soft px-4 py-3">
                  <p className="font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">Acceso adicional</p>
                  <p className="mt-0.5 text-[12px] text-ink-3">Habilitá o deshabilitá el acceso de tu equipo.</p>
                </div>
                <div className="py-1.5">
                  {miembrosExternos.map((p) => {
                    const granted = accesosGranted.includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => toggleAcceso(p.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-line-soft">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-lime-soft text-[11px] font-bold text-ink">{p.inicial}</span>
                        <span className="flex-1">
                          <span className="block text-[13px] font-bold text-ink">{p.nombre}</span>
                          <span className="text-[11.5px] text-ink-3">{p.rol}</span>
                        </span>
                        <span className={["flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors", granted ? "border-ink bg-ink text-paper" : "border-line bg-card"].join(" ")}>
                          {granted && <Check size={12} strokeWidth={2.5} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Alerta día 10 */}
      {hayAlerta && (
        <div className="mb-5 flex gap-3 rounded-[12px] border border-warn/30 bg-warn-bg px-4 py-3.5">
          <AlertTriangle size={17} strokeWidth={2} className="mt-px shrink-0 text-warn" />
          <div>
            <p className="text-[13.5px] font-bold text-warn">Pagos pendientes — ya pasó el día 10</p>
            <p className="mt-0.5 text-[12.5px] text-warn/80">
              {clientesPendientes.length > 0 && (
                <><span className="font-medium">Clientes: </span>{clientesPendientes.map((c) => c.nombre).join(", ")}{equipoPendiente.length > 0 && " · "}</>
              )}
              {equipoPendiente.length > 0 && (
                <><span className="font-medium">Equipo: </span>{equipoPendiente.map((p) => p.nombre).join(", ")}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <ResumenCard titulo="Ingresos"  usdVal={ingUSD}  arsVal={ingARS > 0 ? ingARS : null} />
        <ResumenCard titulo="Equipo"    usdVal={-eqUSD}  arsVal={eqARS  > 0 ? -eqARS  : null} />
        <ResumenCard titulo="Gastos"    usdVal={-gstUSD} arsVal={gstARS > 0 ? -gstARS : null} />
        <ResumenCard titulo="Resultado" usdVal={netUSD}  arsVal={netARS !== 0 ? netARS : null} esNeto />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex w-fit rounded-[10px] border border-line bg-card p-0.5">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={["rounded-[8px] px-4 py-1.5 text-[13px] transition-colors",
              tab === t.id ? "bg-ink font-medium text-paper" : "text-ink-3 hover:bg-line-soft hover:text-ink"].join(" ")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "clientes"  && <TabClientes clientes={estado.clientes} ingUSD={ingUSD} ingARS={ingARS} onAgregar={agregarCliente} onUpdate={updateCliente} onEliminar={pedirElimCliente} />}
      {tab === "equipo"    && <TabEquipo   equipo={estado.equipo}     eqUSD={eqUSD}   eqARS={eqARS}   onAgregar={agregarEquipo}  onUpdate={updateEquipo}  onEliminar={pedirElimEquipo}  />}
      {tab === "gastos"    && <TabGastos   gastos={estado.gastos}     gstUSD={gstUSD} gstARS={gstARS} onAgregar={agregarGasto}   onUpdate={updateGasto}   onEliminar={pedirElimGasto}   />}
      {tab === "historial" && <TabHistorial ingUSD={ingUSD} eqUSD={eqUSD} gstUSD={gstUSD} />}

      {confirmFin && (
        <ConfirmDialog
          titulo={`¿Eliminar "${confirmFin.titulo}"?`}
          mensaje="Se va a mover a la papelera. Podés recuperarlo desde ahí."
          labelConfirmar="Mover a papelera"
          onConfirmar={ejecutarEliminarFin}
          onCancelar={() => setConfirmFin(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB CLIENTES
// ─────────────────────────────────────────────────────────────────────────────

function TabClientes({ clientes, ingUSD, ingARS, onAgregar, onUpdate, onEliminar }: {
  clientes: ClienteEntry[]; ingUSD: number; ingARS: number;
  onAgregar: (e: Omit<ClienteEntry, "id">) => void;
  onUpdate:  (id: string, patch: Partial<ClienteEntry>) => void;
  onEliminar: (id: string) => void;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [draft, setDraft] = useState<{ nombre: string; fee: number; moneda: Moneda }>({
    nombre: "", fee: 0, moneda: "usd",
  });

  const nombresExistentes = new Set(clientes.map((c) => c.nombre));
  const sugerencias = clientesData
    .filter((c) => !c.interno && !nombresExistentes.has(c.nombre))
    .map((c) => ({ nombre: c.nombre, fee: c.fee ?? 0 }));

  function guardar() {
    if (!draft.nombre.trim()) return;
    onAgregar({ nombre: draft.nombre.trim(), fee: draft.fee, moneda: draft.moneda, estadoCobro: "pendiente", fechaPago: null });
    setDraft({ nombre: "", fee: 0, moneda: "usd" });
    setMostrarForm(false);
  }

  const pagados = clientes.filter((c) => c.estadoCobro === "al_dia").length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">
          Clientes
          <span className="ml-1.5 text-[12px] normal-case tabular-nums">· {pagados}/{clientes.length} cobrados</span>
        </h2>
        <span className="ml-auto font-display text-[13px] tabular-nums text-ink-2">{fmtUSD(ingUSD)}</span>
        <button type="button" onClick={() => setMostrarForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:border-ink-3/50 hover:bg-paper">
          <Plus size={13} strokeWidth={2.4} /> Agregar cliente
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-card">
        <div className="grid grid-cols-[1fr_160px_120px_120px_32px] border-b border-line bg-paper/70 px-5 py-2.5">
          {["Cliente", "Fee mensual", "Estado", "Fecha de pago", ""].map((col, i) => (
            <span key={i} className={["font-display text-[11px] uppercase tracking-[0.09em] text-ink-3", i > 0 && i < 4 ? "text-right" : ""].join(" ")}>{col}</span>
          ))}
        </div>

        {/* Fila nueva */}
        {mostrarForm && (
          <div className="grid grid-cols-[1fr_160px_120px_120px_32px] items-center gap-2 border-b border-line bg-lime-soft/30 px-5 py-3">
            {/* Nombre con dropdown de sugerencias */}
            <div className="relative">
              <input autoFocus value={draft.nombre} placeholder="Nombre del cliente…"
                onChange={(e) => {
                  const val = e.target.value;
                  setDraft((d) => ({ ...d, nombre: val }));
                  const match = clientesData.find((c) => c.nombre.toLowerCase() === val.toLowerCase());
                  if (match) setDraft((d) => ({ ...d, nombre: val, fee: match.fee ?? d.fee }));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setMostrarForm(false); }}
                className="w-full rounded-[6px] border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-ink/40" />
              {sugerencias.length > 0 && draft.nombre === "" && (
                <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-line bg-paper shadow-lg">
                  {sugerencias.slice(0, 5).map((s) => (
                    <button key={s.nombre} type="button"
                      onClick={() => setDraft((d) => ({ ...d, nombre: s.nombre, fee: s.fee }))}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-line-soft">
                      <ChevronDown size={11} strokeWidth={2} className="rotate-[-90deg] text-ink-3" />
                      {s.nombre}
                      {s.fee > 0 && <span className="ml-auto text-ink-3">USD {s.fee}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="flex items-center justify-end gap-1">
              <MonedaToggle moneda={draft.moneda} onChange={(m) => setDraft((d) => ({ ...d, moneda: m }))} />
              <input type="number" min="0" value={draft.fee || ""}
                onChange={(e) => setDraft((d) => ({ ...d, fee: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                className="w-[80px] rounded-[6px] border border-line bg-paper px-2 py-1.5 text-right text-[13px] outline-none focus:border-ink/40" />
            </span>
            <span />
            <span />
            <span className="flex flex-col gap-1">
              <button type="button" onClick={guardar} disabled={!draft.nombre.trim()}
                className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-lime text-ink transition-opacity hover:opacity-80 disabled:opacity-30">
                <Check size={12} strokeWidth={2.4} />
              </button>
              <button type="button" onClick={() => setMostrarForm(false)}
                className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-line text-ink-3 transition-colors hover:bg-paper">
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          </div>
        )}

        {clientes.length === 0 && !mostrarForm && (
          <div className="py-10 text-center">
            <p className="text-[13px] text-ink-3">Sin clientes este mes.</p>
            <button type="button" onClick={() => setMostrarForm(true)}
              className="mt-2 text-[12.5px] text-ink-3 underline underline-offset-2 hover:text-ink">
              Agregar el primero
            </button>
          </div>
        )}

        {clientes.map((c, i) => {
          const { texto, clase } = COBRO_CFG[c.estadoCobro];
          return (
            <div key={c.id} className={["group grid grid-cols-[1fr_160px_120px_120px_32px] items-center px-5 py-3.5 transition-colors hover:bg-paper", (i > 0 || mostrarForm) ? "border-t border-line-soft" : ""].join(" ")}>
              <NombreInput valor={c.nombre} onGuardar={(n) => onUpdate(c.id, { nombre: n })} />
              <span className="flex items-center justify-end gap-1">
                <MonedaToggle moneda={c.moneda} onChange={(m) => onUpdate(c.id, { moneda: m })} />
                <NumInput valor={c.fee} render={(v) => fmt(v, c.moneda)} onGuardar={(v) => onUpdate(c.id, { fee: v })} />
              </span>
              <span className="flex justify-end">
                <button type="button" onClick={() => { const idx = COBRO_CICLO.indexOf(c.estadoCobro); onUpdate(c.id, { estadoCobro: COBRO_CICLO[(idx + 1) % COBRO_CICLO.length] }); }}
                  className={`cursor-pointer rounded-chip px-2 py-0.5 text-[11.5px] font-bold transition-opacity hover:opacity-75 ${clase}`}>
                  {texto}
                </button>
              </span>
              <span className="flex justify-end">
                <DateInput valor={c.fechaPago}
                  onGuardar={(v) => onUpdate(c.id, { fechaPago: v || null, estadoCobro: v ? "al_dia" : c.estadoCobro })} />
              </span>
              <span className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => onEliminar(c.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors hover:bg-crit-bg hover:text-crit">
                  <Trash2 size={12} strokeWidth={2} />
                </button>
              </span>
            </div>
          );
        })}

        {clientes.length > 0 && (
          <div className="grid grid-cols-[1fr_160px_120px_120px_32px] items-center border-t-2 border-line bg-paper/40 px-5 py-3.5">
            <span className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">Total</span>
            <span className="text-right font-display tabular-nums">
              <span className="block text-[15px] font-bold">{fmtUSD(ingUSD)}</span>
              {ingARS > 0 && <span className="block text-[12px] text-ink-3">{fmtARS(ingARS)}</span>}
            </span>
            <span /><span /><span />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB EQUIPO
// ─────────────────────────────────────────────────────────────────────────────

function TabEquipo({ equipo, eqUSD, eqARS, onAgregar, onUpdate, onEliminar }: {
  equipo: EquipoEntry[]; eqUSD: number; eqARS: number;
  onAgregar: (e: Omit<EquipoEntry, "id">) => void;
  onUpdate:  (id: string, patch: Partial<EquipoEntry>) => void;
  onEliminar: (id: string) => void;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [draft, setDraft] = useState<{ nombre: string; rol: string; honorario: number; moneda: Moneda }>({
    nombre: "", rol: "", honorario: 0, moneda: "usd",
  });

  const nombresExistentes = new Set(equipo.map((p) => p.nombre));
  const sugerencias = equipoData.filter((p) => !nombresExistentes.has(p.nombre));

  function guardar() {
    if (!draft.nombre.trim()) return;
    onAgregar({ nombre: draft.nombre.trim(), rol: draft.rol, honorario: draft.honorario, moneda: draft.moneda, estado: "pendiente", fechaPago: null });
    setDraft({ nombre: "", rol: "", honorario: 0, moneda: "usd" });
    setMostrarForm(false);
  }

  const pagados = equipo.filter((p) => p.estado === "pagado").length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">
          Equipo
          <span className="ml-1.5 text-[12px] normal-case tabular-nums">· {pagados}/{equipo.length} pagados</span>
        </h2>
        <span className="ml-auto font-display text-[13px] tabular-nums text-ink-2">{fmtUSD(eqUSD)}</span>
        <button type="button" onClick={() => setMostrarForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:border-ink-3/50 hover:bg-paper">
          <Plus size={13} strokeWidth={2.4} /> Agregar persona
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-card">
        <div className="grid grid-cols-[1fr_160px_110px_120px_32px] border-b border-line bg-paper/70 px-5 py-2.5">
          {["Persona", "Honorario mensual", "Estado", "Fecha de pago", ""].map((col, i) => (
            <span key={i} className={["font-display text-[11px] uppercase tracking-[0.09em] text-ink-3", i > 0 && i < 4 ? "text-right" : ""].join(" ")}>{col}</span>
          ))}
        </div>

        {/* Fila nueva */}
        {mostrarForm && (
          <div className="grid grid-cols-[1fr_160px_110px_120px_32px] items-center gap-2 border-b border-line bg-lime-soft/30 px-5 py-3">
            <div className="relative">
              <input autoFocus value={draft.nombre} placeholder="Nombre…"
                onChange={(e) => {
                  const val = e.target.value;
                  setDraft((d) => ({ ...d, nombre: val }));
                  const match = equipoData.find((p) => p.nombre.toLowerCase() === val.toLowerCase());
                  if (match) setDraft((d) => ({ ...d, nombre: val, rol: match.rol }));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setMostrarForm(false); }}
                className="w-full rounded-[6px] border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-ink/40" />
              {sugerencias.length > 0 && draft.nombre === "" && (
                <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-line bg-paper shadow-lg">
                  {sugerencias.map((s) => (
                    <button key={s.id} type="button"
                      onClick={() => setDraft((d) => ({ ...d, nombre: s.nombre, rol: s.rol }))}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-line-soft">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-lime-soft text-[10px] font-bold text-ink">{s.inicial}</span>
                      <span className="text-[12.5px] font-bold">{s.nombre}</span>
                      <span className="ml-auto text-[11.5px] text-ink-3">{s.rol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="flex items-center justify-end gap-1">
              <MonedaToggle moneda={draft.moneda} onChange={(m) => setDraft((d) => ({ ...d, moneda: m }))} />
              <input type="number" min="0" value={draft.honorario || ""}
                onChange={(e) => setDraft((d) => ({ ...d, honorario: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                className="w-[80px] rounded-[6px] border border-line bg-paper px-2 py-1.5 text-right text-[13px] outline-none focus:border-ink/40" />
            </span>
            <span /><span />
            <span className="flex flex-col gap-1">
              <button type="button" onClick={guardar} disabled={!draft.nombre.trim()}
                className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-lime text-ink transition-opacity hover:opacity-80 disabled:opacity-30">
                <Check size={12} strokeWidth={2.4} />
              </button>
              <button type="button" onClick={() => setMostrarForm(false)}
                className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-line text-ink-3 transition-colors hover:bg-paper">
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          </div>
        )}

        {equipo.length === 0 && !mostrarForm && (
          <div className="py-10 text-center">
            <p className="text-[13px] text-ink-3">Sin personas este mes.</p>
            <button type="button" onClick={() => setMostrarForm(true)}
              className="mt-2 text-[12.5px] text-ink-3 underline underline-offset-2 hover:text-ink">
              Agregar la primera
            </button>
          </div>
        )}

        {equipo.map((p, i) => {
          const { texto, clase } = PAGO_CFG[p.estado];
          return (
            <div key={p.id} className={["group grid grid-cols-[1fr_160px_110px_120px_32px] items-center px-5 py-4 transition-colors hover:bg-paper", (i > 0 || mostrarForm) ? "border-t border-line-soft" : ""].join(" ")}>
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-lime-soft text-[10px] font-bold text-ink">
                  {p.nombre.charAt(0).toUpperCase()}
                </span>
                <span>
                  <NombreInput valor={p.nombre} onGuardar={(n) => onUpdate(p.id, { nombre: n })} />
                  <span className="block text-[11.5px] text-ink-3">{p.rol}</span>
                </span>
              </span>
              <span className="flex items-center justify-end gap-1">
                <MonedaToggle moneda={p.moneda} onChange={(m) => onUpdate(p.id, { moneda: m })} />
                <NumInput valor={p.honorario} render={(v) => fmt(v, p.moneda)} onGuardar={(v) => onUpdate(p.id, { honorario: v })} />
              </span>
              <span className="flex justify-end">
                <button type="button" onClick={() => { const idx = PAGO_CICLO.indexOf(p.estado); onUpdate(p.id, { estado: PAGO_CICLO[(idx + 1) % PAGO_CICLO.length] }); }}
                  className={`cursor-pointer rounded-chip px-2 py-0.5 text-[11.5px] font-bold transition-opacity hover:opacity-75 ${clase}`}>
                  {texto}
                </button>
              </span>
              <span className="flex justify-end">
                <DateInput valor={p.fechaPago}
                  onGuardar={(v) => onUpdate(p.id, { fechaPago: v || null, estado: v ? "pagado" : p.estado })} />
              </span>
              <span className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => onEliminar(p.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors hover:bg-crit-bg hover:text-crit">
                  <Trash2 size={12} strokeWidth={2} />
                </button>
              </span>
            </div>
          );
        })}

        {equipo.length > 0 && (
          <div className="grid grid-cols-[1fr_160px_110px_120px_32px] items-center border-t-2 border-line bg-paper/40 px-5 py-3.5">
            <span className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">Total</span>
            <span className="text-right font-display tabular-nums">
              <span className="block text-[15px] font-bold">{fmtUSD(eqUSD)}</span>
              {eqARS > 0 && <span className="block text-[12px] text-ink-3">{fmtARS(eqARS)}</span>}
            </span>
            <span /><span /><span />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB GASTOS
// ─────────────────────────────────────────────────────────────────────────────

function TabGastos({ gastos, gstUSD, gstARS, onAgregar, onUpdate, onEliminar }: {
  gastos: GastoEntry[]; gstUSD: number; gstARS: number;
  onAgregar: (g: Omit<GastoEntry, "id">) => void;
  onUpdate:  (id: string, patch: Partial<GastoEntry>) => void;
  onEliminar: (id: string) => void;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [draft, setDraft] = useState<Omit<GastoEntry, "id">>({
    nombre: "", monto: 0, moneda: "usd", categoria: "operativo", recurrente: false,
  });
  const nombreRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (mostrarForm) nombreRef.current?.focus(); }, [mostrarForm]);

  function guardar() {
    if (!draft.nombre.trim() || draft.monto <= 0) return;
    onAgregar(draft);
    setDraft({ nombre: "", monto: 0, moneda: "usd", categoria: "operativo", recurrente: false });
    setMostrarForm(false);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">
          Gastos del mes
          <span className="ml-1.5 text-[12px] normal-case tabular-nums">· {gastos.length} items</span>
        </h2>
        <span className="ml-auto font-display text-[13px] tabular-nums text-ink-2">{fmtUSD(gstUSD)}</span>
        <button type="button" onClick={() => setMostrarForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:border-ink-3/50 hover:bg-paper">
          <Plus size={13} strokeWidth={2.4} /> Agregar gasto
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-card">
        <div className="grid grid-cols-[1fr_130px_150px_70px_32px] border-b border-line bg-paper/70 px-5 py-2.5">
          {["Concepto", "Categoría", "Monto", "Tipo", ""].map((col, i) => (
            <span key={i} className={["font-display text-[11px] uppercase tracking-[0.09em] text-ink-3", i > 0 && i < 4 ? "text-right" : ""].join(" ")}>{col}</span>
          ))}
        </div>

        {mostrarForm && (
          <div className="grid grid-cols-[1fr_130px_150px_70px_32px] items-center gap-2 border-b border-line bg-lime-soft/30 px-5 py-3">
            <input ref={nombreRef} value={draft.nombre} placeholder="Nombre del gasto…"
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setMostrarForm(false); }}
              className="rounded-[6px] border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-ink/40" />
            <span className="flex justify-end">
              <select value={draft.categoria} onChange={(e) => setDraft((d) => ({ ...d, categoria: e.target.value as CategoriaGasto }))}
                className="rounded-[6px] border border-line bg-paper px-2 py-1.5 text-[12px] outline-none focus:border-ink/40">
                {CAT_OPCIONES.map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </span>
            <span className="flex items-center justify-end gap-1">
              <MonedaToggle moneda={draft.moneda} onChange={(m) => setDraft((d) => ({ ...d, moneda: m }))} />
              <input type="number" min="0" value={draft.monto || ""}
                onChange={(e) => setDraft((d) => ({ ...d, monto: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                className="w-[75px] rounded-[6px] border border-line bg-paper px-2 py-1.5 text-right text-[13px] outline-none focus:border-ink/40" />
            </span>
            <span className="flex justify-end">
              <button type="button" onClick={() => setDraft((d) => ({ ...d, recurrente: !d.recurrente }))}
                className={["flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[11px] transition-colors",
                  draft.recurrente ? "bg-line-soft text-ink-3" : "text-ink-3/30 hover:bg-line-soft hover:text-ink-3"].join(" ")}>
                <RefreshCw size={10} strokeWidth={2.2} /> Fijo
              </button>
            </span>
            <span className="flex flex-col gap-1">
              <button type="button" onClick={guardar} disabled={!draft.nombre.trim() || draft.monto <= 0}
                className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-lime text-ink transition-opacity hover:opacity-80 disabled:opacity-30">
                <Check size={12} strokeWidth={2.4} />
              </button>
              <button type="button" onClick={() => setMostrarForm(false)}
                className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-line text-ink-3 transition-colors hover:bg-paper">
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          </div>
        )}

        {gastos.length === 0 && !mostrarForm && (
          <div className="py-10 text-center">
            <p className="text-[13px] text-ink-3">Sin gastos este mes.</p>
            <button type="button" onClick={() => setMostrarForm(true)}
              className="mt-2 text-[12.5px] text-ink-3 underline underline-offset-2 hover:text-ink">
              Agregar el primero
            </button>
          </div>
        )}

        {gastos.map((g, i) => {
          const { texto, clase } = CATEGORIA_CFG[g.categoria];
          return (
            <div key={g.id} className={["group grid grid-cols-[1fr_130px_150px_70px_32px] items-center px-5 py-3.5 transition-colors hover:bg-paper", (i > 0 || mostrarForm) ? "border-t border-line-soft" : ""].join(" ")}>
              <NombreInput valor={g.nombre} onGuardar={(n) => onUpdate(g.id, { nombre: n })} />
              <span className="flex justify-end">
                <button type="button" onClick={() => { const idx = CAT_CICLO.indexOf(g.categoria); onUpdate(g.id, { categoria: CAT_CICLO[(idx + 1) % CAT_CICLO.length] }); }}
                  className={`cursor-pointer rounded-chip px-2 py-0.5 text-[11.5px] font-bold transition-opacity hover:opacity-75 ${clase}`}>
                  {texto}
                </button>
              </span>
              <span className="flex items-center justify-end gap-1">
                <MonedaToggle moneda={g.moneda} onChange={(m) => onUpdate(g.id, { moneda: m })} />
                <NumInput valor={g.monto} render={(v) => fmt(v, g.moneda)} onGuardar={(v) => onUpdate(g.id, { monto: v })} />
              </span>
              <span className="flex justify-end">
                <button type="button" onClick={() => onUpdate(g.id, { recurrente: !g.recurrente })}
                  className={["flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[11px] transition-colors",
                    g.recurrente ? "bg-line-soft text-ink-3 hover:bg-line" : "text-ink-3/30 hover:bg-line-soft hover:text-ink-3"].join(" ")}>
                  <RefreshCw size={10} strokeWidth={2.2} />Fijo
                </button>
              </span>
              <span className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => onEliminar(g.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors hover:bg-crit-bg hover:text-crit">
                  <Trash2 size={12} strokeWidth={2} />
                </button>
              </span>
            </div>
          );
        })}

        {gastos.length > 0 && (
          <div className="grid grid-cols-[1fr_130px_150px_70px_32px] items-center border-t-2 border-line bg-paper/40 px-5 py-3.5">
            <span className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">Total</span>
            <span />
            <span className="text-right font-display tabular-nums">
              <span className="block text-[15px] font-bold">{fmtUSD(gstUSD)}</span>
              {gstARS > 0 && <span className="block text-[12px] text-ink-3">{fmtARS(gstARS)}</span>}
            </span>
            <span /><span />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB HISTORIAL
// ─────────────────────────────────────────────────────────────────────────────

function TabHistorial({ ingUSD, eqUSD, gstUSD }: { ingUSD: number; eqUSD: number; gstUSD: number }) {
  const mesActual: MesHistorial = {
    mes: MES_ACTUAL, ingresos: ingUSD, gastoEquipo: eqUSD,
    gastosOp: gstUSD, resultado: ingUSD - eqUSD - gstUSD,
  };
  const todos = [...HISTORIAL_PASADO, mesActual];

  return (
    <div>
      <TabHeader titulo="Historial mensual" meta={`${todos.length} meses`} />
      <div className="overflow-hidden rounded-card border border-line bg-card">
        <div className="grid grid-cols-[160px_1fr_1fr_1fr_1fr] border-b border-line bg-paper/70 px-5 py-2.5">
          {["Mes", "Ingresos", "Equipo", "Gastos op.", "Resultado"].map((col, i) => (
            <span key={col} className={["font-display text-[11px] uppercase tracking-[0.09em] text-ink-3", i > 0 ? "text-right" : ""].join(" ")}>{col}</span>
          ))}
        </div>
        {todos.map((mes, i) => {
          const prev     = todos[i - 1];
          const esActual = mes.mes === MES_ACTUAL;
          const diff     = prev ? mes.resultado - prev.resultado : 0;
          return (
            <div key={mes.mes} className={[
              "grid grid-cols-[160px_1fr_1fr_1fr_1fr] items-center px-5 py-3.5",
              i > 0 ? "border-t border-line-soft" : "",
              esActual ? "bg-lime-soft/40" : "transition-colors hover:bg-paper",
            ].join(" ")}>
              <span className="flex items-center gap-2">
                <span className="text-[13.5px] font-bold">{nombreMes(mes.mes)}</span>
                {esActual && <span className="rounded-chip bg-lime px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink">actual</span>}
              </span>
              <span className="text-right font-display text-[13.5px] tabular-nums">{fmtUSD(mes.ingresos)}</span>
              <span className="text-right font-display text-[13.5px] tabular-nums text-ink-3">− {fmtUSD(mes.gastoEquipo)}</span>
              <span className="text-right font-display text-[13.5px] tabular-nums text-ink-3">− {fmtUSD(mes.gastosOp)}</span>
              <span className="flex items-center justify-end gap-1.5">
                {prev && diff > 0 && <TrendingUp   size={13} strokeWidth={2} className="text-ok"    />}
                {prev && diff < 0 && <TrendingDown  size={13} strokeWidth={2} className="text-crit"  />}
                {prev && diff === 0 && <Minus       size={13} strokeWidth={2} className="text-ink-3" />}
                <span className={["font-display text-[14px] font-bold tabular-nums", mes.resultado >= 0 ? "text-ok" : "text-crit"].join(" ")}>
                  {fmtUSD(mes.resultado)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function NumInput({ valor, render, onGuardar }: {
  valor: number; render: (v: number) => string; onGuardar: (v: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft]       = useState(String(valor));

  function confirmar() {
    const n = parseFloat(draft.replace(/[^0-9.]/g, ""));
    if (!isNaN(n)) onGuardar(n);
    setEditando(false);
  }

  if (editando) {
    return (
      <input autoFocus type="number" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setEditando(false); }}
        className="w-[90px] rounded-[6px] border border-ink/30 bg-paper px-2 py-0.5 text-right text-[13px] outline-none focus:border-ink" />
    );
  }

  return (
    <button type="button" onClick={() => { setDraft(String(valor)); setEditando(true); }}
      className="group/num inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 font-display text-[13.5px] tabular-nums transition-colors hover:bg-line-soft"
      title="Click para editar">
      {render(valor)}
      <Pencil size={11} strokeWidth={2} className="text-ink-3 opacity-0 transition-opacity group-hover/num:opacity-100" />
    </button>
  );
}

function NombreInput({ valor, onGuardar }: { valor: string; onGuardar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft]       = useState(valor);

  function confirmar() { if (draft.trim()) onGuardar(draft.trim()); setEditando(false); }

  if (editando) {
    return (
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setEditando(false); }}
        className="w-full max-w-[220px] rounded-[6px] border border-ink/30 bg-paper px-2 py-0.5 text-[13px] outline-none focus:border-ink" />
    );
  }

  return (
    <button type="button" onClick={() => { setDraft(valor); setEditando(true); }}
      className="group/nom inline-flex items-center gap-1 rounded-[6px] px-1 py-0.5 text-[14px] font-bold transition-colors hover:bg-line-soft">
      {valor}
      <Pencil size={11} strokeWidth={2} className="text-ink-3 opacity-0 transition-opacity group-hover/nom:opacity-100" />
    </button>
  );
}

function DateInput({ valor, onGuardar }: { valor: string | null; onGuardar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editando) inputRef.current?.showPicker?.(); }, [editando]);

  if (editando) {
    return (
      <input ref={inputRef} type="date" defaultValue={valor ?? ""} autoFocus
        onChange={(e) => { onGuardar(e.target.value); setEditando(false); }}
        onBlur={() => setEditando(false)}
        className="w-[112px] rounded-[6px] border border-ink/30 bg-paper px-2 py-0.5 text-[12.5px] outline-none focus:border-ink" />
    );
  }

  return (
    <button type="button" onClick={() => setEditando(true)}
      className={["group/date inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[13px] tabular-nums transition-colors hover:bg-line-soft", valor ? "text-ink" : "text-ink-3/50"].join(" ")}>
      {fechaCorta(valor)}
      <Pencil size={11} strokeWidth={2} className="text-ink-3 opacity-0 transition-opacity group-hover/date:opacity-100" />
    </button>
  );
}

function MonedaToggle({ moneda, onChange }: { moneda: Moneda; onChange: (m: Moneda) => void }) {
  return (
    <button type="button" onClick={() => onChange(moneda === "usd" ? "ars" : "usd")}
      className="rounded-[5px] px-1 py-0.5 text-[10px] font-bold uppercase text-ink-3 transition-colors hover:bg-line-soft hover:text-ink">
      {moneda}
    </button>
  );
}

function ResumenCard({ titulo, usdVal, arsVal, esNeto = false }: {
  titulo: string; usdVal: number; arsVal: number | null; esNeto?: boolean;
}) {
  const usdColor = esNeto ? (usdVal >= 0 ? "text-ok" : "text-crit") : "text-ink";
  const arsColor = esNeto ? ((arsVal ?? 0) >= 0 ? "text-ok" : "text-crit") : "text-ink-3";
  return (
    <div className={["rounded-card border px-4 py-4", esNeto && usdVal >= 0 ? "border-ok/30 bg-ok-bg" : "border-line bg-card"].join(" ")}>
      <p className="mb-3 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">{titulo}</p>
      <p className={`font-display text-[21px] tabular-nums leading-none ${usdColor}`}>
        {usdVal < 0 ? "− " : ""}{fmtUSD(Math.abs(usdVal))}
      </p>
      {arsVal !== null && (
        <p className={`mt-1.5 text-[13px] tabular-nums ${arsColor}`}>
          {arsVal < 0 ? "− " : ""}{fmtARS(Math.abs(arsVal))}
        </p>
      )}
    </div>
  );
}

function TabHeader({ titulo, meta }: { titulo: string; meta?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="font-display text-[13px] uppercase tracking-[0.09em] text-ink-3">
        {titulo}
        {meta && <span className="ml-1.5 text-[12px] normal-case tabular-nums">· {meta}</span>}
      </h2>
    </div>
  );
}

function SinAcceso() {
  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] leading-none">Finanzas</h1>
        <span className="flex items-center gap-1.5 rounded-chip border border-line-soft bg-line-soft px-2.5 py-1.5 text-[12px] text-ink-3">
          <Lock size={12} strokeWidth={2.2} />
          Solo Cami y Maru
        </span>
      </header>
      <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-line bg-card p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-line-soft text-ink-3">
          <Lock size={18} strokeWidth={2} />
        </span>
        <div>
          <p className="text-[15px] font-bold text-ink">No tenés acceso a esta sección.</p>
          <p className="mt-1 max-w-[44ch] text-[13.5px] leading-relaxed text-ink-2">
            Pedile a Cami o Maru que te habiliten el acceso desde el menú de tres puntos en la página de Finanzas.
          </p>
        </div>
      </div>
    </div>
  );
}
