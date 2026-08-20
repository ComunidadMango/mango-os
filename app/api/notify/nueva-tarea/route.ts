import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { emailHtml, tabla, fila, fmtFecha } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST — llamado desde DrawerTarea cuando se crea una tarea asignada a otra persona.
// Body: { titulo, descripcion?, clienteNombre?, vence?, responsableId, asignadoPorId }
export async function POST(req: Request) {
  const body = await req.json() as {
    titulo: string;
    descripcion?: string;
    clienteNombre?: string;
    vence?: string;
    responsableId: string;
    asignadoPorId: string;
  };

  if (!body.titulo || !body.responsableId || !body.asignadoPorId) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  // No notificar si la persona se asigna la tarea a sí misma
  if (body.responsableId === body.asignadoPorId) {
    return NextResponse.json({ ok: true, motivo: "auto-asignada" });
  }

  const db = createServerClient();
  const [{ data: personas }, { data: pref }] = await Promise.all([
    db.from("personas").select("id, nombre, email").in("id", [body.responsableId, body.asignadoPorId]),
    db.from("notif_prefs").select("mail").eq("persona_id", body.responsableId).eq("tipo", "asignada").maybeSingle(),
  ]);

  const responsable = personas?.find((p) => p.id === body.responsableId);
  const asigno = personas?.find((p) => p.id === body.asignadoPorId);

  if (!responsable?.email) {
    return NextResponse.json({ error: "Email del responsable no encontrado" }, { status: 404 });
  }

  // Si el usuario tiene la preferencia guardada y la tiene en false, no enviar
  if (pref !== null && pref.mail === false) {
    return NextResponse.json({ ok: true, motivo: "notif desactivada" });
  }

  const nombre = responsable.nombre.split(" ")[0];
  const quien = asigno?.nombre ?? "Alguien del equipo";

  const filas = [
    fila("Tarea", `<strong>${body.titulo}</strong>`),
    ...(body.descripcion ? [fila("Descripción", body.descripcion)] : []),
    ...(body.clienteNombre ? [fila("Cliente", body.clienteNombre)] : []),
    ...(body.vence ? [fila("Vence", fmtFecha(body.vence))] : []),
    fila("Asignada por", quien),
  ];

  const html = emailHtml({
    saludo: `Hola ${nombre},`,
    titulo: `${quien} te asignó una tarea`,
    urgencia: "info",
    cuerpo: `${tabla(...filas)}
      <p style="margin:16px 0 0;font-size:13px;color:#5c7a75;">Podés verla y actualizarla desde el panel de Tareas en Mango OS.</p>`,
    cta: { label: "Ver mis tareas", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}/tareas` },
  });

  await Promise.all([
    resend.emails.send({
      from: "Mango OS <noreply@comunidadmango.com>",
      to: responsable.email,
      subject: `Nueva tarea: ${body.titulo}`,
      html,
    }),
    db.from("notificaciones").insert({
      persona_id: body.responsableId,
      tipo: "asignada",
      texto: `${quien} te asignó una tarea: "${body.titulo}"`,
      href: "/tareas",
    }),
  ]);

  return NextResponse.json({ ok: true });
}
