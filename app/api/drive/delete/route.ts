import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteItem } from "@/lib/drive";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { fileId } = await req.json() as { fileId?: string };
  if (!fileId) return NextResponse.json({ error: "fileId requerido" }, { status: 400 });

  await deleteItem(session.accessToken, fileId);
  return NextResponse.json({ ok: true });
}
