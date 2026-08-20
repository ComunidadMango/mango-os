import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  const db = createServerClient();

  let query = db
    .from("seguimiento")
    .select("*")
    .order("fecha", { ascending: false });

  if (clienteId) query = query.eq("cliente_id", clienteId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = createServerClient();

  const { data, error } = await db
    .from("seguimiento")
    .insert({
      cliente_id: body.clienteId,
      fecha:      body.fecha ?? new Date().toISOString().slice(0, 10),
      quien:      body.quien ?? null,
      canal:      body.canal,
      tono:       body.tono,
      resumen:    body.resumen ?? "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Actualizar ultimo_contacto en el cliente si el canal no es sin_contacto
  if (body.canal !== "sin_contacto") {
    await db
      .from("clientes")
      .update({ ultimo_contacto: body.fecha ?? new Date().toISOString().slice(0, 10) })
      .eq("id", body.clienteId);
  }

  return NextResponse.json(data, { status: 201 });
}
