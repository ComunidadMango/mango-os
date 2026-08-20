import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { objId } = await params;
  const body = await req.json();
  const db = createServerClient();

  const update: Record<string, unknown> = {};
  if (body.texto        !== undefined) update.texto        = body.texto;
  if (body.responsables !== undefined) update.responsables = body.responsables;
  if (body.hecho        !== undefined) update.hecho        = body.hecho;
  if (body.orden        !== undefined) update.orden        = body.orden;

  const { data, error } = await db
    .from("objetivos")
    .update(update)
    .eq("id", objId)
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

  const { objId } = await params;
  const db = createServerClient();

  const { error } = await db.from("objetivos").delete().eq("id", objId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
