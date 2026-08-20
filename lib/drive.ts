// Servidor únicamente — no importar desde componentes client

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export const MIME_FOLDER = "application/vnd.google-apps.folder";
export const DRIVE_ID = process.env.DRIVE_SHARED_ID ?? "";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
};

// Parámetros requeridos para Shared Drives
const SD = { supportsAllDrives: "true", includeItemsFromAllDrives: "true" };

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function p(extra: Record<string, string> = {}) {
  return new URLSearchParams({ ...SD, ...extra });
}

// ── Lista contenido de una carpeta ────────────────────────────────────────────
export async function listFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const params = p({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
    orderBy: "folder,name",
    driveId: DRIVE_ID,
    corpora: "drive",
  });
  const res = await fetch(`${API}/files?${params}`, { headers: auth(token) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.files ?? []) as DriveFile[];
}

// ── Busca una carpeta por nombre dentro de un parent ─────────────────────────
export async function findFolder(token: string, name: string, parentId: string): Promise<string | null> {
  const safeName = name.replace(/'/g, "\\'");
  const params = p({
    q: `name='${safeName}' and '${parentId}' in parents and mimeType='${MIME_FOLDER}' and trashed=false`,
    fields: "files(id)",
    driveId: DRIVE_ID,
    corpora: "drive",
  });
  const res = await fetch(`${API}/files?${params}`, { headers: auth(token) });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.files?.[0]?.id as string) ?? null;
}

// ── Crea una carpeta ──────────────────────────────────────────────────────────
export async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch(`${API}/files?${p()}`, {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ name, mimeType: MIME_FOLDER, parents: [parentId] }),
  });
  const data = await res.json();
  return data.id as string;
}

// ── Busca o crea (idempotente) ────────────────────────────────────────────────
export async function getOrCreate(token: string, name: string, parentId: string): Promise<string> {
  const existing = await findFolder(token, name, parentId);
  return existing ?? (await createFolder(token, name, parentId));
}

// ── Mueve a la papelera (trashed: true) ──────────────────────────────────────
export async function deleteItem(token: string, fileId: string): Promise<void> {
  await fetch(`${API}/files/${fileId}?${p()}`, {
    method: "PATCH",
    headers: auth(token),
    body: JSON.stringify({ trashed: true }),
  });
}

// ── Sube un archivo (multipart) ───────────────────────────────────────────────
export async function uploadFile(
  token: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
  parentId: string,
): Promise<DriveFile> {
  const boundary = "mango_boundary_x7z";
  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });

  const pre = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const post = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([pre, fileBuffer, post]);

  const params = p({ uploadType: "multipart" });
  const res = await fetch(`${UPLOAD_API}/files?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  return res.json() as Promise<DriveFile>;
}
