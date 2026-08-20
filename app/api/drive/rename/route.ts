import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const API = "https://www.googleapis.com/drive/v3";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { fileId, newName } = await req.json() as { fileId?: string; newName?: string };
  if (!fileId || !newName?.trim()) return NextResponse.json({ error: "fileId y newName requeridos" }, { status: 400 });

  const res = await fetch(
    `${API}/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,size,modifiedTime,webViewLink`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    },
  );

  if (!res.ok) return NextResponse.json(await res.json(), { status: res.status });
  return NextResponse.json(await res.json());
}
