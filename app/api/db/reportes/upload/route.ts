import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

const BUCKET = "adjuntos-actas"; // reutilizamos el mismo bucket

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const clienteId = formData.get("clienteId") as string | null;
  const mes = formData.get("mes") as string | null;

  if (!file || !clienteId || !mes) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const db = createServerClient();
  const path = `reportes/${clienteId}/${mes}-${file.name}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
