import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadFile } from "@/lib/drive";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file     = formData.get("file")     as File   | null;
  const parentId = formData.get("parentId") as string | null;
  if (!file || !parentId) return NextResponse.json({ error: "file y parentId requeridos" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadFile(
    session.accessToken,
    file.name,
    buffer,
    file.type || "application/octet-stream",
    parentId,
  );
  return NextResponse.json(result);
}
