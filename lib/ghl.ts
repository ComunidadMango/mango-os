export const GHL_LOCATION_ID = "ESGEvAjEHHaPuHAMe2lB";

// Mapeo de custom field IDs → etiquetas del formulario de diagnóstico
export const CAMPO_LABELS: Record<string, string> = {
  "fMw1eSStlPuI8si0eNZZ": "Tipo de negocio",
  "pVzhD7yoAKXgZ3ZFhgbW": "Instagram / Redes",
  "IGqvDOuW9Zrs69C1vwth": "Facturación mensual",
  "2w5ojhtp9Ow1UX4AvGkI": "Inversión en pauta actual",
  "Vhtr4NLsVacNYpHpuiMr": "Situación actual del negocio",
  "yeIhfSAZKHzrwIYGDDIe": "Qué busca del servicio",
  "guJSiF82RPAK5Y3CswXr": "Resultado diagnóstico",
};

export type GhlContactDetail = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  dateAdded: string;
  tags: string[];
  customFields: { id: string; value: string }[];
  attributionSource?: { sessionSource?: string; adName?: string; medium?: string };
};

// Pipeline IDs
export const PIPELINE_HAY_FIT   = "WevY1kmmXqkQgsDODMqb";
export const PIPELINE_NO_FIT    = "As0Pwu5FO6iC33gwIpob";

// Etapas de "Pipeline Mango - Hay fit"
export const ETAPAS_HAY_FIT = [
  { id: "ed3b2dd2-5e85-482d-bbcb-6d621731a059", nombre: "Nuevo Lead Calificado", pos: 0 },
  { id: "3a9af6a3-7e6e-4dd6-a05e-a66183d221c6", nombre: "Reunión Agendada",      pos: 1 },
  { id: "b1e3e827-ab6c-4e66-bfb2-90c9b1f906b4", nombre: "Reunión Realizada",     pos: 2 },
  { id: "37610453-0b3c-4165-845b-ca2c87a2830e", nombre: "Propuesta enviada",     pos: 3 },
  { id: "82472467-6019-41f0-b6a8-23b78b269a02", nombre: "Ganado",                pos: 4 },
  { id: "633ce5f4-d53a-4845-95cb-55b5c4e0dace", nombre: "Perdido",               pos: 5 },
] as const;

export type GhlOpportunity = {
  id: string;
  name: string;
  status: "open" | "won" | "lost" | "abandoned";
  pipelineStageId: string;
  monetaryValue: number;
  source: string | null;
  createdAt: string;
  lastStageChangeAt: string;
  contact: {
    id: string;
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
  } | null;
};

export async function getContact(contactId: string): Promise<GhlContactDetail> {
  const apiKey = process.env.GHL_API_KEY!;
  const res = await fetch(
    `https://services.leadconnectorhq.com/contacts/${contactId}`,
    { headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28" }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`GHL ${res.status}`);
  const data = await res.json();
  return data.contact as GhlContactDetail;
}

export async function searchOpportunities(
  pipelineId: string,
  status: "open" | "won" | "lost" | "all" = "open",
  limit = 100,
): Promise<{ opportunities: GhlOpportunity[]; total: number }> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) return { opportunities: [], total: 0 };

  const params = new URLSearchParams({
    location_id: GHL_LOCATION_ID,
    pipeline_id:  pipelineId,
    status,
    limit:        String(limit),
  });

  const res = await fetch(
    `https://services.leadconnectorhq.com/opportunities/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version:        "2021-07-28",
      },
      next: { revalidate: 60 }, // cachea 1 min
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    opportunities: (data.opportunities ?? []) as GhlOpportunity[],
    total:         data.meta?.total ?? 0,
  };
}
