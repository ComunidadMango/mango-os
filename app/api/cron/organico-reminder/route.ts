import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

type EventoRow = {
  id: string;
  cliente_id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  tipo: string;
  red_social: string;
  creado_por: string;
  visibilidad: "equipo" | "personas";
  personas_ids: string[];
  completado: boolean;
  recordatorio: string;
  clientes: { nombre: string } | null;
};

type Persona = { id: string; nombre: string; mail: string | null };

function addDays(date: Date, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db  = createServerClient();
  const hoy = new Date();

  const fechaHoy    = addDays(hoy, 0);
  const fechaManana = addDays(hoy, 1);
  const fechaPasado = addDays(hoy, 2);

  const { data: eventos, error } = await db
    .from("eventos_organico")
    .select("*, clientes(nombre)")
    .eq("completado", false)
    .or([
      `and(recordatorio.eq.dia-del-evento,fecha.eq.${fechaHoy})`,
      `and(recordatorio.eq.dia-anterior,fecha.eq.${fechaManana})`,
      `and(recordatorio.eq.dos-dias-antes,fecha.eq.${fechaPasado})`,
    ].join(","));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!eventos?.length) return NextResponse.json({ ok: true, enviados: 0 });

  const { data: personas } = await db
    .from("personas")
    .select("id, nombre, mail");

  const mailDe = (id: string) =>
    (personas as Persona[] | null)?.find((p) => p.id === id)?.mail ?? null;

  let enviados = 0;

  for (const ev of eventos as EventoRow[]) {
    const clienteNombre = ev.clientes?.nombre ?? ev.cliente_id;
    const horaStr       = ev.hora ? ` a las ${ev.hora}` : "";
    const cuandoLabel   =
      ev.recordatorio === "dia-del-evento" ? "HOY"
      : ev.recordatorio === "dia-anterior" ? "mañana"
      : "en 2 días";

    let destinatarioIds: string[] = [];
    if (ev.visibilidad === "equipo") {
      destinatarioIds = (personas as Persona[] | null)?.map((p) => p.id) ?? [];
    } else {
      destinatarioIds = [...new Set([ev.creado_por, ...(ev.personas_ids ?? [])])];
    }

    for (const personaId of destinatarioIds) {
      const mail = mailDe(personaId);

      await Promise.all([
        db.from("notificaciones").insert({
          persona_id: personaId,
          tipo:       "seguimiento",
          texto:      `Publicación ${cuandoLabel}: ${ev.titulo} — ${clienteNombre} (${ev.tipo} / ${ev.red_social})`,
          href:       "/calendario",
        }),
        mail
          ? resend.emails.send({
              from:    "Mango OS <noreply@comunidadmango.com>",
              to:      mail,
              subject: `📅 Publicación ${cuandoLabel}: ${ev.titulo} — ${clienteNombre}`,
              html: `
<p>Hola,</p>
<p>Este es un recordatorio de una publicación programada:</p>
<table style="border-collapse:collapse;margin:16px 0">
  <tr><td style="padding:4px 12px 4px 0;color:#666">Cliente</td><td><strong>${clienteNombre}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Título</td><td><strong>${ev.titulo}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Fecha</td><td>${ev.fecha}${horaStr}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666">Tipo</td><td>${ev.tipo} en ${ev.red_social}</td></tr>
  ${ev.descripcion ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Descripción</td><td>${ev.descripcion}</td></tr>` : ""}
</table>
<p style="margin-top:24px;font-size:12px;color:#999">Mango OS · <a href="https://dashboard.comunidadmango.com/calendario">Ver calendario</a></p>
              `.trim(),
            })
          : Promise.resolve(),
      ]);

      enviados++;
    }
  }

  return NextResponse.json({ ok: true, enviados });
}
