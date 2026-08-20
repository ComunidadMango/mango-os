import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get("persona_id");
  if (!personaId) return NextResponse.json({ error: "persona_id required" }, { status: 400 });

  const db = createServerClient();
  const { data, error } = await db
    .from("todos_personales")
    .select("*")
    .eq("persona_id", personaId)
    .order("orden")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = createServerClient();

  // Calcular el max orden actual
  const { data: maxRow } = await db
    .from("todos_personales")
    .select("orden")
    .eq("persona_id", body.persona_id)
    .order("orden", { ascending: false })
    .limit(1)
    .single();

  const orden = ((maxRow?.orden ?? -1) as number) + 1;

  const { data, error } = await db
    .from("todos_personales")
    .insert({
      persona_id: body.persona_id,
      texto:      body.texto,
      hecho:      body.hecho ?? false,
      orden,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
