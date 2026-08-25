-- ══════════════════════════════════════════════════════════════════════════════
-- MANGO OS — Migration: Columnas de tareas + Realtime
-- Correr en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabla columnas_tareas ─────────────────────────────────────────────────
-- Las columnas del tablero de tareas, compartidas por todo el equipo.

create table if not exists columnas_tareas (
  id           text primary key,
  titulo       text not null,
  punto        text not null default 'bg-ink-3',
  chip_activo  text not null default 'bg-ink text-paper',
  orden        int  not null default 0,
  created_at   timestamptz not null default now()
);

alter table columnas_tareas enable row level security;

create policy "allow_all_columnas_tareas" on columnas_tareas
  for all using (true) with check (true);

-- Columnas por defecto (las 4 originales del dashboard)
insert into columnas_tareas (id, titulo, punto, chip_activo, orden) values
  ('pendiente',   'Por hacer',   'bg-ink-3', 'bg-ink text-paper', 0),
  ('en_curso',    'En curso',    'bg-warn',  'bg-warn text-ink',  1),
  ('en_revision', 'En revisión', 'bg-lime',  'bg-lime text-ink',  2),
  ('hecha',       'Listo',       'bg-ok',    'bg-ok text-paper',  3)
on conflict (id) do nothing;

-- ─── 2. Eliminar el CHECK constraint de tareas.estado ─────────────────────────
-- Para permitir IDs de columnas custom (ej: "col-1234567890")

alter table tareas drop constraint if exists tareas_estado_check;

-- ─── 3. REPLICA IDENTITY FULL ─────────────────────────────────────────────────
-- Necesario para que los eventos UPDATE y DELETE de Realtime incluyan
-- los datos del row anterior (old record), lo que permite saber qué
-- registro fue modificado o eliminado.

alter table tareas           replica identity full;
alter table columnas_tareas  replica identity full;
alter table paginas          replica identity full;
alter table notificaciones   replica identity full;
alter table notas_equipo     replica identity full;

-- ══════════════════════════════════════════════════════════════════════════════
-- DESPUÉS DE CORRER ESTE SQL:
-- Ir a Supabase → Database → Replication → Supabase Realtime
-- y activar las tablas:
--   ✅ tareas
--   ✅ columnas_tareas
--   ✅ paginas
--   ✅ notificaciones
--   ✅ notas_equipo
-- ══════════════════════════════════════════════════════════════════════════════
