import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const API = "https://www.googleapis.com/drive/v3";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { fileId, targetFolderId } = await req.json() as { fileId?: string; targetFolderId?: string };
  if (!fileId || !targetFolderId) return NextResponse.json({ error: "fileId y targetFolderId requeridos" }, { status: 400 });

  const token = session.accessToken;

  // Obtener parents actuales para poder sacar el archivo de donde estaba
  const metaRes = await fetch(
    `${API}/files/${fileId}?fields=parents&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const meta = await metaRes.json() as { parents?: string[] };
  const oldParents = (meta.parents ?? []).join(",");

  const params = new URLSearchParams({
    addParents: targetFolderId,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "id,name,mimeType,size,modifiedTime,webViewLink",
  });
  if (oldParents) params.set("removeParents", oldParents);

  const res = await fetch(`${API}/files/${fileId}?${params}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) return NextResponse.json(await res.json(), { status: res.status });
  return NextResponse.json(await res.json());
}
