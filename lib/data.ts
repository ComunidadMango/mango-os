// ─── lib/data.ts ─────────────────────────────────────────────────────────────
// Los tipos siguen aquí. Los datos ahora vienen de Supabase vía API routes.
// Las funciones persona() y cliente() usan un cache en memoria que se llena
// desde los Server Components / hooks que hacen fetch al iniciar.
//
// Los arrays de mock (equipo, clientes, seguimiento, etc.) se conservan como
// fallback de desarrollo hasta que se configure SUPABASE_URL. En producción con
// Supabase activo, el componente raíz llama setPersonasCache/setClientesCache.
// ─────────────────────────────────────────────────────────────────────────────

export type Rol =
  | "Founder"
  | "Media Buyer"
  | "Creative"
  | "Content & Account"
  | "Tech Ops";

export type Persona = {
  id: string;
  nombre: string;
  rol: Rol;
  inicial: string;
  animo: string | null;
  enQue: string;
  foto?: string;
  email?: string;
};

// ─── Datos de fallback (desarrollo sin Supabase) ──────────────────────────────
// El email real de cada persona NO tiene por qué empezar igual que su id
// (ej: id "cami" pero mail camila@...). El id es solo una clave interna.
export const equipo: Persona[] = [
  { id: "cami", nombre: "Cami", rol: "Founder",           inicial: "C", animo: null, enQue: "", email: "camila@comunidadmango.com" },
  { id: "theo", nombre: "Theo", rol: "Media Buyer",       inicial: "T", animo: null, enQue: "", email: "matheo@comunidadmango.com" },
  { id: "feli", nombre: "Feli", rol: "Creative",          inicial: "F", animo: null, enQue: "", email: "felicitas@comunidadmango.com" },
  { id: "mili", nombre: "Mili", rol: "Content & Account", inicial: "M", animo: null, enQue: "", email: "milagros@comunidadmango.com" },
  { id: "maru",  nombre: "Maru",  rol: "Tech Ops",          inicial: "M", animo: null, enQue: "", email: "maria@comunidadmango.com" },
  { id: "lucia", nombre: "Lucía", rol: "Content & Account", inicial: "L", animo: null, enQue: "", email: "lucia@comunidadmango.com" },
];

export const usuarioActual = equipo.find((p) => p.id === "maru")!;

export function personaPorEmail(email: string): Persona | undefined {
  const lower = email.toLowerCase();
  // Matchear por el email real es lo confiable — el id es solo una clave interna
  // que no necesariamente coincide con el principio del mail de cada persona.
  const porEmail = _personas.find((p) => p.email?.toLowerCase() === lower)
    ?? equipo.find((p) => p.email?.toLowerCase() === lower);
  if (porEmail) return porEmail;

  // Fallback legacy por si alguna persona no tiene email cargado todavía
  const id = email.split("@")[0];
  return _personas.find((p) => p.id === id) ?? equipo.find((p) => p.id === id);
}

export type Senal = "ok" | "atencion" | "critico";

export type Cliente = {
  id: string;
  nombre: string;
  rubro: string;
  responsable: string;
  mediaBuyer?: string;
  descripcion?: string;
  fechaAlta?: string;
  fee?: number;
  interno?: boolean;
  pauta: { estado: Senal; detalle: string };
  relacion: { estado: Senal; detalle: string };
  trabajo: { estado: Senal; detalle: string };
  ultimoContacto: string | null;
};

