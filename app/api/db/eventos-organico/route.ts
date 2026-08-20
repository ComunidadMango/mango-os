import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Resuelve nombres de clientes manualmente (sin FK en Supabase)
async function attachClienteNombres(
  db: ReturnType<typeof createServerClient>,
  rows: { cliente_id: string }[]
) {
  if (!rows.length) return rows;
  const ids = [...new Set(rows.map((r) => r.cliente_id))];
  const { data: clientesData } = await db
    .from("clientes")
    .select("id, nombre")
    .in("id", ids);
  const map = Object.fromEntries((clientesData ?? []).map((c) => [c.id, c.nombre]));
  return rows.map((r) => ({
    ...r,
    clientes: map[r.cliente_id] ? { nombre: map[r.cliente_id] } : null,
  }));
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const db = createServerClient();
  let q = db.from("eventos_organico")
    .select("*")
    .order("fecha").order("hora", { nullsFirst: true });

  if (desde) q = q.gte("fecha", desde);
  if (hasta) q = q.lte("fecha", hasta);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = await attachClienteNombres(db, data ?? []);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body      = await req.json();
  const creadoPor = session.user?.email?.split("@")[0] ?? "unknown";
  const db        = createServerClient();

  const { data, error } = await db.from("eventos_organico").insert({
    cliente_id:   body.cliente_id,
    titulo:       body.titulo,
    descripcion:  body.descripcion ?? null,
    fecha:        body.fecha,
    hora:         body.hora || null,
    tipo:         body.tipo         ?? "post",
    red_social:   body.red_social   ?? "instagram",
    creado_por:   creadoPor,
    visibilidad:  body.visibilidad  ?? "equipo",
    personas_ids: body.personas_ids ?? [],
    completado:   false,
    recordatorio: body.recordatorio ?? "dia-anterior",
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [withNombre] = await attachClienteNombres(db, [data]);
  return NextResponse.json(withNombre, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...fields } = await req.json() as { id: string } & Record<string, unknown>;
  const db = createServerClient();

  const { data, error } = await db.from("eventos_organico")
    .update(fields).eq("id", id)
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [withNombre] = await attachClienteNombres(db, [data]);
  return NextResponse.json(withNombre);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  const db = createServerClient();
  const { error } = await db.from("eventos_organico").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
