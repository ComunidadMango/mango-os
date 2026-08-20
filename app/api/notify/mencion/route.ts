import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase";
import { emailHtml, tabla, fila } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST — llamado al guardar una nota con @menciones.
// Body: { texto, autorId, clienteNombre?, mencionados: string[] }
export async function POST(req: Request) {
  const body = await req.json() as {
    texto: string;
    autorId: string;
    clienteNombre?: string;
    mencionados: string[];
  };

  if (!body.texto || !body.autorId || !body.mencionados?.length) {
    return NextResponse.json({ ok: true, motivo: "sin menciones" });
  }

  const ids = [...new Set([...body.mencionados, body.autorId])];
  const db = createServerClient();
  const [{ data: personas }, { data: prefs }] = await Promise.all([
    db.from("personas").select("id, nombre, email").in("id", ids),
    db.from("notif_prefs").select("persona_id, mail").in("persona_id", body.mencionados).eq("tipo", "mencion"),
  ]);

  const autor = personas?.find((p) => p.id === body.autorId);
  const prefMap = Object.fromEntries((prefs ?? []).map(p => [p.persona_id, p.mail]));

  const mencionados = (personas ?? []).filter(
    (p) => body.mencionados.includes(p.id) && p.id !== body.autorId && p.email
      && prefMap[p.id] !== false  // solo excluir si tiene la pref guardada en false
  );

  if (!mencionados.length) return NextResponse.json({ ok: true, motivo: "sin emails" });

  const quienEscribio = autor?.nombre ?? "Alguien del equipo";
  const extracto = body.texto.length > 200 ? body.texto.slice(0, 200) + "…" : body.texto;

  await Promise.all(
    mencionados.flatMap((p) => {
      const nombre = p.nombre.split(" ")[0];
      const textoNotif = `${quienEscribio} te mencionó${body.clienteNombre ? ` en ${body.clienteNombre}` : " en una nota"}`;
      const hrefNotif = body.clienteNombre ? "/clientes" : "/notas";

      const filas = [
        fila("Mencionado por", quienEscribio),
        ...(body.clienteNombre ? [fila("En cliente", body.clienteNombre)] : []),
      ];

      const html = emailHtml({
        saludo: `Hola ${nombre},`,
        titulo: `${quienEscribio} te mencionó en una nota`,
        urgencia: "info",
        cuerpo: `
          ${tabla(...filas)}
          <div style="margin-top:16px;padding:14px 16px;background:#f3f5f1;border-left:3px solid #daff59;border-radius:0 8px 8px 0;font-size:13.5px;color:#003430;line-height:1.65;">
            ${extracto.replace(/\n/g, "<br>")}
          </div>
        `,
        cta: { label: "Ver nota", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}${hrefNotif}` },
      });

      return [
        resend.emails.send({
          from: "Mango OS <noreply@comunidadmango.com>",
          to: p.email!,
          subject: `${quienEscribio} te mencionó${body.clienteNombre ? ` en ${body.clienteNombre}` : ""}`,
          html,
        }),
        db.from("notificaciones").insert({
          persona_id: p.id,
          tipo: "mencion",
          texto: textoNotif,
          href: hrefNotif,
        }),
      ];
    })
  );

  return NextResponse.json({ ok: true, enviados: mencionados.length });
}
