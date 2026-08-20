import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { emailHtml, lista } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// Corre Lun/Mié/Vie a las 13:00 (configurado en vercel.json).
// Avisa al account manager si algún cliente activo no tuvo contacto hoy.
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const db = createServerClient();

  const { data: clientes } = await db
    .from("clientes")
    .select("id, nombre, responsable")
    .eq("interno", false);

  if (!clientes?.length) return NextResponse.json({ enviados: 0 });

  const { data: contactosHoy } = await db
    .from("contacto_log")
    .select("cliente_id")
    .eq("fecha", hoy);

  const conContacto = new Set((contactosHoy ?? []).map((c) => c.cliente_id));
  const sinContacto = clientes.filter((c) => !conContacto.has(c.id));

  if (!sinContacto.length) {
    return NextResponse.json({ enviados: 0, motivo: "Todos contactados" });
  }

  const responsableIds = [...new Set(sinContacto.map(c => c.responsable))];
  const [{ data: personas }, { data: prefs }] = await Promise.all([
    db.from("personas").select("id, nombre, email"),
    db.from("notif_prefs").select("persona_id, mail").in("persona_id", responsableIds).eq("tipo", "seguimiento"),
  ]);

  const emailDe: Record<string, string> = {};
  const nombreDe: Record<string, string> = {};
  for (const p of personas ?? []) {
    if (p.email) emailDe[p.id] = p.email;
    nombreDe[p.id] = p.nombre;
  }
  const prefMap = Object.fromEntries((prefs ?? []).map(p => [p.persona_id, p.mail]));

  const porResponsable: Record<string, typeof sinContacto> = {};
  for (const c of sinContacto) {
    if (!porResponsable[c.responsable]) porResponsable[c.responsable] = [];
    porResponsable[c.responsable].push(c);
  }

  let enviados = 0;
  for (const [responsableId, sus] of Object.entries(porResponsable)) {
    const email = emailDe[responsableId];
    if (!email) continue;
    if (prefMap[responsableId] === false) continue;

    const nombre = (nombreDe[responsableId] ?? "").split(" ")[0];
    const cantidad = sus.length;

    const html = emailHtml({
      saludo: `Hola ${nombre},`,
      titulo: `${cantidad} cliente${cantidad > 1 ? "s" : ""} sin contacto hoy`,
      urgencia: "warn",
      cuerpo: `
        <p style="margin:0 0 12px;">Lunes, miércoles y viernes el contacto con los clientes es obligatorio. Todavía no registraste contacto con:</p>
        ${lista(sus.map((c) => c.nombre))}
        <p style="margin:16px 0 0;font-size:13px;color:#5c7a75;">Registrá el contacto desde la ficha del cliente en Mango OS.</p>
      `,
      cta: { label: "Ver clientes", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}/clientes` },
    });

    await Promise.all([
      resend.emails.send({
        from: "Mango OS <noreply@comunidadmango.com>",
        to: email,
        subject: `⚠️ Seguimiento pendiente — ${cantidad} cliente${cantidad > 1 ? "s" : ""} sin contacto hoy`,
        html,
      }),
      db.from("notificaciones").insert({
        persona_id: responsableId,
        tipo: "seguimiento",
        texto: `${cantidad} cliente${cantidad > 1 ? "s" : ""} sin contacto hoy`,
        href: "/clientes",
      }),
    ]);
    enviados++;
  }

  return NextResponse.json({ enviados, sinContacto: sinContacto.length });
}
