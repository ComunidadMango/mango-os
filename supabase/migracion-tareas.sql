-- Las 2 tareas reales que ya tenían escritas viven hoy solo como respaldo en
-- el código (lib/data.ts) — la tabla "tareas" en Supabase está vacía, por eso
-- ningún cambio (arrastrar, completar, editar) se guarda de verdad. Esto las
-- carga en la base. Es seguro: on conflict do nothing, no pisa nada.
insert into tareas (id, titulo, descripcion, estado, responsable, asignada_por, cliente_id, vence, adjuntos) values
  (
    't-easyliving-brief1', 'Brief conjunto 1 — sale EasyLiving',
    'En este link están los guiones para mandarle a Maru y las descripciones de las placas y carruseles:
https://docs.google.com/document/d/1FFgldmypDiSdbz_kL778XXGgfawQRbTx/edit?usp=drive_link&ouid=105517922283100650936&rtpof=true&sd=true

Contenido:
1) Video voz en off
2) Video selfie Maru
3) Placa estática
4) Carrusel

Deja el conjunto siguiente mañana al volver de grabar.',
    'pendiente', 'feli', 'maru', 'easy-living', '2026-08-19', 0
  ),
  (
    't-grupocuenca-brief1', 'Brief técnicos I — Grupo Cuenca',
    'Adjunto link del brief:
https://docs.google.com/spreadsheets/d/10zTGiTWUgFVaJQLfooSxDFD0IGNrwEcE/edit?gid=1639559081#gid=1639559081

VIDEOS:
1) Comprar un repuesto · CL 2 AN 2 (Técnicos país)
2) Si estás lejos · CL 2 AN 1 (Técnicos país)
3) Perdiste un cliente · CL 2 AN 1 (Técnicos país)
4) Hay dos formas · CL 2 AN 2 (Técnicos país)

PLACAS:
1) Repuestos línea blanca · Cluster 2 AN 1
2) Comparativa · Cluster 2 AN 1
3) Si no es lo que necesito · Cluster 2 AN 2
4) Así compras en Cuenca · Cluster 2 AN 2',
    'pendiente', 'feli', 'maru', 'grupo-cuenca', '2026-08-19', 0
  )
on conflict (id) do nothing;
