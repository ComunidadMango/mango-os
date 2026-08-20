-- ══════════════════════════════════════════════════════════════════════════════
-- MANGO OS — Schema completo
-- Correr en el SQL Editor de Supabase antes que seed.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Extensiones ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Tabla: personas (equipo) ────────────────────────────────────────────────
create table if not exists personas (
  id           text primary key,
  nombre       text not null,
  rol          text not null check (rol in ('Founder','Media Buyer','Creative','Content & Account','Tech Ops')),
  inicial      text not null,
  animo        text,
  en_que       text not null default '',
  foto         text,
  email        text,
  created_at   timestamptz not null default now()
);

-- ─── Tabla: clientes ─────────────────────────────────────────────────────────
create table if not exists clientes (
  id                  text primary key,
  nombre              text not null,
  rubro               text not null,
  descripcion         text,
  responsable         text not null references personas(id),
  media_buyer         text references personas(id),
  fee                 int,
  fecha_alta          date,
  interno             boolean not null default false,
  pauta_estado        text not null default 'ok' check (pauta_estado in ('ok','atencion','critico')),
  pauta_detalle       text not null default '',
  relacion_estado     text not null default 'ok' check (relacion_estado in ('ok','atencion','critico')),
  relacion_detalle    text not null default '',
  trabajo_estado      text not null default 'ok' check (trabajo_estado in ('ok','atencion','critico')),
  trabajo_detalle     text not null default '',
  ultimo_contacto     date,
  created_at          timestamptz not null default now()
);

-- ─── Tabla: seguimiento ──────────────────────────────────────────────────────
create table if not exists seguimiento (
  id          text primary key default gen_random_uuid()::text,
  cliente_id  text not null references clientes(id) on delete cascade,
  fecha       date not null default current_date,
  quien       text references personas(id),
  canal       text not null check (canal in ('whatsapp','mail','llamada','reunion','sin_contacto')),
  tono        text not null check (tono in ('bien','neutro','tenso')),
  resumen     text not null default '',
  created_at  timestamptz not null default now()
);

