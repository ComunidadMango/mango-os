import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { emailHtml, lista } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// Corre el día 5 de cada mes a las 13:00 (configurado en vercel.json).
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const mesActual = new Date().toISOString().slice(0, 7); // "2026-08"

  const { data: clientes } = await db
    .from("clientes")
    .select("id, nombre")
    .eq("interno", false)
    .order("nombre");

  const { data: reportes } = await db
    .from("reportes_mensuales")
    .select("cliente_id, entregado")
    .eq("mes", mesActual);

  const entregadosSet = new Set(
    (reportes ?? []).filter((r) => r.entregado).map((r) => r.cliente_id)
  );

  const pendientes = (clientes ?? []).filter((c) => !entregadosSet.has(c.id));
  const entregados = (clientes ?? []).filter((c) => entregadosSet.has(c.id));

  const { data: theo } = await db.from("personas").select("nombre, email").eq("id", "theo").single();
  const { data: cami } = await db.from("personas").select("nombre, email").eq("id", "cami").single();

  const mes = new Date().toLocaleString("es-AR", { month: "long" });
  const urgencia = pendientes.length === 0 ? "info" : "crit";
  const tituloEmail = pendientes.length === 0
    ? `¡Todos los reportes de ${mes} entregados!`
    : `${pendientes.length} reporte${pendientes.length > 1 ? "s" : ""} pendiente${pendientes.length > 1 ? "s" : ""} — vence hoy`;

  const bloques: string[] = [];
  if (entregados.length > 0) {
    bloques.push(
      `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1c6b52;">Entregados</p>`,
      lista(entregados.map((c) => c.nombre)),
    );
  }
  if (pendientes.length > 0) {
    if (bloques.length > 0) bloques.push(`<div style="height:16px;"></div>`);
    bloques.push(
      `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#a63d33;">Pendientes</p>`,
      lista(pendientes.map((c) => c.nombre)),
    );
  }

  const html = emailHtml({
    saludo: "Hola,",
    titulo: tituloEmail,
    urgencia,
    cuerpo: `${bloques.join("")}
      ${pendientes.length > 0
        ? `<p style="margin:16px 0 0;font-size:13px;color:#5c7a75;">Por favor entregá los pendientes a la brevedad.</p>`
        : ""}
    `,
    ...(pendientes.length > 0
      ? { cta: { label: "Ver clientes", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}/clientes` } }
      : {}),
  });

  const destinatarios = [theo?.email, cami?.email].filter(Boolean) as string[];
  for (const to of destinatarios) {
    await resend.emails.send({
      from: "Mango OS <noreply@comunidadmango.com>",
      to,
      subject: `Check reportes ${mes} — ${pendientes.length} pendiente${pendientes.length !== 1 ? "s" : ""}`,
      html,
    });
  }

  return NextResponse.json({ pendientes: pendientes.length, entregados: entregados.length });
}
