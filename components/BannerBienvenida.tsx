"use client";

import { useEffect, useState } from "react";
import { X, PartyPopper } from "lucide-react";

// Banner temporal de lanzamiento de Mango OS — se muestra solo el día del
// lanzamiento (21/8/2026) y se puede cerrar. Sacar este componente después
// de esa fecha si ya no hace falta.
const FECHA_LANZAMIENTO = "2026-08-21";
const KEY_CERRADO = `mango-banner-bienvenida-${FECHA_LANZAMIENTO}`;

function hoyEsElDia(): boolean {
  return new Date().toISOString().slice(0, 10) === FECHA_LANZAMIENTO;
}

export default function BannerBienvenida() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hoyEsElDia()) return;
    if (localStorage.getItem(KEY_CERRADO) === "1") return;
    setVisible(true);
  }, []);

  function cerrar() {
    localStorage.setItem(KEY_CERRADO, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-card border border-lime/30 bg-lime-soft/30 px-5 py-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-lime text-ink">
        <PartyPopper size={16} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold leading-snug text-ink">¡Bienvenidos a Mango OS!</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">
          Arrancamos a usar el dashboard nuevo del equipo. Cualquier cosa que veas rara, o idea para mejorarlo, contámela — se arma mejor entre todos 🙂
        </p>
      </div>
      <button
        type="button"
        onClick={cerrar}
        title="Cerrar"
        className="shrink-0 rounded-[8px] p-1 text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
