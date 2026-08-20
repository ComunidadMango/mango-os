import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { emailHtml, lista } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// Corre el día 1 de cada mes a las 13:00 (configurado en vercel.json).
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const { data: clientes } = await db
    .from("clientes")
    .select("id, nombre")
    .eq("interno", false)
    .order("nombre");

  const { data: theo } = await db
    .from("personas")
    .select("nombre, email")
    .eq("id", "theo")
    .single();

  if (!theo?.email) return NextResponse.json({ error: "Email de Theo no encontrado" }, { status: 500 });

  const mes = new Date().toLocaleString("es-AR", { month: "long" });
  const nombres = (clientes ?? []).map((c) => c.nombre);

  const html = emailHtml({
    saludo: `Hola ${theo.nombre.split(" ")[0]},`,
    titulo: `Arrancaron los reportes de ${mes}`,
    urgencia: "info",
    cuerpo: `
      <p style="margin:0 0 12px;">Estos son los clientes que necesitan reporte este mes:</p>
      ${lista(nombres)}
      <p style="margin:16px 0 0;font-size:13px;color:#5c7a75;">Tenés hasta el día 5 para entregarlos. Podés adjuntarlos desde la ficha de cada cliente en Mango OS.</p>
    `,
    cta: { label: "Ver clientes", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}/clientes` },
  });

  await resend.emails.send({
    from: "Mango OS <noreply@comunidadmango.com>",
    to: theo.email,
    subject: `Reportes de ${mes} — arrancan hoy`,
    html,
  });

  return NextResponse.json({ ok: true, clientes: nombres.length });
}