// Fallback de clientes para desarrollo sin Supabase
export const clientes: Cliente[] = [
  {
    id: "bs-odontologia", nombre: "BS Odontología", rubro: "Salud",
    responsable: "cami", mediaBuyer: "theo",
    descripcion: "Consultorio odontológico en Palermo. Captación de nuevos pacientes vía Meta con foco en implantes y ortodoncia.",
    fee: 450, fechaAlta: "2025-11-01",
    pauta: { estado: "ok", detalle: "En objetivo" },
    relacion: { estado: "ok", detalle: "Al día" },
    trabajo: { estado: "ok", detalle: "Al día" },
    ultimoContacto: "2026-08-19",
  },
  {
    id: "casa-praga", nombre: "Casa Praga", rubro: "Deco & hogar",
    responsable: "cami", mediaBuyer: "theo",
    descripcion: "E-commerce de decoración con fuerte mix de catálogo. Apuntan a audiencias frías con video y carrusel.",
    fee: 600, fechaAlta: "2025-09-15",
    pauta: { estado: "ok", detalle: "" },
    relacion: { estado: "ok", detalle: "Al día" },
    trabajo: { estado: "ok", detalle: "Al día" },
    ultimoContacto: "2026-08-19",
  },
  {
    id: "easy-living", nombre: "Easy Living", rubro: "Deco & hogar",
    responsable: "mili", mediaBuyer: "theo",
    descripcion: "Marca de muebles y living para el hogar. Generan contenido propio mensual; nosotros hacemos la distribución y optimización.",
    fee: 550, fechaAlta: "2025-10-01",
    pauta: { estado: "ok", detalle: "18% mejor que el objetivo" },
    relacion: { estado: "ok", detalle: "Al día" },
    trabajo: { estado: "ok", detalle: "" },
    ultimoContacto: "2026-08-19",
  },
  {
    id: "grupo-cuenca", nombre: "Grupo Cuenca", rubro: "Servicios",
    responsable: "cami", mediaBuyer: "theo",
    descripcion: "Empresa de servicios de mantenimiento B2C. Campañas de captación de leads, alto volumen de formularios.",
    fee: 700, fechaAlta: "2025-07-01",
    pauta: { estado: "ok", detalle: "En objetivo" },
    relacion: { estado: "ok", detalle: "Al día" },
    trabajo: { estado: "ok", detalle: "" },
    ultimoContacto: "2026-08-19",
  },
  {
    id: "mdn-muebles", nombre: "MDN Muebles", rubro: "Muebles",
    responsable: "mili", mediaBuyer: "theo",
    descripcion: "Local de muebles en Zona Norte. Hacemos contenido en el local mensualmente + distribución en Meta.",
    fee: 500, fechaAlta: "2025-12-01",
    pauta: { estado: "ok", detalle: "En objetivo" },
    relacion: { estado: "ok", detalle: "Al día" },
    trabajo: { estado: "ok", detalle: "Al día" },
    ultimoContacto: "2026-08-19",
  },
  {
    id: "remate-deco", nombre: "Remate Deco & Home", rubro: "Deco & hogar",
    responsable: "mili", mediaBuyer: "theo",
    descripcion: "Marca de outlet de decoración. Flujo de publicaciones alto, campañas de conversión con catálogo dinámico.",
    fee: 480, fechaAlta: "2026-01-15",
    pauta: { estado: "atencion", detalle: "Frecuencia alta en la campaña principal" },
    relacion: { estado: "ok", detalle: "Al día" },
    trabajo: { estado: "ok", detalle: "Al día" },
    ultimoContacto: "2026-08-19",
  },
  {
    id: "inner-space", nombre: "Inner Space", rubro: "Bienestar",
    responsable: "cami",
    descripcion: "Centro de yoga y bienestar. Campañas orientadas a captación de alumnos nuevos para clases presenciales y online.",
    fee: 400, fechaAlta: "2026-02-01",
    pauta: { estado: "ok", detalle: "En objetivo" },
    relacion: { estado: "ok", detalle: "Al día" },
    trabajo: { estado: "ok", detalle: "Al día" },
    ultimoContacto: "2026-08-19",
  },
  {
    id: "milega-namaste", nombre: "Milega Namaste", rubro: "Bienestar",
    responsable: "cami",
    descripcion: "Marca de accesorios y ropa de yoga. E-commerce de ticket medio, trabajamos con UGC y retargeting.",
    fee: 420, fechaAlta: "2026-07-01",
    pauta: { estado: "ok", detalle: "Recién dada de alta" },
    relacion: { estado: "ok", detalle: "Al día" },
    trabajo: { estado: "ok", detalle: "Al día" },
    ultimoContacto: "2026-08-19",
  },
  {
    id: "mango", nombre: "Mango", rubro: "Cuenta propia",
    responsable: "cami", interno: true,
    descripcion: "Comunidad Mango — nuestra propia cuenta. Lead gen para el servicio de paid media.",
    fechaAlta: "2024-01-01",
    pauta: { estado: "ok", detalle: "" },
    relacion: { estado: "ok", detalle: "—" },
    trabajo: { estado: "ok", detalle: "Al día" },
    ultimoContacto: "2026-08-19",
  },
];

