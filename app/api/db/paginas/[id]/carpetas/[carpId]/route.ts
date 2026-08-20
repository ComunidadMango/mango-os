import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { carpId } = await params;
  const db = createServerClient();

  // Las actas que tenían esta carpeta quedan con carpeta_id = null (on delete set null)
  const { error } = await db.from("carpetas_actas").delete().eq("id", carpId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
