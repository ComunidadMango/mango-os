import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getContact } from "@/lib/ghl";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.GHL_API_KEY) return NextResponse.json({ error: "no-key" }, { status: 400 });

  const contactId = req.nextUrl.searchParams.get("id");
  if (!contactId) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  try {
    const contact = await getContact(contactId);
    return NextResponse.json({ contact });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
