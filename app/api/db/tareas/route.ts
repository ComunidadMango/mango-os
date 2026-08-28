import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const responsable = searchParams.get("responsable");
  const clienteId   = searchParams.get("clienteId");
  const db = createServerClient();

  let query = db.from("tareas").select("*").order("created_at", { ascending: false });

  // "contains" para que también aparezca a los co-asignados, no solo al principal
  if (responsable) query = query.contains("responsables", [responsable]);
  if (clienteId)   query = query.eq("cliente_id", clienteId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = createServerClient();

  const responsables: string[] = Array.isArray(body.responsables) && body.responsables.length
    ? body.responsables
    : [body.responsable];

  const { data, error } = await db
    .from("tareas")
    .insert({
      titulo:          body.titulo,
      descripcion:     body.descripcion ?? null,
      estado:          body.estado ?? "pendiente",
      responsable:     responsables[0],
      responsables,
      completados_por: [],
      asignada_por:    body.asignadaPor ?? null,
      cliente_id:      body.clienteId ?? null,
      vence:           body.vence ?? null,
      adjuntos:        body.adjuntos ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
