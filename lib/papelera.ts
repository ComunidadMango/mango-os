// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoPapelera =
  | "nota"
  | "proceso"
  | "finanza-cliente"
  | "finanza-equipo"
  | "finanza-gasto"
  | "seccion"
  | "carpeta-extra"
  | "tarea"
  | "columna"
  | "etapa"
  | "paso";

export type ItemPapelera = {
  id: string;
  tipo: TipoPapelera;
  titulo: string;
  datos: unknown;
  borradoEn: string;
};

// ─── Persistencia ─────────────────────────────────────────────────────────────

export const KEY_PAPELERA = "mango-papelera-v2";

export function leerPapelera(): ItemPapelera[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY_PAPELERA) ?? "[]"); } catch { return []; }
}

function guardar(items: ItemPapelera[]) {
  localStorage.setItem(KEY_PAPELERA, JSON.stringify(items));
}

export function enviarAPapelera(item: Omit<ItemPapelera, "borradoEn">): void {
  guardar([{ ...item, borradoEn: new Date().toISOString() }, ...leerPapelera()]);
}

export function eliminarDePapelera(id: string): void {
  guardar(leerPapelera().filter((i) => i.id !== id));
}

// ─── Restaurar ────────────────────────────────────────────────────────────────

const TIPOS_RESTAURABLES: TipoPapelera[] = [
  "nota", "proceso",
  "finanza-cliente", "finanza-equipo", "finanza-gasto",
  "seccion", "carpeta-extra",
  "columna",
];

export function esRestaurable(tipo: TipoPapelera): boolean {
  return TIPOS_RESTAURABLES.includes(tipo);
}

export function restaurar(id: string): boolean {
  const items = leerPapelera();
  const item = items.find((i) => i.id === id);
  if (!item) return false;

  try {
    switch (item.tipo) {
      case "nota": {
        const notas = JSON.parse(localStorage.getItem("mango-notas-v1") ?? "[]");
        localStorage.setItem("mango-notas-v1", JSON.stringify([item.datos, ...notas]));
        break;
      }
      case "proceso": {
        const procesos = JSON.parse(localStorage.getItem("mango-procesos-v1") ?? "[]");
        localStorage.setItem("mango-procesos-v1", JSON.stringify([item.datos, ...procesos]));
        break;
      }
      case "finanza-cliente":
      case "finanza-equipo":
      case "finanza-gasto": {
        const raw = localStorage.getItem("mango-finanzas-estado-v3");
        const estado = raw
          ? JSON.parse(raw)
          : { mes: "", clientes: [], equipo: [], gastos: [] };
        if (item.tipo === "finanza-cliente")
          estado.clientes = [item.datos, ...(estado.clientes ?? [])];
        if (item.tipo === "finanza-equipo")
          estado.equipo = [item.datos, ...(estado.equipo ?? [])];
        if (item.tipo === "finanza-gasto")
          estado.gastos = [item.datos, ...(estado.gastos ?? [])];
        localStorage.setItem("mango-finanzas-estado-v3", JSON.stringify(estado));
        break;
      }
      case "seccion": {
        const secciones = JSON.parse(localStorage.getItem("mango-archivos-secciones") ?? "[]");
        localStorage.setItem("mango-archivos-secciones", JSON.stringify([item.datos, ...secciones]));
        break;
      }
      case "carpeta-extra": {
        const carpetas = JSON.parse(localStorage.getItem("mango-archivos-carpetas-extra") ?? "[]");
        localStorage.setItem("mango-archivos-carpetas-extra", JSON.stringify([item.datos, ...carpetas]));
        break;
      }
      case "columna": {
        const columnas = JSON.parse(localStorage.getItem("mango-tareas-columnas") ?? "[]");
        localStorage.setItem("mango-tareas-columnas", JSON.stringify([...columnas, item.datos]));
        break;
      }
      default:
        return false;
    }
    guardar(items.filter((i) => i.id !== id));
    return true;
  } catch {
    return false;
  }
}
