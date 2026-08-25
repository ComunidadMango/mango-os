import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        const jwtToken = {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: (account.expires_at ?? 0) * 1000,
        };
        // Guardar tokens en Supabase para que "Todos" pueda leer el calendar de cada persona
        if (account.refresh_token && token.email) {
          const email = token.email as string;
          resolverIdYGuardar(email, jwtToken).catch(() => {});
        }
        return jwtToken;
      }
      // Token aún válido
      if (Date.now() < ((token.expiresAt as number) ?? 0)) return token;
      // Refrescar
      return refreshAccessToken(token);
    },
    session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
    signIn({ profile }) {
      return profile?.email?.endsWith("@comunidadmango.com") ?? false;
    },
  },
});

async function resolverIdYGuardar(email: string, token: Record<string, unknown>) {
  const { idPorEmail } = await import("@/lib/supabase");
  const personaId = await idPorEmail(email);
  if (personaId) await saveTokenToSupabase(personaId, token);
}

async function saveTokenToSupabase(personaId: string, token: Record<string, unknown>) {
  const { createServerClient } = await import("@/lib/supabase");
  const db = createServerClient();
  await db.from("persona_tokens").upsert({
    persona_id:    personaId,
    access_token:  token.accessToken as string,
    refresh_token: token.refreshToken as string | null,
    expires_at:    token.expiresAt as number,
  });
}

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        grant_type:    "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return { ...token, accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  } catch {
    return { ...token, error: "RefreshTokenError" };
  }
}
