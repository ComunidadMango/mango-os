-- Quién más (aparte de Cami y Maru) tiene acceso de lectura a Finanzas.
-- Antes esto se guardaba solo en el localStorage del navegador de quien lo
-- otorgaba, así que en la práctica no se compartía entre Cami y Maru ni
-- tenía efecto real. Ahora vive en la base, controlado solo por ellas dos
-- (server-side, no solo en la pantalla).
create table if not exists finanzas_accesos (
  persona_id    text primary key references personas(id) on delete cascade,
  otorgado_por  text references personas(id),
  created_at    timestamptz not null default now()
);
