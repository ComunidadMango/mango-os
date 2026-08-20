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

  const { data, error } = await db
    .from("estados_banco")
    .select("*")
    .eq("pagina_id", id)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const db = createServerClient();

  // Calcular max orden
  const { data: maxRow } = await db
    .from("estados_banco")
    .select("orden")
    .eq("pagina_id", id)
    .order("orden", { ascending: false })
    .limit(1)
    .single();

  const orden = ((maxRow?.orden ?? -1) as number) + 1;

  const { data, error } = await db
    .from("estados_banco")
    .insert({
      pagina_id: id,
      titulo:    body.titulo,
      color:     body.color ?? "gray",
      orden,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
