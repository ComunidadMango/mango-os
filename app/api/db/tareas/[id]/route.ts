import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const db = createServerClient();

  const updates: Record<string, unknown> = {};
  if (body.titulo        !== undefined) updates.titulo          = body.titulo;
  if (body.descripcion   !== undefined) updates.descripcion     = body.descripcion;
  if (body.estado        !== undefined) updates.estado          = body.estado;
  if (body.responsable   !== undefined) updates.responsable     = body.responsable;
  if (body.responsables  !== undefined) {
    updates.responsables = body.responsables;
    if (body.responsable === undefined) updates.responsable = body.responsables[0];
  }
  if (body.completadosPor !== undefined) updates.completados_por = body.completadosPor;
  if (body.clienteId     !== undefined) updates.cliente_id      = body.clienteId;
  if (body.vence          !== undefined) updates.vence          = body.vence;
  if (body.adjuntos       !== undefined) updates.adjuntos       = body.adjuntos;

  const { error } = await db.from("tareas").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createServerClient();
  const { error } = await db.from("tareas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
