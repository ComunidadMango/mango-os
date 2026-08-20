import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// GET — trae notas del equipo + notas personales compartidas conmigo
export async function GET(req: Request) {
  const yo = new URL(req.url).searchParams.get("yo") ?? "";
  const db = createServerClient();
  const { data, error } = await db
    .from("notas_equipo")
    .select("*")
    .order("editada_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Equipo (compartido_con vacío) + compartidas conmigo específicamente
  const visible = (data ?? []).filter((n) => {
    const cc: string[] = n.compartido_con ?? [];
    return cc.length === 0 || cc.includes(yo);
  });

  return NextResponse.json(visible);
}

// POST — crea o actualiza una nota del equipo (upsert por id)
export async function POST(req: Request) {
  const body = await req.json() as {
    id: string;
    titulo: string;
    contenido: string;
    color: string | null;
    autor_id: string;
    editada_en: string;
  };

  if (!body.id || !body.autor_id) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const db = createServerClient();
  const { error } = await db.from("notas_equipo").upsert({
    id:             body.id,
    titulo:         body.titulo ?? "",
    contenido:      body.contenido ?? "",
    color:          body.color ?? null,
    autor_id:       body.autor_id,
    editada_en:     body.editada_en,
    compartido_con: (body as { compartido_con?: string[] }).compartido_con ?? [],
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — elimina una nota del equipo por id
export async function DELETE(req: Request) {
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const db = createServerClient();
  const { error } = await db.from("notas_equipo").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
