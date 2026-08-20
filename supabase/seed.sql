-- ══════════════════════════════════════════════════════════════════════════════
-- MANGO OS — Seed con todos los datos mock de lib/data.ts
-- Correr DESPUÉS de schema.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Personas (equipo) ───────────────────────────────────────────────────────
insert into personas (id, nombre, rol, inicial, animo, en_que, email) values
  ('cami', 'Cami', 'Founder',           'C', '🙂', 'Reunión con Inner Space',    'cami@comunidadmango.com'),
  ('theo', 'Theo', 'Media Buyer',       'T', '😐', 'Reportes de agosto',          'theo@comunidadmango.com'),
  ('feli', 'Feli', 'Creative',          'F', '😄', 'Creativos de Casa Praga',     'feli@comunidadmango.com'),
  ('mili', 'Mili', 'Content & Account', 'M', '🙂', 'Grabación en MDN Muebles',   'mili@comunidadmango.com'),
  ('maru', 'Maru', 'Tech Ops',          'M', '😄', 'Construyendo Mango OS',       'maru@comunidadmango.com')
on conflict (id) do nothing;

-- ─── Clientes ────────────────────────────────────────────────────────────────
insert into clientes (
  id, nombre, rubro, descripcion, responsable, media_buyer, fee, fecha_alta, interno,
  pauta_estado, pauta_detalle,
  relacion_estado, relacion_detalle,
  trabajo_estado, trabajo_detalle,
  ultimo_contacto
) values
  (
    'bs-odontologia', 'BS Odontología', 'Salud',
    'Consultorio odontológico en Palermo. Captación de nuevos pacientes vía Meta con foco en implantes y ortodoncia.',
    'cami', 'theo', 450, '2025-11-01', false,
    'ok', 'En objetivo',
    'ok', 'Bien',
    'ok', 'Al día',
    '2026-08-06'
  ),
  (
    'casa-praga', 'Casa Praga', 'Deco & hogar',
    'E-commerce de decoración con fuerte mix de catálogo. Apuntan a audiencias frías con video y carrusel.',
    'cami', 'theo', 600, '2025-09-15', false,
    'atencion', 'Costo +34% esta semana',
    'ok', 'Bien',
    'ok', 'Al día',
    '2026-08-07'
  ),
  (
    'easy-living', 'Easy Living', 'Deco & hogar',
    'Marca de muebles y living para el hogar. Generan contenido propio mensual; nosotros hacemos la distribución y optimización.',
    'mili', 'theo', 550, '2025-10-01', false,
    'ok', '18% mejor que el objetivo',
    'ok', 'Bien',
    'atencion', 'Faltan creativos nuevos',
    '2026-08-05'
  ),
  (
    'grupo-cuenca', 'Grupo Cuenca', 'Servicios',
    'Empresa de servicios de mantenimiento B2C. Campañas de captación de leads, alto volumen de formularios.',
    'cami', 'theo', 700, '2025-07-01', false,
    'ok', 'En objetivo',
    'critico', 'Reclamó dos veces esta semana',
    'critico', 'Reporte de julio sin enviar',
    '2026-08-04'
  ),
  (
    'mdn-muebles', 'MDN Muebles', 'Muebles',
    'Local de muebles en Zona Norte. Hacemos contenido en el local mensualmente + distribución en Meta.',
    'mili', 'theo', 500, '2025-12-01', false,
    'ok', 'En objetivo',
    'ok', 'Bien',
    'ok', 'Al día',
    '2026-08-07'
  ),
  (
    'remate-deco', 'Remate Deco & Home', 'Deco & hogar',
    'Marca de outlet de decoración. Flujo de publicaciones alto, campañas de conversión con catálogo dinámico.',
    'mili', 'theo', 480, '2026-01-15', false,
    'atencion', 'Frecuencia alta en la campaña principal',
    'ok', 'Bien',
    'ok', 'Al día',
    '2026-08-06'
  ),
  (
    'inner-space', 'Inner Space', 'Bienestar',
    'Centro de yoga y bienestar. Campañas orientadas a captación de alumnos nuevos para clases presenciales y online.',
    'cami', null, 400, '2026-02-01', false,
    'ok', 'En objetivo',
    'ok', 'Reunión hoy 16:00',
    'ok', 'Al día',
    '2026-08-07'
  ),
  (
    'milega-namaste', 'Milega Namaste', 'Bienestar',
    'Marca de accesorios y ropa de yoga. E-commerce de ticket medio, trabajamos con UGC y retargeting.',
    'cami', null, 420, '2026-07-01', false,
    'ok', 'Recién dada de alta',
    'atencion', 'Hace 9 días que nadie habla con ellos',
    'ok', 'Al día',
    '2026-07-29'
  ),
  (
    'mango', 'Mango', 'Cuenta propia',
    'Comunidad Mango — nuestra propia cuenta. Lead gen para el servicio de paid media.',
    'cami', null, null, '2024-01-01', true,
    'atencion', 'Sin campañas activas',
    'ok', '—',
    'ok', 'Al día',
    '2026-08-07'
  )
