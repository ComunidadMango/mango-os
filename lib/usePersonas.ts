"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { equipo, setPersonasCache, type Persona } from "./data";

// Cache a nivel de módulo compartida entre instancias del hook, para no
// refetchear el equipo en cada componente que lo use.
let cachedList: Persona[] | null = null;
let inFlight: Promise<Persona[]> | null = null;

type PersonaRow = {
  id: string;
  nombre: string;
  rol: Persona["rol"];
  inicial: string;
  animo: string | null;
  en_que: string;
  foto: string | null;
  email: string | null;
};

function rowToPersona(r: PersonaRow): Persona {
  return {
    id: r.id,
    nombre: r.nombre,
    rol: r.rol,
    inicial: r.inicial,
    animo: r.animo,
    enQue: r.en_que,
    foto: r.foto ?? undefined,
    email: r.email ?? undefined,
  };
}

async function fetchPersonas(): Promise<Persona[]> {
  const res = await fetch("/api/db/personas");
  if (!res.ok) throw new Error("No se pudo cargar el equipo");
  const rows = (await res.json()) as PersonaRow[];
  return rows.map(rowToPersona);
}

// Hook que trae el equipo real desde Supabase (con foto de Google incluida)
// y, una vez por sesión, sincroniza la foto/nombre del usuario logueado para
// que el resto del equipo la vea también.
export function usePersonas(): Persona[] {
  const { data: session } = useSession();
  const [lista, setLista] = useState<Persona[]>(cachedList ?? equipo);

  useEffect(() => {
    let cancelled = false;
    (inFlight ??= fetchPersonas())
      .then((data) => {
        if (cancelled) return;
        cachedList = data;
        setPersonasCache(data);
        setLista(data);
      })
      .catch(() => {
        // Seguir con el fallback de desarrollo
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const email = session?.user?.email;
    const foto = session?.user?.image;
    if (!email || !foto) return;

    const emailLower = email.toLowerCase();
    const yaSincronizada = cachedList?.find((p) => p.email?.toLowerCase() === emailLower)?.foto === foto;
    if (yaSincronizada) return;

    fetch("/api/db/personas", { method: "PUT" })
      .then(async (res) => {
        if (!res.ok) return;
        const actualizada = (await res.json()) as PersonaRow | null;
        if (!actualizada) return;
        setLista((prev) => {
          const next = prev.some((p) => p.id === actualizada.id)
            ? prev.map((p) => (p.id === actualizada.id ? rowToPersona(actualizada) : p))
            : [...prev, rowToPersona(actualizada)];
          cachedList = next;
          setPersonasCache(next);
          return next;
        });
      })
      .catch(() => {});
  }, [session?.user?.email, session?.user?.image]);

  return lista;
}
