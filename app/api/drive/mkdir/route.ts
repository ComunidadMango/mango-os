import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreate } from "@/lib/drive";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, parentId } = await req.json() as { name?: string; parentId?: string };
  if (!name || !parentId) return NextResponse.json({ error: "name y parentId requeridos" }, { status: 400 });

  const folderId = await getOrCreate(session.accessToken, name, parentId);
  return NextResponse.json({ folderId });
}