on conflict (id) do nothing;

-- ─── Seguimiento ─────────────────────────────────────────────────────────────
insert into seguimiento (id, cliente_id, fecha, quien, canal, tono, resumen) values
  ('s2',  'grupo-cuenca',   '2026-08-06', 'cami', 'llamada',     'tenso',  'Volvió a reclamar por el reporte de julio. Le prometí que sale el lunes sin falta.'),
  ('s3',  'grupo-cuenca',   '2026-08-04', 'mili', 'whatsapp',    'neutro', 'Preguntó por el reporte. Le dije que estábamos terminándolo.'),
  ('s4',  'casa-praga',     '2026-08-07', 'mili', 'whatsapp',    'bien',   'Quiere sumar la línea de living a la pauta desde septiembre. Mandó fotos nuevas.'),
  ('s5',  'casa-praga',     '2026-08-05', 'mili', 'mail',        'bien',   'Aprobó los creativos de la campaña de invierno.'),
  ('s6',  'easy-living',    '2026-08-05', 'mili', 'reunion',     'bien',   'Reunión mensual. Contentos con los resultados, pidieron más volumen de creativos.'),
  ('s7',  'inner-space',    '2026-08-07', 'cami', 'reunion',     'bien',   'Reunión de estrategia Q4 hoy 16:00.'),
  ('s8',  'mdn-muebles',    '2026-08-07', 'mili', 'whatsapp',    'bien',   'Coordinamos la grabación en el local para el viernes.'),
  ('s9',  'bs-odontologia', '2026-08-06', 'mili', 'mail',        'bien',   'Mandamos el reporte de julio. Respondió conforme.'),
  ('s10', 'remate-deco',    '2026-08-06', 'mili', 'whatsapp',    'neutro', 'Consultó por el rendimiento de la última campaña.')
on conflict (id) do nothing;

-- ─── Notas ───────────────────────────────────────────────────────────────────
insert into notas (id, cliente_id, autor, texto, menciones) values
  ('n1', 'casa-praga',   'mili', 'El cliente pidió sumar la línea de living a la pauta desde septiembre. @theo ¿lo armamos como campaña aparte o lo metemos en la actual? @feli van a hacer falta placas nuevas.', array['theo','feli']),
  ('n2', 'casa-praga',   'theo', 'Separé las audiencias frías de las de retargeting. El costo debería empezar a bajar en 3 o 4 días.', array[]::text[]),
  ('n3', 'grupo-cuenca', 'cami', 'Segundo reclamo por el reporte de julio. @theo esto es prioridad uno, no puede volver a pasar.',                                                                                 array['theo']),
  ('n4', 'easy-living',  'mili', 'El creativo nuevo que subió @feli el martes se lleva el 60% de los resultados. Vale la pena hacer más de ese estilo.',                                                         array['feli'])
on conflict (id) do nothing;

