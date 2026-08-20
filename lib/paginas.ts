import {
  Lightbulb,
  Target,
  FileText,
  File,
  BarChart2,
  Users,
  Star,
  Zap,
  BookOpen,
  Heart,
  Rocket,
  Hash,
  type LucideIcon,
} from "lucide-react";

export type TipoPagina = "banco-ideas" | "objetivos" | "actas";
export type VisibilidadPagina = "equipo" | "solo-yo";

export type PaginaCustom = {
  id: string;
  nombre: string;
  tipo: TipoPagina;
  icono: string;
  visibilidad: VisibilidadPagina;
  creadoEn: string;
};

export const ICONOS_PAGINA: Record<string, LucideIcon> = {
  Lightbulb,
  Target,
  FileText,
  File,
  BarChart2,
  Users,
  Star,
  Zap,
  BookOpen,
  Heart,
  Rocket,
  Hash,
};
