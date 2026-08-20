import EquipoWidget from "@/components/EquipoWidget";
import CalendarioWidget from "@/components/CalendarioWidget";
import MisTareasWidget from "@/components/MisTareasWidget";
import AlertasWidget from "@/components/AlertasWidget";
import SeguimientoHoyWidget from "@/components/SeguimientoHoyWidget";

// ─────────────────────────────────────────────────────────────────────────────

export default function Inicio() {
  return (
    <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-2">

      {/* 1 — Alertas */}
      <div className="lg:col-span-2">
        <AlertasWidget />
      </div>

      {/* 2 — El equipo hoy */}
      <div className="lg:col-span-2">
        <EquipoWidget />
      </div>

      {/* 3a — Mis tareas (carousel personal / asignadas) */}
      <MisTareasWidget />

      {/* 3b — Mi semana (Google Calendar) */}
      <CalendarioWidget />

      {/* 4 — Seguimiento de hoy */}
      <div className="lg:col-span-2">
        <SeguimientoHoyWidget />
      </div>


    </div>
  );
}