// ─── Cache de Supabase ────────────────────────────────────────────────────────
// Estos arrays se llenan desde Server Components o hooks que hacen fetch.
// Las funciones persona() y cliente() los priorizan sobre el fallback.

let _personas: Persona[] = [];
let _clientes: Cliente[] = [];

export function setPersonasCache(p: Persona[]): void { _personas = p; }
export function setClientesCache(c: Cliente[]): void { _clientes = c; }

// Lista completa del equipo: prioriza Supabase (con foto real de Google
// sincronizada al hacer login) sobre el fallback de desarrollo.
export function getEquipo(): Persona[] {
  return _personas.length > 0 ? _personas : equipo;
}

export function persona(id: string): Persona | undefined {
  return (
    _personas.find((p) => p.id === id) ??
    equipo.find((p) => p.id === id)
  );
}

export function cliente(id?: string): Cliente | undefined {
  if (!id) return undefined;
  return (
    _clientes.find((c) => c.id === id) ??
    clientes.find((c) => c.id === id)
  );
}

// ─── Tipos de seguimiento ─────────────────────────────────────────────────────
export type Canal = "whatsapp" | "mail" | "llamada" | "reunion" | "sin_contacto";
export type Tono  = "bien" | "neutro" | "tenso";

export type Contacto = {
  id: string;
  clienteId: string;
  fecha: string;
  quien: string | null;
  canal: Canal;
  resumen: string;
  tono: Tono;
};

export const canalTexto: Record<Canal, string> = {
  whatsapp:    "WhatsApp",
  mail:        "Mail",
  llamada:     "Llamada",
  reunion:     "Reunión",
  sin_contacto: "Sin contacto",
};

export const seguimiento: Contacto[] = [];

// ─── Tipos de notas ───────────────────────────────────────────────────────────
export type Nota = {
  id: string;
  clienteId: string;
  autor: string;
  fecha: string;
  texto: string;
  menciones: string[];
};

export const notas: Nota[] = [];

// ─── Tipos de tareas ──────────────────────────────────────────────────────────
export type EstadoTarea = string;

export type Tarea = {
  id: string;
  titulo: string;
  descripcion?: string;
  estado: EstadoTarea;
  responsable: string;
  asignadaPor: string | null;
  clienteId?: string;
  vence?: string;
  adjuntos: number;
};

export const tareas: Tarea[] = [
  {
    id: "t-easyliving-brief1",
    titulo: "Brief conjunto 1 — sale EasyLiving",
    descripcion: "En este link están los guiones para mandarle a Maru y las descripciones de las placas y carruseles:\nhttps://docs.google.com/document/d/1FFgldmypDiSdbz_kL778XXGgfawQRbTx/edit?usp=drive_link&ouid=105517922283100650936&rtpof=true&sd=true\n\nContenido:\n1) Video voz en off\n2) Video selfie Maru\n3) Placa estática\n4) Carrusel\n\nDeja el conjunto siguiente mañana al volver de grabar.",
    estado: "pendiente",
    responsable: "feli",
    asignadaPor: "maru",
    clienteId: "easy-living",
    vence: "2026-08-19",
    adjuntos: 0,
  },
  {
    id: "t-grupocuenca-brief1",
    titulo: "Brief técnicos I — Grupo Cuenca",
    descripcion: "Adjunto link del brief:\nhttps://docs.google.com/spreadsheets/d/10zTGiTWUgFVaJQLfooSxDFD0IGNrwEcE/edit?gid=1639559081#gid=1639559081\n\nVIDEOS:\n1) Comprar un repuesto · CL 2 AN 2 (Técnicos país)\n2) Si estás lejos · CL 2 AN 1 (Técnicos país)\n3) Perdiste un cliente · CL 2 AN 1 (Técnicos país)\n4) Hay dos formas · CL 2 AN 2 (Técnicos país)\n\nPLACAS:\n1) Repuestos línea blanca · Cluster 2 AN 1\n2) Comparativa · Cluster 2 AN 1\n3) Si no es lo que necesito · Cluster 2 AN 2\n4) Así compras en Cuenca · Cluster 2 AN 2",
    estado: "pendiente",
    responsable: "feli",
    asignadaPor: "maru",
    clienteId: "grupo-cuenca",
    vence: "2026-08-19",
    adjuntos: 0,
  },
];

