-- Procesos vivía solo en localStorage de cada navegador (como pasaba antes con
-- Finanzas). Se guarda como un único registro con todo el árbol en JSON —
-- no hace falta separar en tablas porque se edita y lee todo junto.
create table if not exists procesos_data (
  id          text primary key default 'global',
  data        jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

alter table procesos_data enable row level security;
alter table procesos_data replica identity full;

create policy "allow_all_procesos_data" on procesos_data
  for all using (true) with check (true);
