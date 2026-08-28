import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import {
  clientes,
  notasDe,
  persona,
  seguimientoDe,
  tareasDe,
  reunionesDe,
  type Cliente,
  type Contacto,
  type Nota,
  type Tarea,
  type Reunion,
} from "@/lib/data";
import { createServerClient, type ClienteRow, type SeguimientoRow, type TareaRow, type NotaRow, type ReunionRow } from "@/lib/supabase";

import Card from "@/components/Card";
import Punto from "@/components/Punto";
import FichaDrawer from "@/components/FichaDrawer";
import SeguimientoSection from "@/components/SeguimientoSection";
import NotasSection from "@/components/NotasSection";
import ReunionesSection from "@/components/ReunionesSection";
import DriveClienteSection from "@/components/DriveClienteSection";

export const dynamic = "force-dynamic";

const estadoTarea: Record<string, { texto: string; clase: string }> = {
  pendiente:   { texto: "Pendiente",   clase: "bg-line-soft text-ink-2" },
  en_curso:    { texto: "En curso",    clase: "bg-warn-bg text-warn"    },
  en_revision: { texto: "En revisión", clase: "bg-lime-soft text-ink"   },
  hecha:       { texto: "Hecha",       clase: "bg-ok-bg text-ok"        },
};

function rowToCliente(r: ClienteRow): Cliente {
  return {
    id:             r.id,
    nombre:         r.nombre,
    rubro:          r.rubro,
    responsable:    r.responsable,
    mediaBuyer:     r.media_buyer ?? undefined,
    descripcion:    r.descripcion ?? undefined,
    fechaAlta:      r.fecha_alta ?? undefined,
    fee:            r.fee ?? undefined,
    interno:        r.interno,
    pauta:          { estado: r.pauta_estado as Cliente["pauta"]["estado"],       detalle: r.pauta_detalle    },
    relacion:       { estado: r.relacion_estado as Cliente["relacion"]["estado"], detalle: r.relacion_detalle },
    trabajo:        { estado: r.trabajo_estado as Cliente["trabajo"]["estado"],   detalle: r.trabajo_detalle  },
    ultimoContacto: r.ultimo_contacto,
  };
}

export default async function DetalleCliente(props: PageProps<"/clientes/[id]">) {
  const { id } = await props.params;

  // Intentar cargar desde Supabase (server-side)
  let c: Cliente | undefined;
  let contactos: Contacto[] = [];
  let notas: Nota[] = [];
  let tareas: Tarea[] = [];
  let reuniones: Reunion[] = [];

  try {
    const db = createServerClient();
    const [cRes, segRes, notasRes, tareasRes, reunionesRes] = await Promise.all([
      db.from("clientes").select("*").eq("id", id).single(),
      db.from("seguimiento").select("*").eq("cliente_id", id).order("fecha", { ascending: false }),
      db.from("notas").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
      db.from("tareas").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
      db.from("reuniones").select("*").eq("cliente_id", id).order("fecha", { ascending: false }),
    ]);

    if (cRes.data) c = rowToCliente(cRes.data as ClienteRow);

    contactos = (segRes.data ?? []).map((r: SeguimientoRow) => ({
      id: r.id, clienteId: r.cliente_id, fecha: r.fecha, quien: r.quien,
      canal: r.canal as Contacto["canal"], tono: r.tono as Contacto["tono"], resumen: r.resumen,
    }));

    notas = (notasRes.data ?? []).map((r: NotaRow) => ({
      id: r.id, clienteId: r.cliente_id, autor: r.autor,
      fecha: new Date(r.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
      texto: r.texto, menciones: r.menciones,
    }));

    tareas = (tareasRes.data ?? []).map((r: TareaRow) => ({
      id: r.id, titulo: r.titulo, descripcion: r.descripcion ?? undefined,
      estado: r.estado as Tarea["estado"], responsable: r.responsable,
      responsables: r.responsables?.length ? r.responsables : [r.responsable],
      completadosPor: r.completados_por ?? [],
      asignadaPor: r.asignada_por, clienteId: r.cliente_id ?? undefined,
      vence: r.vence ?? undefined, adjuntos: r.adjuntos,
    }));

    reuniones = (reunionesRes.data ?? []).map((r: ReunionRow) => ({
      id: r.id, clienteId: r.cliente_id, fecha: r.fecha, titulo: r.titulo,
      tipo: r.tipo as Reunion["tipo"], asistentes: r.asistentes,
      duracion: r.duracion ?? undefined, notas: r.notas ?? undefined,
      transcripcion: r.transcripcion ?? undefined,
    }));
  } catch {
    // Fallback a datos mock
  }

  // Si no se encontró en Supabase, buscar en mock
  if (!c) {
    c = clientes.find((x) => x.id === id);
    if (c) {
      contactos = seguimientoDe(id);
      notas     = notasDe(id);
      tareas    = tareasDe(id);
      reuniones = reunionesDe(id);
    }
  }

  if (!c) notFound();

  const resp = persona(c.responsable);
  const dias = c.ultimoContacto
    ? Math.round((Date.now() - new Date(c.ultimoContacto).getTime()) / 86_400_000)
    : null;

  return (
    <div className="mx-auto max-w-[1180px]">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Clientes
      </Link>

      <header className="mb-5 flex flex-wrap items-center gap-3">
        <span className="notch-sm flex h-12 w-12 items-center justify-center rounded-[15px] bg-lime text-[15px] font-bold text-ink">
          {c.nombre.slice(0, 2).toUpperCase()}
        </span>
        <div className="flex-1">
          <h1 className="font-display text-[28px] leading-none">{c.nombre}</h1>
          <p className="mt-1.5 text-[13px] text-ink-3">
            {c.rubro}
            {resp ? ` · lo atiende ${resp.nombre}` : ""}
            {dias !== null ? ` · último contacto hace ${dias} ${dias === 1 ? "día" : "días"}` : ""}
          </p>
        </div>
        <FichaDrawer cliente={c} />
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Pauta", c.pauta],
            ["Relación", c.relacion],
            ["Trabajo", c.trabajo],
          ] as const
        ).map(([etiqueta, señal]) => (
          <div
            key={etiqueta}
            className="rounded-card border border-line bg-card p-3.5 transition-colors hover:border-ink-3/35"
          >
            <p className="font-display text-[11px] uppercase tracking-[0.1em] text-ink-3">
              {etiqueta}
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-[13.5px]">
              <Punto estado={señal.estado} />
              {señal.detalle}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <SeguimientoSection contactos={contactos} clienteId={c.id} />
        </div>

        <div className="lg:col-span-3">
          <ReunionesSection reuniones={reuniones} clienteId={c.id} />
        </div>

        <NotasSection notas={notas} clienteId={c.id} />

        <Card titulo="Tareas" extra={`${tareas.filter((t) => t.estado !== "hecha").length} abiertas`} href="/tareas">
          {tareas.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-ink-3">Sin tareas asociadas</p>
          ) : (
            <ul className="flex flex-col">
              {tareas.map((t, i) => {
                const est = estadoTarea[t.estado];
                return (
                  <li
                    key={t.id}
                    className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-line-soft" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{t.titulo}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-3">
                        {persona(t.responsable)?.nombre}
                        {t.adjuntos > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip size={11} strokeWidth={2} />
                            {t.adjuntos}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-chip px-2 py-0.5 text-[10.5px] font-bold ${est.clase}`}
                    >
                      {est.texto}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <DriveClienteSection clienteId={c.id} clienteNombre={c.nombre} />
      </div>
    </div>
  );
}
