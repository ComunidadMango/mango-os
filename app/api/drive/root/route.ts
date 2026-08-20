import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreate, DRIVE_ID } from "@/lib/drive";

// Devuelve (y crea si no existen) las carpetas raíz de Mango OS en el Shared Drive
export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!DRIVE_ID) {
    return NextResponse.json({ error: "DRIVE_SHARED_ID no configurado" }, { status: 503 });
  }

  const token = session.accessToken;
  const [clientesFolderId, equipoFolderId, seccionesFolderId] = await Promise.all([
    getOrCreate(token, "Clientes",  DRIVE_ID),
    getOrCreate(token, "Equipo",    DRIVE_ID),
    getOrCreate(token, "Secciones", DRIVE_ID),
  ]);

  return NextResponse.json({ clientesFolderId, equipoFolderId, seccionesFolderId });
}
