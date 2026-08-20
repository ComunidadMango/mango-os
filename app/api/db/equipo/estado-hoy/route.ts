import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hoy = new Date().toISOString().slice(0, 10);
  const db = createServerClient();

  const { data, error } = await db
    .from("equipo_estado_hoy")
    .select("*")
    .eq("fecha", hoy);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { persona_id: string; en_que?: string; emoji?: string };
  const hoy = new Date().toISOString().slice(0, 10);
  const db = createServerClient();

  const { data, error } = await db
    .from("equipo_estado_hoy")
    .upsert(
      {
        persona_id: body.persona_id,
        fecha:      hoy,
        en_que:     body.en_que ?? "",
        emoji:      body.emoji  ?? "🙂",
      },
      { onConflict: "persona_id,fecha" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