-- ─── Tabla: notas ────────────────────────────────────────────────────────────
create table if not exists notas (
  id          text primary key default gen_random_uuid()::text,
  cliente_id  text not null references clientes(id) on delete cascade,
  autor       text not null references personas(id),
  texto       text not null,
  menciones   text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ─── Tabla: reuniones ────────────────────────────────────────────────────────
create table if not exists reuniones (
  id              text primary key default gen_random_uuid()::text,
  cliente_id      text not null references clientes(id) on delete cascade,
  fecha           date not null,
  titulo          text not null,
  tipo            text not null check (tipo in ('kickoff','mensual','estrategia','seguimiento','otro')),
  asistentes      text[] not null default '{}',
  duracion        int,
  notas           text,
  transcripcion   text,
  created_at      timestamptz not null default now()
);

-- ─── Tabla: tareas ───────────────────────────────────────────────────────────
create table if not exists tareas (
  id            text primary key default gen_random_uuid()::text,
  titulo        text not null,
  descripcion   text,
  estado        text not null default 'pendiente' check (estado in ('pendiente','en_curso','en_revision','hecha')),
  responsable   text not null references personas(id),
  asignada_por  text references personas(id),
  cliente_id    text references clientes(id) on delete set null,
  vence         date,
  adjuntos      int not null default 0,
  created_at    timestamptz not null default now()
);

-- ─── Tabla: leads ────────────────────────────────────────────────────────────
create table if not exists leads (
  id              text primary key default gen_random_uuid()::text,
  nombre          text not null,
  empresa         text,
  origen          text not null check (origen in ('formulario','instagram','referido','linkedin')),
  etapa           text not null check (etapa in ('nuevo','contactado','calificado','llamada','propuesta','ganado','perdido')),
  fecha_ingreso   date not null default current_date,
  responsable     text not null references personas(id),
  nota            text,
  created_at      timestamptz not null default now()
);

-- ─── Tabla: paginas ──────────────────────────────────────────────────────────
create table if not exists paginas (
  id            text primary key default gen_random_uuid()::text,
  nombre        text not null,
  tipo          text not null check (tipo in ('banco-ideas','objetivos','actas')),
  icono         text not null default 'File',
  visibilidad   text not null check (visibilidad in ('equipo','solo-yo')),
  creado_por    text references personas(id),
  creado_en     date not null default current_date,
  created_at    timestamptz not null default now()
);

-- ─── Tabla: estados_banco (columnas kanban del banco de ideas) ───────────────
create table if not exists estados_banco (
  id          text primary key default gen_random_uuid()::text,
  pagina_id   text not null references paginas(id) on delete cascade,
  titulo      text not null,
  color       text not null default 'gray' check (color in ('gray','green','red','yellow','lime','blue')),
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── Tabla: ideas ────────────────────────────────────────────────────────────
create table if not exists ideas (
  id          text primary key default gen_random_uuid()::text,
  pagina_id   text not null references paginas(id) on delete cascade,
  texto       text not null,
  cliente     text not null default '',
  quienes     text[] not null default '{}',
  estado_id   text not null references estados_banco(id) on delete restrict,
  created_at  timestamptz not null default now()
);

-- ─── Tabla: objetivos ────────────────────────────────────────────────────────
create table if not exists objetivos (
  id              text primary key default gen_random_uuid()::text,
  pagina_id       text not null references paginas(id) on delete cascade,
  texto           text not null,
  responsables    text[] not null default '{}',
  hecho           boolean not null default false,
  orden           int not null default 0,
  created_at      timestamptz not null default now()
);

-- ─── Tabla: carpetas_actas ───────────────────────────────────────────────────
create table if not exists carpetas_actas (
  id          text primary key default gen_random_uuid()::text,
  pagina_id   text not null references paginas(id) on delete cascade,
  nombre      text not null,
  created_at  timestamptz not null default now()
);

-- ─── Tabla: actas ────────────────────────────────────────────────────────────
create table if not exists actas (
  id            text primary key default gen_random_uuid()::text,
  pagina_id     text not null references paginas(id) on delete cascade,
  fecha         date not null default current_date,
  tipo          text not null check (tipo in ('interno','cliente','kickoff','one-on-one','otro')),
  tipo_custom   text,
  cliente_id    text references clientes(id) on delete set null,
  participantes text[] not null default '{}',
  carpeta_id    text references carpetas_actas(id) on delete set null,
  puntos        text not null default '',
  pasos         text not null default '',
  created_at    timestamptz not null default now()
);

-- ─── Tabla: adjuntos_actas ───────────────────────────────────────────────────
create table if not exists adjuntos_actas (
  id            text primary key default gen_random_uuid()::text,
  acta_id       text not null references actas(id) on delete cascade,
  nombre        text not null,
  tipo          text not null,
  tamano        int not null,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

-- ─── Tabla: equipo_estado_hoy ────────────────────────────────────────────────
create table if not exists equipo_estado_hoy (
  persona_id  text not null references personas(id) on delete cascade,
  fecha       date not null default current_date,
  en_que      text not null default '',
  emoji       text not null default '🙂',
  created_at  timestamptz not null default now(),
  primary key (persona_id, fecha)
);

-- ─── Tabla: todos_personales ─────────────────────────────────────────────────
create table if not exists todos_personales (
  id          text primary key default gen_random_uuid()::text,
  persona_id  text not null references personas(id) on delete cascade,
  texto       text not null,
  hecho       boolean not null default false,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- RLS — habilitado en todas las tablas, políticas permisivas
-- (auth real se maneja en Next.js; service role key bypasea RLS de todos modos)
-- ══════════════════════════════════════════════════════════════════════════════

alter table personas           enable row level security;
alter table clientes           enable row level security;
alter table seguimiento        enable row level security;
alter table notas              enable row level security;
alter table reuniones          enable row level security;
alter table tareas             enable row level security;
alter table leads              enable row level security;
alter table paginas            enable row level security;
alter table estados_banco      enable row level security;
alter table ideas              enable row level security;
alter table objetivos          enable row level security;
alter table carpetas_actas     enable row level security;
alter table actas              enable row level security;
alter table adjuntos_actas     enable row level security;
alter table equipo_estado_hoy  enable row level security;
alter table todos_personales   enable row level security;

-- Política permisiva para todas las tablas (service role bypasea esto, pero lo
-- dejamos para que funcione con anon key si se necesita en el futuro)
do $$ declare t text; begin
  foreach t in array array[
    'personas','clientes','seguimiento','notas','reuniones','tareas','leads',
    'paginas','estados_banco','ideas','objetivos','carpetas_actas','actas',
    'adjuntos_actas','equipo_estado_hoy','todos_personales'
  ] loop
    execute format('
      create policy "allow_all_%s" on %I
        for all using (true) with check (true)
    ', t, t);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- STORAGE — bucket para adjuntos de actas
-- ══════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
  values ('adjuntos-actas', 'adjuntos-actas', false)
  on conflict (id) do nothing;

create policy "allow_all_adjuntos_actas_storage"
  on storage.objects for all
  using (bucket_id = 'adjuntos-actas')
  with check (bucket_id = 'adjuntos-actas');
