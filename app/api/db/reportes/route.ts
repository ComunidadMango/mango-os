import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("cliente_id");

  const db = createServerClient();
  let query = db.from("reportes_mensuales").select("*").order("mes", { ascending: false });
  if (clienteId) query = query.eq("cliente_id", clienteId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = createServerClient();

  const { data, error } = await db
    .from("reportes_mensuales")
    .upsert({
      cliente_id:   body.cliente_id,
      mes:          body.mes,
      entregado:    body.entregado ?? false,
      archivo_url:  body.archivo_url ?? null,
      entregado_en: body.entregado ? new Date().toISOString() : null,
    }, { onConflict: "cliente_id,mes" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
