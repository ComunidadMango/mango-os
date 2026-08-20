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
    .from("actas")
    .select("*, adjuntos_actas(*)")
    .eq("pagina_id", id)
    .order("fecha", { ascending: false });

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

  const { data, error } = await db
    .from("actas")
    .insert({
      pagina_id:    id,
      fecha:        body.fecha,
      tipo:         body.tipo,
      tipo_custom:  body.tipoCustom ?? null,
      cliente_id:   body.clienteId ?? null,
      participantes: body.participantes ?? [],
      carpeta_id:   body.carpetaId ?? null,
      puntos:       body.puntos ?? "",
      pasos:        body.pasos ?? "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
