"use client";

import { useState } from "react";
import { X, Send } from "lucide-react";

type Mensaje = { de: "manguito" | "yo"; texto: string };

const conversacion: Mensaje[] = [
  {
    de: "manguito",
    texto:
      "Hola Maru. Casa Praga subió 34% el costo por resultado desde el lunes — la frecuencia del conjunto principal llegó a 3,8. ¿Querés que le arme el resumen a Theo?",
  },
  { de: "yo", texto: "Sí, mandáselo con las 3 campañas más afectadas." },
  { de: "manguito", texto: "Dale, se lo mando ahora y te aviso cuando lo lea." },
];

export default function Manguito() {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-[14px] bg-ink py-3 pl-3 pr-4 text-[13.5px] font-medium text-paper shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <span className="notch-sm block h-6 w-6 rounded-lg bg-lime" />
        Manguito
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex max-h-[540px] w-[360px] flex-col overflow-hidden rounded-[14px] border border-line bg-card shadow-xl">
      <div className="flex items-center gap-2.5 bg-ink px-4 py-3">
        <span className="notch-sm block h-6 w-6 rounded-lg bg-lime" />
        <span className="font-display text-[15px] text-paper">Manguito</span>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar Manguito"
          className="ml-auto rounded-lg p-1 text-paper/70 transition-colors hover:bg-white/12 hover:text-paper"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {conversacion.map((m, i) => (
          <div
            key={i}
            className={[
              "max-w-[85%] rounded-[13px] px-3.5 py-2.5 text-[13.5px] leading-relaxed",
              m.de === "yo"
                ? "self-end rounded-br-[4px] bg-ink text-paper"
                : "self-start rounded-bl-[4px] border border-line bg-paper text-ink",
            ].join(" ")}
          >
            {m.texto}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-line p-3">
        <input
          placeholder="Preguntale algo sobre cualquier cliente…"
          className="min-w-0 flex-1 rounded-[10px] border border-line bg-paper px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-ink-3 focus:border-ink"
        />
        <button
          type="button"
          aria-label="Enviar"
          className="rounded-[10px] bg-lime p-2.5 text-ink transition-opacity hover:opacity-85"
        >
          <Send size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
