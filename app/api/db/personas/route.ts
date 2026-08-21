import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  const { data, error } = await db
    .from("personas")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Sincroniza la foto y el nombre de Google del usuario logueado hacia
// Supabase, para que el resto del equipo vea su foto real (no solo él).
export async function PUT() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;
  const db = createServerClient();

  // Matcheamos por email real, NO por el prefijo del mail — el id de la fila
  // (ej. "cami") es solo una clave interna y no tiene por qué coincidir con
  // el principio del mail real de la persona (ej. camila@...).
  const { data, error } = await db
    .from("personas")
    .update({
      foto: session.user.image ?? null,
      ...(session.user.name ? { nombre: session.user.name } : {}),
    })
    .ilike("email", email)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 0 filas = el usuario logueado no está en el roster (su email no está
  // cargado en personas.email todavía) — no es un error, no hay nada que sincronizar.
  return NextResponse.json(data?.[0] ?? null);
}
