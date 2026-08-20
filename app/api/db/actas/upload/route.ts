import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

const BUCKET = "adjuntos-actas";
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const actaId = formData.get("actaId") as string | null;

  if (!file)   return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!actaId) return NextResponse.json({ error: "actaId required" }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 8 MB limit" }, { status: 413 });
  }

  const db = createServerClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${actaId}/${Date.now()}-${file.name}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Registrar el adjunto en la tabla
  const { data, error: dbError } = await db
    .from("adjuntos_actas")
    .insert({
      acta_id:      actaId,
      nombre:       file.name,
      tipo:         file.type || `application/${ext}`,
      tamano:       file.size,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (dbError) {
    // Intentar limpiar el archivo subido
    await db.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Generar signed URL válida por 1 hora
  const { data: signedUrl } = await db.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  return NextResponse.json({
    adjunto: data,
    url: signedUrl?.signedUrl ?? null,
  }, { status: 201 });
}

// Generar signed URL para descargar un adjunto existente
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const storagePath = searchParams.get("path");
  if (!storagePath) return NextResponse.json({ error: "path required" }, { status: 400 });

  const db = createServerClient();
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