// ─── Tipos de urgencia/alertas ────────────────────────────────────────────────
export type Urgencia = "urgente" | "media" | "vence_hoy" | "buena";

export type Alerta = {
  id: string;
  urgencia: Urgencia;
  texto: string;
  cuando: string;
  clienteId?: string;
};

export const alertas: Alerta[] = [];

// ─── Calendario ───────────────────────────────────────────────────────────────
export type TipoEvento = "reunion" | "grabacion" | "vencimiento" | "interno";

export type Evento = {
  id: string;
  dia: number;
  titulo: string;
  tipo: TipoEvento;
  hora?: string;
};

export const semana: Evento[] = [];

export const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie"];

export type EventoCalendario = {
  id: string;
  fecha: string;
  hora?: string;
  titulo: string;
  tipo: TipoEvento;
  clienteId?: string;
  participantes: string[];
};

export const eventosCalendario: EventoCalendario[] = [];

// ─── Archivos ─────────────────────────────────────────────────────────────────
export type TipoArchivo = "pdf" | "imagen" | "video" | "doc" | "hoja" | "zip";

export type Archivo = {
  id: string;
  nombre: string;
  tipo: TipoArchivo;
  tamano: string;
  subidoPor: string;
  fecha: string;
  clienteId?: string;
};

export const archivos: Archivo[] = [];

// ─── Pipeline / Leads ─────────────────────────────────────────────────────────
export type OrigenLead = "formulario" | "instagram" | "referido" | "linkedin";
export type EtapaLead  = "nuevo" | "contactado" | "calificado" | "llamada" | "propuesta" | "ganado" | "perdido";

export type Lead = {
  id: string;
  nombre: string;
  empresa?: string;
  origen: OrigenLead;
  etapa: EtapaLead;
  fechaIngreso: string;
  responsable: string;
  nota?: string;
};

export const leads: Lead[] = [];

// ─── Finanzas ─────────────────────────────────────────────────────────────────
export type Moneda       = "usd" | "ars";
export type EstadoCobro  = "al_dia" | "pendiente" | "vencido";

export type FilaFinanzas = {
  clienteId: string;
  fee: number;
  moneda: Moneda;
  estadoCobro: EstadoCobro;
  ultimoPago: string;
};

export const finanzas: FilaFinanzas[] = [];

export const ROLES_FINANZAS = ["cami", "maru"];

export type EstadoPagoPersona = "pagado" | "pendiente";

export type PagoPersona = {
  personaId: string;
  honorario: number;
  moneda: Moneda;
  estado: EstadoPagoPersona;
};

export const pagosEquipo: PagoPersona[] = [];

export type CategoriaGasto = "herramienta" | "tecnico" | "operativo" | "otro";

export type Gasto = {
  id: string;
  nombre: string;
  monto: number;
  moneda: Moneda;
  categoria: CategoriaGasto;
  recurrente: boolean;
};

export const gastos: Gasto[] = [];

// ─── Procesos ─────────────────────────────────────────────────────────────────
export type AreaProceso = "clientes" | "pauta" | "creativo" | "tecnico";

export type Proceso = {
  id: string;
  titulo: string;
  resumen: string;
  area: AreaProceso;
  responsable: string;
  actualizadoEn: string;
};

export const procesos: Proceso[] = [];

