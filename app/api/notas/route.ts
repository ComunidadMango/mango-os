import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// POST — guarda una nota de cliente en Supabase y dispara notificaciones de mención.
// Body: { id, clienteId, autorId, texto, menciones: string[] }
export async function POST(req: Request) {
  const body = await req.json() as {
    id: string;
    clienteId: string;
    autorId: string;
    texto: string;
    menciones: string[];
  };

  if (!body.id || !body.clienteId || !body.autorId || !body.texto) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const db = createServerClient();
  const { error } = await db.from("notas").insert({
    id:         body.id,
    cliente_id: body.clienteId,
    autor:      body.autorId,
    texto:      body.texto,
    menciones:  body.menciones,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Disparar notificación de menciones en background si las hay
  if (body.menciones.length > 0) {
    // Obtener nombre del cliente para el email
    const { data: cliente } = await db
      .from("clientes")
      .select("nombre")
      .eq("id", body.clienteId)
      .single();

    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.comunidadmango.com"}/api/notify/mencion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto:         body.texto,
        autorId:       body.autorId,
        clienteNombre: cliente?.nombre,
        mencionados:   body.menciones,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
