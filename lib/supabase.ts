// lib/supabase.ts
// Datos ahora vienen de Supabase. Los tipos siguen siendo los de lib/data.ts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Server-side (service role — bypasa RLS, usar solo en API routes / Server Components) ────
export function createServerClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ─── Browser-side (anon key — usar solo si se necesita real-time en el cliente) ───
export function createBrowserClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Tipos de filas de Supabase (snake_case) ─────────────────────────────────

export type PersonaRow = {
  id: string;
  nombre: string;
  rol: string;
  inicial: string;
  animo: string | null;
  en_que: string;
  foto: string | null;
  email: string | null;
  created_at: string;
};

export type ClienteRow = {
  id: string;
  nombre: string;
  rubro: string;
  descripcion: string | null;
  responsable: string;
  media_buyer: string | null;
  fee: number | null;
  fecha_alta: string | null;
  interno: boolean;
  pauta_estado: string;
  pauta_detalle: string;
  relacion_estado: string;
  relacion_detalle: string;
  trabajo_estado: string;
  trabajo_detalle: string;
  ultimo_contacto: string | null;
  created_at: string;
};

export type SeguimientoRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  quien: string | null;
  canal: string;
  tono: string;
  resumen: string;
  created_at: string;
};

export type NotaRow = {
  id: string;
  cliente_id: string;
  autor: string;
  texto: string;
  menciones: string[];
  created_at: string;
};

export type ReunionRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  titulo: string;
  tipo: string;
  asistentes: string[];
  duracion: number | null;
  notas: string | null;
  transcripcion: string | null;
  created_at: string;
};

export type TareaRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  responsable: string;
  asignada_por: string | null;
  cliente_id: string | null;
  vence: string | null;
  adjuntos: number;
  created_at: string;
};

export type LeadRow = {
  id: string;
  nombre: string;
  empresa: string | null;
  origen: string;
  etapa: string;
  fecha_ingreso: string;
  responsable: string;
  nota: string | null;
  created_at: string;
};

export type PaginaRow = {
  id: string;
  nombre: string;
  tipo: string;
  icono: string;
  visibilidad: string;
  creado_por: string | null;
  creado_en: string;
  created_at: string;
};

export type EstadoBancoRow = {
  id: string;
  pagina_id: string;
  titulo: string;
  color: string;
  orden: number;
  created_at: string;
};

export type IdeaRow = {
  id: string;
  pagina_id: string;
  texto: string;
  cliente: string;
  quienes: string[];
  estado_id: string;
  created_at: string;
};

export type ObjetivoRow = {
  id: string;
  pagina_id: string;
  texto: string;
  responsables: string[];
  hecho: boolean;
  orden: number;
  created_at: string;
};

export type CarpetaActaRow = {
  id: string;
  pagina_id: string;
  nombre: string;
  created_at: string;
};

export type ActaRow = {
  id: string;
  pagina_id: string;
  fecha: string;
  tipo: string;
  tipo_custom: string | null;
  cliente_id: string | null;
  participantes: string[];
  carpeta_id: string | null;
  puntos: string;
  pasos: string;
  created_at: string;
};

export type AdjuntoActaRow = {
  id: string;
  acta_id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  storage_path: string;
  created_at: string;
};

export type EquipoEstadoHoyRow = {
  persona_id: string;
  fecha: string;
  en_que: string;
  emoji: string;
  created_at: string;
};

export type TodoPersonalRow = {
  id: string;
  persona_id: string;
  texto: string;
  hecho: boolean;
  orden: number;
  created_at: string;
};
