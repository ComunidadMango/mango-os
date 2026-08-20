import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET /api/notif-prefs?persona_id=maru
export async function GET(req: Request) {
  const persona_id = new URL(req.url).searchParams.get("persona_id");
  if (!persona_id) return NextResponse.json({ error: "Falta persona_id" }, { status: 400 });

  const db = createServerClient();
  const { data } = await db
    .from("notif_prefs")
    .select("tipo, mail, push, dashboard")
    .eq("persona_id", persona_id);

  return NextResponse.json(data ?? []);
}

// PUT /api/notif-prefs
// Body: { persona_id, tipo, mail, push, dashboard }
export async function PUT(req: Request) {
  const body = await req.json() as {
    persona_id: string;
    tipo: string;
    mail: boolean;
    push: boolean;
    dashboard: boolean;
  };

  const db = createServerClient();
  const { error } = await db
    .from("notif_prefs")
    .upsert(body, { onConflict: "persona_id,tipo" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
