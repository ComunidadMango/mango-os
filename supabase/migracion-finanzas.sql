-- Corrige los emails reales de cada persona (el id interno no tiene por qué
-- coincidir con el principio del mail real).
update personas set email = 'camila@comunidadmango.com'    where id = 'cami';
update personas set email = 'matheo@comunidadmango.com'    where id = 'theo';
update personas set email = 'felicitas@comunidadmango.com' where id = 'feli';
update personas set email = 'milagros@comunidadmango.com'  where id = 'mili';
update personas set email = 'maria@comunidadmango.com'     where id = 'maru';
update personas set email = 'lucia@comunidadmango.com'     where id = 'lucia';

-- Tabla de Finanzas: antes vivía solo en localStorage del navegador de cada
-- uno, por eso Cami y Maru no veían lo mismo. Ahora se guarda en Supabase,
-- un registro por mes.
create table if not exists finanzas (
  mes         text primary key,           -- '2026-08'
  clientes    jsonb not null default '[]',
  equipo      jsonb not null default '[]',
  gastos      jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);
