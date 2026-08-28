-- Permite asignar una tarea a varias personas. "responsable" (singular) se
-- mantiene como el asignado principal, para no romper los recordatorios/
-- reportes que ya filtran por él. "responsables" es la lista completa, y
-- "completados_por" registra quién de esa lista ya terminó su parte — la
-- tarea pasa a la última columna recién cuando están todos.
alter table tareas add column if not exists responsables text[] not null default '{}';
alter table tareas add column if not exists completados_por text[] not null default '{}';

-- Completar el historial: cada tarea ya cargada pasa a tener como
-- "responsables" a su único responsable actual.
update tareas set responsables = array[responsable] where responsables = '{}';
