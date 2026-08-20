import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ideaId } = await params;
  const body = await req.json();
  const db = createServerClient();

  const update: Record<string, unknown> = {};
  if (body.texto     !== undefined) update.texto     = body.texto;
  if (body.cliente   !== undefined) update.cliente   = body.cliente;
  if (body.quienes   !== undefined) update.quienes   = body.quienes;
  if (body.estado_id !== undefined) update.estado_id = body.estado_id;
  if (body.estadoId  !== undefined) update.estado_id = body.estadoId;

  const { data, error } = await db
    .from("ideas")
    .update(update)
    .eq("id", ideaId)
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

  const { ideaId } = await params;
  const db = createServerClient();

  const { error } = await db.from("ideas").delete().eq("id", ideaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
