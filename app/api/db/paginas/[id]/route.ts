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

  const [paginaRes, estadosRes, ideasRes, objetivosRes, carpetasRes, actasRes] =
    await Promise.all([
      db.from("paginas").select("*").eq("id", id).single(),
      db.from("estados_banco").select("*").eq("pagina_id", id).order("orden"),
      db.from("ideas").select("*").eq("pagina_id", id).order("created_at"),
      db.from("objetivos").select("*").eq("pagina_id", id).order("orden"),
      db.from("carpetas_actas").select("*").eq("pagina_id", id).order("created_at"),
      db.from("actas").select("*, adjuntos_actas(*)").eq("pagina_id", id).order("fecha", { ascending: false }),
    ]);

  if (paginaRes.error) {
    if (paginaRes.error.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: paginaRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    pagina:    paginaRes.data,
    estados:   estadosRes.data   ?? [],
    ideas:     ideasRes.data     ?? [],
    objetivos: objetivosRes.data ?? [],
    carpetas:  carpetasRes.data  ?? [],
    actas:     actasRes.data     ?? [],
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { nombre?: string; icono?: string };
  const db = createServerClient();

  const updates: Record<string, unknown> = {};
  if (body.nombre !== undefined) updates.nombre = body.nombre;
  if (body.icono  !== undefined) updates.icono  = body.icono;

  const { error } = await db.from("paginas").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createServerClient();

  const { error } = await db.from("paginas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
