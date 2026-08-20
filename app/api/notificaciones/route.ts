import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// GET — últimas 30 notificaciones del usuario logueado
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const personaId = session.user?.email?.split("@")[0];
  if (!personaId) return NextResponse.json([]);

  const db = createServerClient();
  const { data } = await db
    .from("notificaciones")
    .select("id, tipo, texto, href, leida, creada_en")
    .eq("persona_id", personaId)
    .order("creada_en", { ascending: false })
    .limit(30);

  return NextResponse.json(data ?? []);
}

// PATCH — marca todas como leídas
export async function PATCH() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const personaId = session.user?.email?.split("@")[0];
  if (!personaId) return NextResponse.json({ ok: true });

  const db = createServerClient();
  await db
    .from("notificaciones")
    .update({ leida: true })
    .eq("persona_id", personaId)
    .eq("leida", false);

  return NextResponse.json({ ok: true });
}
