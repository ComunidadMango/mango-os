"use client";

import { useSession } from "next-auth/react";
import { personaPorEmail, usuarioActual, type Persona } from "./data";

export function useUsuarioActual(): Persona {
  const { data: session } = useSession();
  if (session?.user?.email) {
    return personaPorEmail(session.user.email) ?? usuarioActual;
  }
  return usuarioActual;
}
