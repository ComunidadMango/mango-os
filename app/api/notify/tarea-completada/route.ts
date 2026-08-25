import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { emailHtml, tabla, fila } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST — llamado desde tareas/page.tsx cuando una tarea pasa a "hecha".
// Body: { titulo, responsableId, asignadoPorId }
// Envía email + notificación in-app a quien asignó la tarea.
export async function POST(req: Request) {
  const body = await req.json() as {
    titulo: string;
    responsableId: string;
    asignadoPorId: string;
  };

  if (!body.titulo || !body.responsableId || !body.asignadoPorId) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  if (body.responsableId === body.asignadoPorId) {
    return NextResponse.json({ ok: true, motivo: "auto-asignada" });
  }

  const db = createServerClient();
  const [{ data: personas }, { data: pref }] = await Promise.all([
    db.from("personas").select("id, nombre, email").in("id", [body.responsableId, body.asignadoPorId]),
    db.from("notif_prefs").select("mail").eq("persona_id", body.asignadoPorId).eq("tipo", "completada").maybeSingle(),
  ]);

  const responsable = personas?.find((p) => p.id === body.responsableId);
  const asigno      = personas?.find((p) => p.id === body.asignadoPorId);

  if (!asigno?.email) {
    return NextResponse.json({ error: "Email de quien asignó no encontrado" }, { status: 404 });
  }

  if (pref !== null && pref.mail === false) {
    return NextResponse.json({ ok: true, motivo: "notif desactivada" });
  }

  const nombre = asigno.nombre.split(" ")[0];
  const quien  = responsable?.nombre ?? "Alguien del equipo";

  const html = emailHtml({
    saludo:   `Hola ${nombre},`,
    titulo:   `${quien} completó una tarea`,
    urgencia: "info",
    cuerpo:   `${tabla(
      fila("Tarea",          `<strong>${body.titulo}</strong>`),
      fila("Completada por", quien),
    )}
    <p style="margin:16px 0 0;font-size:13px;color:#5c7a75;">Podés ver el detalle desde el panel de Tareas en Mango OS.</p>`,
    cta: { label: "Ver tareas", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}/tareas` },
  });

  await Promise.all([
    resend.emails.send({
      from:    "Mango OS <noreply@comunidadmango.com>",
      to:      asigno.email,
      subject: `Tarea completada: ${body.titulo}`,
      html,
    }),
    db.from("notificaciones").insert({
      persona_id: body.asignadoPorId,
      tipo:       "completada",
      texto:      `${quien} completó la tarea: "${body.titulo}"`,
      href:       "/tareas",
    }),
  ]);

  return NextResponse.json({ ok: true });
}
