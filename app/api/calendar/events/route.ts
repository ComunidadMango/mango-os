import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listEvents, createEvent, patchEventColor, refreshGoogleToken } from "@/lib/calendar";
import { createServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const cal     = searchParams.get("cal");
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");
  if (!timeMin || !timeMax) return NextResponse.json({ error: "timeMin y timeMax requeridos" }, { status: 400 });

  // ── Tab "Todos": agrega los calendarios de todo el equipo ────────────────
  if (cal === "todos") {
    const db = createServerClient();
    const [{ data: tokens }, { data: personas }] = await Promise.all([
      db.from("persona_tokens").select("persona_id, access_token, refresh_token, expires_at"),
      db.from("personas").select("id, nombre"),
    ]);

    const nombreDe: Record<string, string> = {};
    for (const p of personas ?? []) nombreDe[p.id] = p.nombre;

    const results = await Promise.allSettled(
      (tokens ?? []).map(async (t) => {
        let accessToken = t.access_token;
        // Refrescar si expiró
        if (t.expires_at < Date.now() - 60_000 && t.refresh_token) {
          try {
            const refreshed = await refreshGoogleToken(t.refresh_token);
            accessToken = refreshed.accessToken;
            db.from("persona_tokens")
              .update({ access_token: refreshed.accessToken, expires_at: refreshed.expiresAt })
              .eq("persona_id", t.persona_id)
              .then(() => {});
          } catch {}
        }
        const events = await listEvents(accessToken, "primary", timeMin, timeMax);
        return events.map(e => ({
          ...e,
          personaId:     t.persona_id,
          personaNombre: nombreDe[t.persona_id] ?? t.persona_id,
        }));
      })
    );

    const events = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
    return NextResponse.json({ events });
  }

  // ── Tab "Mio": calendar propio ───────────────────────────────────────────
  try {
    const events = await listEvents(session.accessToken, "primary", timeMin, timeMax);
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as {
    cal?: string; summary: string; description?: string;
    startDateTime: string; endDateTime: string; colorId?: string;
  };

  // Tanto "mio" como "todos" crean en el calendar propio del usuario logueado
  try {
    const event = await createEvent(session.accessToken, "primary", body);
    return NextResponse.json(event);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { eventId, colorId } = await req.json() as {
    cal?: string; eventId: string; colorId: string | null;
  };

  try {
    const event = await patchEventColor(session.accessToken, "primary", eventId, colorId);
    return NextResponse.json(event);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
