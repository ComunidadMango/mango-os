import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Solo Cami y Maru pueden ver y modificar quién más tiene acceso a Finanzas.
const ADMIN_IDS = ["cami", "maru"];

async function idDelUsuario(email: string): Promise<string | null> {
  const db = createServerClient();
  const { data } = await db.from("personas").select("id").ilike("email", email).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cualquier persona logueada puede consultar la lista (para saber si ella
  // misma tiene acceso otorgado) — solo admins pueden modificarla (POST/DELETE).
  const db = createServerClient();
  const { data, error } = await db.from("finanzas_accesos").select("persona_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.map((r) => r.persona_id) ?? []);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = await idDelUsuario(session.user.email);
  if (!id || !ADMIN_IDS.includes(id)) {
    return NextResponse.json({ error: "Solo Cami y Maru pueden dar acceso a Finanzas" }, { status: 403 });
  }

  const body = await req.json() as { personaId: string; otorgar: boolean };
  if (!body.personaId) return NextResponse.json({ error: "Falta personaId" }, { status: 400 });

  const db = createServerClient();
  if (body.otorgar) {
    const { error } = await db
      .from("finanzas_accesos")
      .upsert({ persona_id: body.personaId, otorgado_por: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db.from("finanzas_accesos").delete().eq("persona_id", body.personaId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
