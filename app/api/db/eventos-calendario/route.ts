import { auth } from "@/auth";
import { createServerClient, idPorEmail } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");
  if (!timeMin || !timeMax) return NextResponse.json([]);

  const db = createServerClient();
  const { data: eventos } = await db
    .from("eventos_calendario")
    .select("id, persona_id, titulo, descripcion, fecha_inicio, fecha_fin, todo_el_dia")
    .gte("fecha_inicio", timeMin.slice(0, 10))
    .lte("fecha_inicio", timeMax.slice(0, 10))
    .order("fecha_inicio");

  if (!eventos?.length) return NextResponse.json([]);

  const ids = [...new Set(eventos.map((e) => e.persona_id))];
  const { data: personas } = await db.from("personas").select("id, nombre").in("id", ids);
  const nombreDe: Record<string, string> = {};
  for (const p of personas ?? []) nombreDe[p.id] = p.nombre;

  return NextResponse.json(
    eventos.map((e) => ({ ...e, persona_nombre: nombreDe[e.persona_id] ?? e.persona_id }))
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const personaId = session.user?.email ? await idPorEmail(session.user.email) : null;
  if (!personaId) return NextResponse.json({ error: "Sin persona_id" }, { status: 400 });

  const body = await req.json() as {
    titulo: string; descripcion?: string;
    fechaInicio: string; fechaFin: string; todoElDia?: boolean;
  };

  const db = createServerClient();
  const { data, error } = await db
    .from("eventos_calendario")
    .insert({
      persona_id: personaId,
      titulo: body.titulo,
      descripcion: body.descripcion ?? null,
      fecha_inicio: body.fechaInicio,
      fecha_fin: body.fechaFin,
      todo_el_dia: body.todoElDia ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, persona_nombre: personaId });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const personaId = session.user?.email ? await idPorEmail(session.user.email) : null;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !personaId) return NextResponse.json({ error: "Faltan params" }, { status: 400 });

  const db = createServerClient();
  await db.from("eventos_calendario").delete().eq("id", id).eq("persona_id", personaId);
  return NextResponse.json({ ok: true });
}
