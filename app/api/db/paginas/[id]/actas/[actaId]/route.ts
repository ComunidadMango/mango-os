import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { actaId } = await params;
  const body = await req.json();
  const db = createServerClient();

  const update: Record<string, unknown> = {};
  if (body.fecha         !== undefined) update.fecha         = body.fecha;
  if (body.tipo          !== undefined) update.tipo          = body.tipo;
  if (body.tipoCustom    !== undefined) update.tipo_custom   = body.tipoCustom;
  if (body.clienteId     !== undefined) update.cliente_id    = body.clienteId;
  if (body.participantes !== undefined) update.participantes = body.participantes;
  if (body.carpetaId     !== undefined) update.carpeta_id    = body.carpetaId;
  if (body.puntos        !== undefined) update.puntos        = body.puntos;
  if (body.pasos         !== undefined) update.pasos         = body.pasos;

  const { data, error } = await db
    .from("actas")
    .update(update)
    .eq("id", actaId)
    .select("*, adjuntos_actas(*)")
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

  const { actaId } = await params;
  const db = createServerClient();

  // Los adjuntos_actas se eliminan en cascada (on delete cascade)
  const { error } = await db.from("actas").delete().eq("id", actaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
