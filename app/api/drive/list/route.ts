import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFolder } from "@/lib/drive";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const folderId = req.nextUrl.searchParams.get("folderId");
  if (!folderId) return NextResponse.json({ error: "folderId requerido" }, { status: 400 });

  const files = await listFolder(session.accessToken, folderId);
  return NextResponse.json({ files });
}
