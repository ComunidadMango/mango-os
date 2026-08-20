import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clienteId } = await params;
  const db = createServerClient();

  const { data, error } = await db
    .from("seguimiento")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
