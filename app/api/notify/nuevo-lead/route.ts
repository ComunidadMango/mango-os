import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { emailHtml, tabla, fila } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST — llamado cuando un nuevo lead entra al pipeline (desde GHL webhook o desde el dashboard).
// Body: { nombre, empresa?, origen?, etapa?, responsableId? }
// Si no viene responsableId, notifica a Cami y Maru por defecto.
export async function POST(req: Request) {
  const body = await req.json() as {
    nombre: string;
    empresa?: string;
    origen?: string;
    etapa?: string;
    responsableId?: string;
  };

  if (!body.nombre) {
    return NextResponse.json({ error: "Falta nombre del lead" }, { status: 400 });
  }

  const db = createServerClient();

  // Destinatarios: responsable si viene, sino cami + maru (founders)
  const ids = body.responsableId
    ? [body.responsableId]
    : ["cami", "maru"];

  const { data: personas } = await db
    .from("personas")
    .select("id, nombre, email")
    .in("id", ids);

  const destinatarios = (personas ?? []).filter((p) => p.email);
  if (!destinatarios.length) {
    return NextResponse.json({ error: "No hay emails de destino" }, { status: 404 });
  }

  const filas = [
    fila("Lead", `<strong>${body.nombre}</strong>`),
    ...(body.empresa ? [fila("Empresa", body.empresa)] : []),
    ...(body.origen ? [fila("Origen", body.origen)] : []),
    ...(body.etapa ? [fila("Etapa", body.etapa)] : []),
  ];

  const html = emailHtml({
    saludo: "Hola,",
    titulo: `Nuevo lead en el pipeline: ${body.nombre}`,
    urgencia: "info",
    cuerpo: `${tabla(...filas)}
      <p style="margin:16px 0 0;font-size:13px;color:#5c7a75;">Revisalo y avanzá con el seguimiento desde el Pipeline en Mango OS.</p>`,
    cta: { label: "Ver pipeline", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}/pipeline` },
  });

  await Promise.all(
    destinatarios.flatMap((p) => [
      resend.emails.send({
        from: "Mango OS <noreply@comunidadmango.com>",
        to: p.email!,
        subject: `Nuevo lead: ${body.nombre}`,
        html,
      }),
      db.from("notificaciones").insert({
        persona_id: p.id,
        tipo: "nuevo-lead",
        texto: `Nuevo lead en el pipeline: ${body.nombre}`,
        href: "/pipeline",
      }),
    ])
  );

  return NextResponse.json({ ok: true, enviados: destinatarios.length });
}