-- ─── Reuniones ───────────────────────────────────────────────────────────────
insert into reuniones (id, cliente_id, fecha, titulo, tipo, asistentes, duracion, notas, transcripcion) values
  (
    're1', 'casa-praga', '2026-08-05', 'Revisión de resultados — agosto', 'mensual',
    array['cami','mili'], 45,
    'Aprobaron creativos de invierno. Quieren sumar living en septiembre. Cami coordina con Feli para nuevas placas.',
    'Cami: Buenas tardes, gracias por conectarse. ¿Cómo están?
Cliente: Bien, contentos con lo de la semana pasada la verdad.
Cami: Nos alegra. Los creativos nuevos que subió el equipo esta semana están traccionando muy bien, el CPR bajó un 18%.
Cliente: Sí, lo vi en el reporte. Justo quería preguntarles: ¿podemos sumar la línea de living para septiembre? Estamos con stock nuevo.
Mili: Podemos hacerlo. ¿Tienen fotos del producto nuevo o necesitamos coordinar una grabación?
Cliente: Tenemos algunas fotos pero estaría bueno grabar también.
Cami: Lo coordinamos con Feli y te mandamos disponibilidad esta semana.'
  ),
  (
    're2', 'inner-space', '2026-08-07', 'Estrategia Q4', 'estrategia',
    array['cami'], 60,
    'Foco en retargeting para Q4. Presupuesto a confirmar el 15. Quieren correr Black Friday desde el 10 de noviembre.',
    null
  ),
  (
    're3', 'easy-living', '2026-08-05', 'Reunión mensual', 'mensual',
    array['cami','mili'], 30,
    'Contentos con resultados. Piden más volumen de creativos — al menos 6 piezas nuevas por mes.',
    null
  )
on conflict (id) do nothing;

-- ─── Tareas ──────────────────────────────────────────────────────────────────
insert into tareas (id, titulo, descripcion, estado, responsable, asignada_por, cliente_id, vence, adjuntos) values
  ('t1', 'Reporte de julio — Grupo Cuenca',       'Lleva una semana de retraso, prioritario',       'en_curso',  'theo', 'cami', 'grupo-cuenca', '2026-08-10', 0),
  ('t2', 'Creativos línea living — Casa Praga',   'Al menos 4 piezas para pauta de septiembre',     'pendiente', 'feli', 'mili', 'casa-praga',   '2026-08-15', 0),
  ('t3', 'Auditar campañas MDN Muebles',          '',                                               'pendiente', 'theo', null,   'mdn-muebles',  '2026-08-12', 0),
  ('t4', 'Propuesta estrategia Q4 — Inner Space', '',                                               'pendiente', 'cami', null,   'inner-space',  '2026-08-25', 0),
  ('t5', 'Documentar proceso de onboarding',      '',                                               'pendiente', 'maru', 'cami', null,           '2026-08-20', 0)
on conflict (id) do nothing;

-- ─── Leads ───────────────────────────────────────────────────────────────────
insert into leads (id, nombre, empresa, origen, etapa, fecha_ingreso, responsable, nota) values
  ('l1',  'Estudio Vitali',      'Arquitectura',  'instagram',  'nuevo',      '2026-08-08', 'mili', null),
  ('l2',  'Farmacia Hernández',  null,            'referido',   'nuevo',      '2026-08-07', 'mili', null),
  ('l3',  'Óptica Buen Ver',     null,            'formulario', 'nuevo',      '2026-08-10', 'mili', null),
  ('l4',  'La Pergola',          'Gastronomía',   'instagram',  'contactado', '2026-08-05', 'mili', null),
  ('l5',  'Belleza Natural',     null,            'formulario', 'contactado', '2026-08-03', 'mili', null),
  ('l6',  'Mundo Fitness',       'Bienestar',     'instagram',  'contactado', '2026-07-30', 'cami', null),
  ('l7',  'Clínica San Martín',  'Salud',         'referido',   'calificado', '2026-07-28', 'mili', null),
  ('l8',  'Resto El Barco',      'Gastronomía',   'instagram',  'calificado', '2026-07-20', 'cami', null),
  ('l9',  'Constructora López',  'Construcción',  'linkedin',   'llamada',    '2026-07-15', 'cami', 'Llamada agendada · 12 ago 11:00'),
  ('l10', 'Studio Pilates BA',   null,            'instagram',  'propuesta',  '2026-07-01', 'cami', 'Esperando feedback del presupuesto'),
  ('l11', 'Farmacenter',         'Salud',         'referido',   'propuesta',  '2026-06-25', 'cami', null),
  ('l12', 'Centro de Idiomas',   null,            'formulario', 'ganado',     '2026-08-01', 'cami', null),
  ('l13', 'Muebles Rodríguez',   null,            'formulario', 'ganado',     '2026-06-10', 'cami', null),
  ('l14', 'Studio Zen',          null,            'referido',   'ganado',     '2026-06-15', 'cami', null),
  ('l15', 'TechCorp',            null,            'linkedin',   'perdido',    '2026-07-01', 'cami', 'Presupuesto fuera de rango')
on conflict (id) do nothing;
