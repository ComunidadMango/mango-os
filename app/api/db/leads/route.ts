import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const etapa       = searchParams.get("etapa");
  const responsable = searchParams.get("responsable");
  const db = createServerClient();

  let query = db
    .from("leads")
    .select("*")
    .order("fecha_ingreso", { ascending: false });

  if (etapa)       query = query.eq("etapa", etapa);
  if (responsable) query = query.eq("responsable", responsable);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = createServerClient();

  const { data, error } = await db
    .from("leads")
    .insert({
      nombre:        body.nombre,
      empresa:       body.empresa ?? null,
      origen:        body.origen,
      etapa:         body.etapa ?? "nuevo",
      fecha_ingreso: body.fechaIngreso ?? new Date().toISOString().slice(0, 10),
      responsable:   body.responsable,
      nota:          body.nota ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
