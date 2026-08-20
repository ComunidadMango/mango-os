// Genera HTML de email con estética Mango para usar con Resend.
// Uso: resend.emails.send({ html: emailHtml({ ... }), ... })

type Urgencia = "info" | "warn" | "crit";

type EmailOpts = {
  saludo: string;      // "Hola Cami,"
  titulo: string;      // Encabezado visible en el email
  cuerpo: string;      // HTML interno (párrafos, listas)
  urgencia?: Urgencia;
  cta?: { label: string; url: string };
};

const CHIP: Record<Urgencia, { bg: string; color: string; label: string }> = {
  info: { bg: "#daff59", color: "#003430", label: "Mango OS" },
  warn: { bg: "#fef3c7", color: "#9a5c0a", label: "Atención" },
  crit: { bg: "#f9dfdb", color: "#a63d33", label: "Urgente" },
};

const BORDE: Record<Urgencia, string> = {
  info: "#daff59",
  warn: "#d97706",
  crit: "#a63d33",
};

export function emailHtml({
  saludo,
  titulo,
  cuerpo,
  urgencia = "info",
  cta,
}: EmailOpts): string {
  const chip = CHIP[urgencia];
  const borde = BORDE[urgencia];

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f1;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f1;">
    <tr>
      <td align="center" style="padding:48px 20px 40px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#003430;padding:20px 28px 16px;border-radius:14px 14px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#daff59;font-size:11px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;">MANGO OS</span>
                  </td>
                  <td align="right">
                    <span style="background:${chip.bg};color:${chip.color};font-size:10.5px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;padding:3px 10px;border-radius:6px;">${chip.label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Franja de color según urgencia -->
          <tr>
            <td style="background:${borde};height:3px;line-height:3px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Card body -->
          <tr>
            <td style="background:#ffffff;padding:32px 28px 28px;border-radius:0 0 14px 14px;border:1px solid #dde4de;border-top:none;">

              <p style="margin:0 0 4px;font-size:13px;color:#5c7a75;">${saludo}</p>
              <h1 style="margin:0 0 20px;font-size:21px;font-weight:700;color:#003430;line-height:1.3;">${titulo}</h1>

              <hr style="border:none;border-top:1px solid #dde4de;margin:0 0 20px;">

              <div style="font-size:14px;color:#003430;line-height:1.7;">
                ${cuerpo}
              </div>

              ${
                cta
                  ? `<table cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#daff59;border-radius:10px;">
                    <a href="${cta.url}" style="display:inline-block;padding:11px 22px;font-size:13px;font-weight:700;color:#003430;text-decoration:none;letter-spacing:0.01em;">${cta.label} →</a>
                  </td>
                </tr>
              </table>`
                  : ""
              }

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 0 0;text-align:center;">
              <p style="margin:0;font-size:11.5px;color:#5c7a75;line-height:1.6;">
                Comunidad Mango &nbsp;·&nbsp; Este es un email automático de Mango OS<br>
                <span style="color:#2b4b46;">comunidadmango.com</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

export function fmtFecha(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function fila(label: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#5c7a75;white-space:nowrap;padding-right:16px;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#003430;font-weight:600;">${valor}</td>
  </tr>`;
}

export function tabla(...filas: string[]): string {
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:8px;">
    ${filas.join("")}
  </table>`;
}

export function lista(items: string[]): string {
  return `<ul style="margin:0;padding:0 0 0 18px;">
    ${items.map((i) => `<li style="margin-bottom:4px;">${i}</li>`).join("")}
  </ul>`;
}
