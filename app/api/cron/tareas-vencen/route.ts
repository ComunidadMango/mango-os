import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { emailHtml, lista } from "@/lib/email";
import type { TareaRow } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

// Corre todos los días a las 09:00 (configurado en vercel.json).
// Avisa sobre tareas que vencen hoy y tareas ya vencidas (estado != hecha).
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const db = createServerClient();

  const { data: tareas } = await db
    .from("tareas")
    .select("id, titulo, vence, responsable, estado, cliente_id")
    .neq("estado", "hecha")
    .not("vence", "is", null)
    .lte("vence", hoy);

  if (!tareas?.length) return NextResponse.json({ enviados: 0, motivo: "sin tareas" });

  const vencenHoy = (tareas as TareaRow[]).filter((t) => t.vence === hoy);
  const vencidas  = (tareas as TareaRow[]).filter((t) => t.vence! < hoy);

  const { data: personas } = await db.from("personas").select("id, nombre, email");
  const emailDe: Record<string, string> = {};
  const nombreDe: Record<string, string> = {};
  for (const p of personas ?? []) {
    if (p.email) emailDe[p.id] = p.email;
    nombreDe[p.id] = p.nombre;
  }

  // Agrupar ambas listas por responsable
  const porResponsable: Record<string, { vencenHoy: TareaRow[]; vencidas: TareaRow[] }> = {};
  for (const t of tareas as TareaRow[]) {
    if (!porResponsable[t.responsable]) porResponsable[t.responsable] = { vencenHoy: [], vencidas: [] };
    if (t.vence === hoy) porResponsable[t.responsable].vencenHoy.push(t);
    else porResponsable[t.responsable].vencidas.push(t);
  }

  let enviados = 0;
  for (const [responsableId, { vencenHoy: hoyList, vencidas: vencList }] of Object.entries(porResponsable)) {
    const email = emailDe[responsableId];
    if (!email) continue;

    const nombre = (nombreDe[responsableId] ?? "").split(" ")[0];
    const totalCrit = vencList.length;
    const totalWarn = hoyList.length;

    const urgencia = totalCrit > 0 ? "crit" : "warn";
    const tituloEmail = totalCrit > 0
      ? `Tenés ${totalCrit} tarea${totalCrit > 1 ? "s" : ""} vencida${totalCrit > 1 ? "s" : ""}`
      : `Tenés ${totalWarn} tarea${totalWarn > 1 ? "s" : ""} que vence${totalWarn > 1 ? "n" : ""} hoy`;

    const bloques: string[] = [];

    if (vencList.length > 0) {
      bloques.push(
        `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#a63d33;">Vencidas</p>`,
        lista(vencList.map((t) => `${t.titulo} <span style="color:#5c7a75;font-size:12px;">(venció el ${t.vence})</span>`)),
      );
    }

    if (hoyList.length > 0) {
      if (bloques.length > 0) bloques.push(`<div style="height:16px;"></div>`);
      bloques.push(
        `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#d97706;">Vencen hoy</p>`,
        lista(hoyList.map((t) => t.titulo)),
      );
    }

    const html = emailHtml({
      saludo: `Hola ${nombre},`,
      titulo: tituloEmail,
      urgencia,
      cuerpo: bloques.join(""),
      cta: { label: "Ver mis tareas", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}/tareas` },
    });

    const notifRows = [
      ...vencList.map(t => ({
        persona_id: responsableId,
        tipo: "tarea-vencida",
        texto: `Tarea vencida: "${t.titulo}"`,
        href: "/tareas",
      })),
      ...hoyList.map(t => ({
        persona_id: responsableId,
        tipo: "tarea-vence-hoy",
        texto: `Vence hoy: "${t.titulo}"`,
        href: "/tareas",
      })),
    ];

    await Promise.all([
      resend.emails.send({
        from: "Mango OS <noreply@comunidadmango.com>",
        to: email,
        subject: tituloEmail,
        html,
      }),
      db.from("notificaciones").insert(notifRows),
    ]);
    enviados++;
  }

  return NextResponse.json({ enviados, vencenHoy: vencenHoy.length, vencidas: vencidas.length });
}
