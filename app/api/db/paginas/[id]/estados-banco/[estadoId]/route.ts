import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { estadoId } = await params;
  const body = await req.json();
  const db = createServerClient();

  const update: Record<string, unknown> = {};
  if (body.titulo !== undefined) update.titulo = body.titulo;
  if (body.color  !== undefined) update.color  = body.color;
  if (body.orden  !== undefined) update.orden  = body.orden;

  const { data, error } = await db
    .from("estados_banco")
    .update(update)
    .eq("id", estadoId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { estadoId } = await params;
  const db = createServerClient();

  // Primero resetear las ideas que tenían este estado al primer estado de la página
  // (esto debería manejarse a nivel de UI antes de llamar delete, pero lo aseguramos aquí)
  const { error } = await db.from("estados_banco").delete().eq("id", estadoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
