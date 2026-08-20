-- Deja todos los clientes en un estado limpio: Pauta "En objetivo",
-- Relación y Trabajo vacíos (sin alertas). Para arrancar a usar el
-- dashboard desde cero, sin datos de ejemplo.
update clientes set
  pauta_estado    = 'ok', pauta_detalle    = 'En objetivo',
  relacion_estado = 'ok', relacion_detalle = '',
  trabajo_estado  = 'ok', trabajo_detalle  = '';