// ─── Reuniones ────────────────────────────────────────────────────────────────
export type TipoReunion = "kickoff" | "mensual" | "estrategia" | "seguimiento" | "otro";

export type Reunion = {
  id: string;
  clienteId: string;
  fecha: string;
  titulo: string;
  tipo: TipoReunion;
  asistentes: string[];
  duracion?: number;
  notas?: string;
  transcripcion?: string;
};

export const reuniones: Reunion[] = [];

// ─── Papelera ─────────────────────────────────────────────────────────────────
export type TipoBorrado = "tarea" | "nota" | "archivo" | "cliente";

export type Borrado = {
  id: string;
  tipo: TipoBorrado;
  titulo: string;
  borradoPor: string;
  fecha: string;
  contexto?: string;
};

export const papelera: Borrado[] = [];

// ─── Helpers de filtrado (siguen funcionando con datos de fallback) ───────────

export function seguimientoDe(clienteId: string): Contacto[] {
  return seguimiento
    .filter((s) => s.clienteId === clienteId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function notasDe(clienteId: string): Nota[] {
  return notas.filter((n) => n.clienteId === clienteId);
}

export function tareasDe(clienteId: string): Tarea[] {
  return tareas.filter((t) => t.clienteId === clienteId);
}

export function reunionesDe(clienteId: string): Reunion[] {
  return reuniones
    .filter((r) => r.clienteId === clienteId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function archivosDe(clienteId: string): Archivo[] {
  return archivos
    .filter((a) => a.clienteId === clienteId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function diasSinContacto(clienteId: string, hoy = new Date().toISOString().slice(0, 10)): number | null {
  const c = (_clientes.length > 0 ? _clientes : clientes).find((x) => x.id === clienteId);
  const uc = c?.ultimoContacto;
  if (!uc) return null;
  const ms = new Date(hoy).getTime() - new Date(uc).getTime();
  return Math.round(ms / 86_400_000);
}

export function senalRelacion(ultimoContacto: string | null): { estado: Senal; detalle: string } {
  if (!ultimoContacto) return { estado: "atencion", detalle: "Sin registros" };
  const hoy = new Date().toISOString().slice(0, 10);
  const dias = Math.round((new Date(hoy).getTime() - new Date(ultimoContacto).getTime()) / 86_400_000);
  if (dias <= 0)  return { estado: "ok",       detalle: "Contacto hoy" };
  if (dias === 1) return { estado: "ok",       detalle: "Contacto ayer" };
  if (dias <= 7)  return { estado: "ok",       detalle: `Contacto hace ${dias} días` };
  if (dias <= 14) return { estado: "atencion", detalle: `Sin contacto hace ${dias} días` };
  return                 { estado: "critico",  detalle: `Sin contacto hace ${dias} días` };
}

export function senalTrabajo(clienteId: string, tareasArr?: Tarea[]): { estado: Senal; detalle: string } {
  const origen = tareasArr ?? tareas;
  const abiertas = origen.filter((t) => t.clienteId === clienteId && t.estado !== "hecha");
  if (abiertas.length === 0) return { estado: "ok", detalle: "Sin pendientes" };

  const hoy = new Date().toISOString().slice(0, 10);
  const dm = new Date(hoy + "T12:00:00");
  dm.setDate(dm.getDate() + 1);
  const manana = dm.toISOString().slice(0, 10);

  const vencidas = abiertas.filter((t) => t.vence && t.vence < hoy);
  if (vencidas.length > 0) {
    return { estado: "critico", detalle: vencidas.length === 1 ? "1 tarea vencida" : `${vencidas.length} tareas vencidas` };
  }

  const urgentes = abiertas.filter((t) => t.vence && (t.vence === hoy || t.vence === manana));
  if (urgentes.length > 0) {
    return { estado: "atencion", detalle: urgentes[0].vence === hoy ? "Vence hoy" : "Vence mañana" };
  }

  return { estado: "ok", detalle: abiertas.length === 1 ? "1 tarea abierta" : `${abiertas.length} tareas abiertas` };
}
