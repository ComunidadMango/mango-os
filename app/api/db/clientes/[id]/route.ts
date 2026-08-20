import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createServerClient();

  const [clienteRes, seguimientoRes, notasRes, reunionesRes, tareasRes] = await Promise.all([
    db.from("clientes").select("*").eq("id", id).single(),
    db.from("seguimiento").select("*").eq("cliente_id", id).order("fecha", { ascending: false }),
    db.from("notas").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
    db.from("reuniones").select("*").eq("cliente_id", id).order("fecha", { ascending: false }),
    db.from("tareas").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
  ]);

  if (clienteRes.error) {
    if (clienteRes.error.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: clienteRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    cliente:     clienteRes.data,
    seguimiento: seguimientoRes.data ?? [],
    notas:       notasRes.data ?? [],
    reuniones:   reunionesRes.data ?? [],
    tareas:      tareasRes.data ?? [],
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const db = createServerClient();

  const { data, error } = await db
    .from("clientes")
    .update(body)
    .eq("id", id)
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

  const { id } = await params;
  const db = createServerClient();

  const { error } = await db.from("clientes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
