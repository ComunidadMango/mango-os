import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  const { data, error } = await db
    .from("paginas")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = createServerClient();

  const { data, error } = await db
    .from("paginas")
    .insert({
      nombre:      body.nombre,
      tipo:        body.tipo,
      icono:       body.icono ?? "File",
      visibilidad: body.visibilidad ?? "equipo",
      creado_por:  body.creadoPor ?? null,
      creado_en:   new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
