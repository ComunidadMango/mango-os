import type { Senal } from "@/lib/data";

const color: Record<Senal, string> = {
  ok: "bg-ok",
  atencion: "bg-warn",
  critico: "bg-crit",
};

const etiqueta: Record<Senal, string> = {
  ok: "En orden",
  atencion: "Necesita atención",
  critico: "Crítico",
};

export default function Punto({ estado }: { estado: Senal }) {
  return (
    <span
      role="img"
      aria-label={etiqueta[estado]}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color[estado]}`}
    />
  );
}
