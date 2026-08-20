import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchOpportunities, PIPELINE_HAY_FIT } from "@/lib/ghl";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.GHL_API_KEY) {
    return NextResponse.json({ sinKey: true, opportunities: [], total: 0 });
  }

  const status = (req.nextUrl.searchParams.get("status") ?? "open") as "open" | "won" | "lost" | "all";

  try {
    const result = await searchOpportunities(PIPELINE_HAY_FIT, status, 100);
    return NextResponse.json({ sinKey: false, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
