"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, X, Check, CalendarDays } from "lucide-react";

type Prioridad = "alta" | "media" | "baja";
type Item = {
  id: string;
  texto: string;
  hecho: boolean;
  prioridad: Prioridad;
  creadoEn: string;         // ISO yyyy-mm-dd — cuándo se escribió
  vence: string | null;     // ISO yyyy-mm-dd — para cuándo hay que hacerla
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtCorta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const MESES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${MESES[m]}`;
}

const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];
const PRIORIDAD_ORDEN: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

const PRIORIDAD_CFG: Record<Prioridad, { label: string; clase: string }> = {
  alta:  { label: "Alta",  clase: "bg-crit/15 text-crit border border-crit/20"   },
  media: { label: "Media", clase: "bg-warn/15 text-warn border border-warn/20"   },
  baja:  { label: "Baja",  clase: "bg-line-soft text-ink-3 border border-line"   },
};

export default function MiTodo() {
  const [items, setItems] = useState<Item[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [menuPrioridadId, setMenuPrioridadId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuPrioridadId) return;
    function cerrar() { setMenuPrioridadId(null); }
    document.addEventListener("click", cerrar);
    return () => document.removeEventListener("click", cerrar);
  }, [menuPrioridadId]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mango-todo");
      if (stored) {
        const parsed = JSON.parse(stored) as Item[];
        // Compatibilidad con items viejos sin prioridad/fechas
        setItems(parsed.map((i) => ({
          ...i,
          prioridad: i.prioridad ?? ("media" as Prioridad),
          creadoEn:  i.creadoEn ?? hoyISO(),
          vence:     i.vence ?? null,
        })));
      }
    } catch {}
  }, []);

  function guardar(lista: Item[]) {
    setItems(lista);
    localStorage.setItem("mango-todo", JSON.stringify(lista));
  }

  function agregar() {
    const texto = nuevo.trim();
    if (!texto) return;
    guardar([...items, {
      id: `td-${Date.now()}`, texto, hecho: false, prioridad: "media",
      creadoEn: hoyISO(), vence: null,
    }]);
    setNuevo("");
    inputRef.current?.focus();
  }

  function setVence(id: string, fecha: string) {
    guardar(items.map((i) => (i.id === id ? { ...i, vence: fecha || null } : i)));
  }

  function toggle(id: string) {
    guardar(items.map((i) => (i.id === id ? { ...i, hecho: !i.hecho } : i)));
  }

  function eliminar(id: string) {
    guardar(items.filter((i) => i.id !== id));
  }

  function setPrioridad(id: string, prioridad: Prioridad) {
    guardar(items.map((i) => (i.id === id ? { ...i, prioridad } : i)));
    setMenuPrioridadId(null);
  }

  const pendientes = [...items.filter((i) => !i.hecho)].sort(
    (a, b) => PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad]
  );
  const hechos = items.filter((i) => i.hecho);

  return (
    <div className="mx-auto max-w-[600px]">
      <header className="mb-6">
        <h1 className="font-display text-[28px] leading-none">Mi to-do</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">Tu lista personal · ordenada por prioridad</p>
      </header>

      {/* Agregar ítem */}
      <div className="mb-6 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          autoFocus
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="Agregar ítem..."
          className="flex-1 rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink-3"
        />
        <button
          type="button"
          onClick={agregar}
          disabled={!nuevo.trim()}
          className="flex items-center gap-1.5 rounded-[10px] bg-lime px-3.5 py-2.5 text-[13px] font-bold text-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={15} strokeWidth={2.4} />
          Agregar
        </button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line py-12 text-center text-[13.5px] text-ink-3">
          Tu lista está vacía. Escribí algo arriba y presioná Enter.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Pendientes — ordenados por prioridad */}
          {pendientes.map((item) => {
            const { label, clase } = PRIORIDAD_CFG[item.prioridad];
            const vencida = item.vence !== null && item.vence < hoyISO();
            return (
              <div
                key={item.id}
                className="group flex flex-col gap-1.5 rounded-card border border-line bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-line transition-colors hover:border-ok hover:bg-ok/10"
                  />

                  {/* Badge de prioridad — click abre el menú con las 3 opciones */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setMenuPrioridadId((v) => (v === item.id ? null : item.id)); }}
                      title="Elegir prioridad"
                      className={`rounded-[5px] px-1.5 py-px text-[10.5px] font-bold transition-opacity hover:opacity-70 ${clase}`}
                    >
                      {label}
                    </button>

                    {menuPrioridadId === item.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-full z-20 mt-1 w-[110px] overflow-hidden rounded-[10px] border border-line bg-paper shadow-xl"
                      >
                        {PRIORIDADES.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPrioridad(item.id, p)}
                            className={[
                              "flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-line-soft",
                              p === item.prioridad ? "font-bold text-ink" : "text-ink-2",
                            ].join(" ")}
                          >
                            {PRIORIDAD_CFG[p].label}
                            {p === item.prioridad && <Check size={12} strokeWidth={2.5} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="flex-1 text-[14px] text-ink">{item.texto}</span>

                  <button
                    type="button"
                    onClick={() => eliminar(item.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-line-soft hover:text-crit"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Fechas: cuándo se escribió + para cuándo hay que hacerla */}
                <div className="flex items-center gap-3 pl-8 text-[11.5px] text-ink-3">
                  <span>Escrita el {fmtCorta(item.creadoEn)}</span>
                  <label className={`flex cursor-pointer items-center gap-1 transition-colors hover:text-ink-2 ${vencida ? "font-bold text-crit" : ""}`}>
                    <CalendarDays size={12} strokeWidth={2} />
                    {item.vence ? `Vence ${fmtCorta(item.vence)}` : "Poner fecha"}
                    <input
                      type="date"
                      value={item.vence ?? ""}
                      onChange={(e) => setVence(item.id, e.target.value)}
                      className="absolute h-0 w-0 opacity-0"
                    />
                  </label>
                </div>
              </div>
            );
          })}

          {/* Completadas */}
          {hechos.length > 0 && (
            <>
              <p className="mb-1 mt-4 font-display text-[11px] uppercase tracking-[0.09em] text-ink-3">
                Completadas · {hechos.length}
              </p>
              {hechos.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 rounded-card border border-line bg-card px-4 py-3 opacity-50"
                >
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-ok/20 text-ok transition-colors hover:bg-ok/10"
                  >
                    <Check size={12} strokeWidth={2.5} />
                  </button>
                  <span className="flex-1 text-[14px] text-ink-2 line-through">{item.texto}</span>
                  <button
                    type="button"
                    onClick={() => eliminar(item.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-line-soft hover:text-crit"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
