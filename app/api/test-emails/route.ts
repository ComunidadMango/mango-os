import { NextResponse } from "next/server";
import { Resend } from "resend";
import { emailHtml, tabla, fila, fmtFecha, lista } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);
const DEST = "maria@comunidadmango.com";
const APP  = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com";

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resultados: string[] = [];

  // 1 — Nueva tarea asignada
  await resend.emails.send({
    from: "Mango OS <noreply@comunidadmango.com>",
    to: DEST,
    subject: "[TEST] Nueva tarea: Brief conjunto 1 — sale EasyLiving",
    html: emailHtml({
      saludo: "Hola Maru,",
      titulo: "Feli te asignó una tarea",
      urgencia: "info",
      cuerpo: tabla(
        fila("Tarea", "<strong>Brief conjunto 1 — sale EasyLiving</strong>"),
        fila("Cliente", "Easy Living"),
        fila("Vence", fmtFecha("2026-08-19")),
        fila("Asignada por", "Feli"),
      ),
      cta: { label: "Ver mis tareas", url: `${APP}/tareas` },
    }),
  });
  resultados.push("nueva-tarea ✓");

  // 2 — Mención en nota
  await resend.emails.send({
    from: "Mango OS <noreply@comunidadmango.com>",
    to: DEST,
    subject: "[TEST] Cami te mencionó en una nota",
    html: emailHtml({
      saludo: "Hola Maru,",
      titulo: "Cami te mencionó en una nota",
      urgencia: "info",
      cuerpo: `
        ${tabla(
          fila("Mencionada por", "Cami"),
          fila("En cliente", "Grupo Cuenca"),
        )}
        <div style="margin-top:16px;padding:14px 16px;background:#f3f5f1;border-left:3px solid #daff59;border-radius:0 8px 8px 0;font-size:13.5px;color:#003430;line-height:1.65;">
          @Maru revisá el brief de técnicos, creo que hay que ajustar los clusters antes de mandárselo a Feli.
        </div>
      `,
      cta: { label: "Ver nota", url: `${APP}/clientes` },
    }),
  });
  resultados.push("mencion ✓");

  // 3 — Nuevo lead en pipeline
  await resend.emails.send({
    from: "Mango OS <noreply@comunidadmango.com>",
    to: DEST,
    subject: "[TEST] Nuevo lead: Estudio Vitali",
    html: emailHtml({
      saludo: "Hola,",
      titulo: "Nuevo lead en el pipeline: Estudio Vitali",
      urgencia: "info",
      cuerpo: `${tabla(
        fila("Lead", "<strong>Estudio Vitali</strong>"),
        fila("Empresa", "Arquitectura"),
        fila("Origen", "Instagram"),
        fila("Etapa", "Nuevo"),
      )}
      <p style="margin:16px 0 0;font-size:13px;color:#5c7a75;">Revisalo y avanzá con el seguimiento desde el Pipeline en Mango OS.</p>`,
      cta: { label: "Ver pipeline", url: `${APP}/pipeline` },
    }),
  });
  resultados.push("nuevo-lead ✓");

  // 4 — Tareas vencidas / vencen hoy
  await resend.emails.send({
    from: "Mango OS <noreply@comunidadmango.com>",
    to: DEST,
    subject: "[TEST] Tenés 2 tareas que vencen hoy",
    html: emailHtml({
      saludo: "Hola Maru,",
      titulo: "Tenés 2 tareas que vencen hoy",
      urgencia: "warn",
      cuerpo: `
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#d97706;">Vencen hoy</p>
        ${lista([
          "Brief conjunto 1 — sale EasyLiving",
          "Brief técnicos I — Grupo Cuenca",
        ])}
      `,
      cta: { label: "Ver mis tareas", url: `${APP}/tareas` },
    }),
  });
  resultados.push("tareas-vencen ✓");

  // 5 — Seguimiento: clientes sin contacto
  await resend.emails.send({
    from: "Mango OS <noreply@comunidadmango.com>",
    to: DEST,
    subject: "[TEST] ⚠️ Seguimiento pendiente — 3 clientes sin contacto hoy",
    html: emailHtml({
      saludo: "Hola Maru,",
      titulo: "3 clientes sin contacto hoy",
      urgencia: "warn",
      cuerpo: `
        <p style="margin:0 0 12px;">Lunes, miércoles y viernes el contacto con los clientes es obligatorio. Todavía no registraste contacto con:</p>
        ${lista(["Easy Living", "Grupo Cuenca", "Inner Space"])}
        <p style="margin:16px 0 0;font-size:13px;color:#5c7a75;">Registrá el contacto desde la ficha del cliente en Mango OS.</p>
      `,
      cta: { label: "Ver clientes", url: `${APP}/clientes` },
    }),
  });
  resultados.push("seguimiento-reminder ✓");

  return NextResponse.json({ ok: true, enviados: resultados });
}
