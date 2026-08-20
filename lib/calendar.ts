export type GcalEvent = {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  htmlLink?: string;
  status?: string;
};

const TZ = "America/Argentina/Buenos_Aires";

export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GcalEvent[]> {
  const params = new URLSearchParams({
    timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "200",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data.items ?? []).filter((e: GcalEvent) => e.status !== "cancelled");
}

export async function createEvent(
  accessToken: string,
  calendarId: string,
  evento: { summary: string; description?: string; startDateTime: string; endDateTime: string; colorId?: string },
): Promise<GcalEvent> {
  const body: Record<string, unknown> = {
    summary:     evento.summary,
    description: evento.description,
    start: { dateTime: evento.startDateTime, timeZone: TZ },
    end:   { dateTime: evento.endDateTime,   timeZone: TZ },
  };
  if (evento.colorId) body.colorId = evento.colorId;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Refresca un access token usando el refresh token de Google
export async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  const data = await res.json();
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

export async function patchEventColor(
  accessToken: string,
  calendarId: string,
  eventId: string,
  colorId: string | null,
): Promise<GcalEvent> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ colorId: colorId ?? "" }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
