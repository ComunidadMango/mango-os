import { NextResponse } from "next/server";
import { Resend } from "resend";
import { emailHtml } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com";

// Envío único: bienvenida al equipo para el lanzamiento de Mango OS.
// Protegido igual que el resto de los crons (?secret=AUTH_SECRET).
// Borrar esta ruta después de usarla una vez.
const DESTINATARIOS = [
  { nombre: "Cami", email: "cami@comunidadmango.com" },
  { nombre: "Feli", email: "feli@comunidadmango.com" },
  { nombre: "Theo", email: "theo@comunidadmango.com" },
  { nombre: "Mili", email: "mili@comunidadmango.com" },
];

const CUERPO = (nombre: string) => `
  <p style="margin:0 0 14px;">Desde hoy arrancamos a usar <strong>Mango OS</strong>, el dashboard que estuve armando para que tengamos todo el equipo en un solo lugar: clientes, tareas, calendario, pipeline.</p>
  <p style="margin:0 0 14px;">Entrá con tu cuenta de Google (@comunidadmango.com) y ya vas a ver tus tareas y los clientes del equipo cargados.</p>
  <p style="margin:0 0 14px;">Es una herramienta nueva y seguramente le falten cosas o haya algo que no funcione como debería. Cualquier cosa que veas rara, o idea para mejorarla, contámela. Se arma mejor entre todos.</p>
  <p style="margin:0;">¡Espero que nos sirva un montón para el día a día! 🙂</p>
  <p style="margin:16px 0 0;">Maru</p>
`;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resultados = await Promise.allSettled(
    DESTINATARIOS.map(({ nombre, email }) =>
      resend.emails.send({
        from: "Mango OS <noreply@comunidadmango.com>",
        to: email,
        subject: "Che, les quiero mostrar algo 👋",
        html: emailHtml({
          saludo: `Hola ${nombre},`,
          titulo: "Che, les quiero mostrar algo 👋",
          urgencia: "info",
          cuerpo: CUERPO(nombre),
          cta: { label: "Entrar a Mango OS", url: APP },
        }),
      })
    )
  );

  return NextResponse.json({
    ok: true,
    enviados: resultados.map((r, i) => ({
      a: DESTINATARIOS[i].email,
      estado: r.status,
    })),
  });
}
