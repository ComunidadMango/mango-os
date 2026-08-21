import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

const ADMIN_IDS = ["cami", "maru"];

async function idDelUsuario(email: string): Promise<string | null> {
  const db = createServerClient();
  const { data } = await db.from("personas").select("id").ilike("email", email).maybeSingle();
  return data?.id ?? null;
}

async function tieneAccesoLectura(id: string): Promise<boolean> {
  if (ADMIN_IDS.includes(id)) return true;
  const db = createServerClient();
  const { data } = await db.from("finanzas_accesos").select("persona_id").eq("persona_id", id).maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = await idDelUsuario(session.user.email);
  if (!id || !(await tieneAccesoLectura(id))) {
    return NextResponse.json({ error: "Sin acceso a Finanzas" }, { status: 403 });
  }

  const mes = new URL(req.url).searchParams.get("mes") ?? new Date().toISOString().slice(0, 7);
  const db = createServerClient();
  const { data, error } = await db.from("finanzas").select("*").eq("mes", mes).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { mes, clientes: [], equipo: [], gastos: [] });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = await idDelUsuario(session.user.email);
  if (!id || !ADMIN_IDS.includes(id)) {
    return NextResponse.json({ error: "Sin acceso a Finanzas" }, { status: 403 });
  }

  const body = await req.json() as { mes: string; clientes: unknown[]; equipo: unknown[]; gastos: unknown[] };
  if (!body.mes) return NextResponse.json({ error: "Falta mes" }, { status: 400 });

  const db = createServerClient();
  const { data, error } = await db
    .from("finanzas")
    .upsert({
      mes: body.mes,
      clientes: body.clientes ?? [],
      equipo: body.equipo ?? [],
      gastos: body.gastos ?? [],
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
