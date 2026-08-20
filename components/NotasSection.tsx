"use client";

import { useRef, useState } from "react";
import { Plus, Send } from "lucide-react";
import { equipo, persona, type Nota } from "@/lib/data";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

// ─────────────────────────────────────────────────────────────────────────────

function fmtHora(): string {
  const d = new Date();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `hoy ${h}:${m}`;
}

function parseMenciones(texto: string): string[] {
  const matches: string[] = texto.match(/@(\w+)/g) ?? [];
  return equipo
    .filter((p) => matches.includes("@" + p.nombre))
    .map((p) => p.id);
}

function getMentionQuery(texto: string, cursor: number): string | null {
  const before = texto.slice(0, cursor);
  const match = before.match(/@(\w*)$/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function NotasSection({
  notas,
  clienteId,
}: {
  notas: Nota[];
  clienteId: string;
}) {
  const usuarioActual = useUsuarioActual();
  const [notasState, setNotasState] = useState<Nota[]>(notas);
  const [redactando, setRedactando] = useState(false);
  const [texto, setTexto] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionSugerencias = mentionQuery !== null
    ? equipo.filter((p) =>
        p.nombre.toLowerCase().startsWith(mentionQuery.toLowerCase())
      )
    : [];

  function onTextoChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setTexto(val);
    const cursor = e.target.selectionStart ?? val.length;
    setMentionQuery(getMentionQuery(val, cursor));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionSugerencias.length > 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
      if (e.key === "Enter" && mentionSugerencias.length === 1) {
        e.preventDefault();
        insertarMencion(mentionSugerencias[0].nombre);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      publicar();
    }
    if (e.key === "Escape" && !mentionSugerencias.length) {
      cancelar();
    }
  }

  function insertarMencion(nombre: string) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? texto.length;
    const before = texto.slice(0, cursor);
    const after = texto.slice(cursor);
    const newBefore = before.replace(/@(\w*)$/, "@" + nombre + " ");
    const newTexto = newBefore + after;
    setTexto(newTexto);
    setMentionQuery(null);
    setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(newBefore.length, newBefore.length);
    }, 0);
  }

  const [guardando, setGuardando] = useState(false);

  async function publicar() {
    const txt = texto.trim();
    if (!txt || guardando) return;

    const menciones = parseMenciones(txt);
    const nueva: Nota = {
      id: `n-${Date.now()}`,
      clienteId,
      autor: usuarioActual.id,
      fecha: fmtHora(),
      texto: txt,
      menciones,
    };

    setNotasState((prev) => [nueva, ...prev]);
    cancelar();

    setGuardando(true);
    fetch("/api/notas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:        nueva.id,
        clienteId,
        autorId:   usuarioActual.id,
        texto:     txt,
        menciones,
      }),
    })
      .catch(() => {})
      .finally(() => setGuardando(false));
  }

  function cancelar() {
    setTexto("");
    setMentionQuery(null);
    setRedactando(false);
  }

  return (
    <div className="rounded-card border border-line bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[13px] font-bold leading-none">
          Notas del equipo
        </span>
        <span className="text-[12px] text-ink-3">{notasState.length}</span>
      </div>

      {/* Redactor */}
      {redactando ? (
        <div className="relative mb-3">
          <textarea
            ref={textareaRef}
            autoFocus
            value={texto}
            onChange={onTextoChange}
            onKeyDown={onKeyDown}
            placeholder="Escribí tu nota… usá @Nombre para mencionar al equipo"
            rows={3}
            className="w-full resize-none rounded-[10px] border border-ink-3/40 bg-paper px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
          />

          {/* Dropdown de menciones */}
          {mentionSugerencias.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-48 rounded-[10px] border border-line bg-paper shadow-lg">
              {mentionSugerencias.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertarMencion(p.nombre);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors first:rounded-t-[10px] last:rounded-b-[10px] hover:bg-line-soft"
                  >
                    <span className="notch-sm flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-lime-soft text-[10px] font-bold text-ink">
                      {p.inicial}
                    </span>
                    <span className="font-medium">{p.nombre}</span>
                    <span className="ml-auto text-[11px] text-ink-3">{p.rol}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Acciones */}
          <div className="mt-2 flex items-center gap-2">
            <p className="text-[11.5px] text-ink-3">
              ⌘ + Enter para publicar · Esc para cancelar
            </p>
            <button
              type="button"
              onClick={cancelar}
              className="ml-auto rounded-[8px] px-3 py-1.5 text-[12.5px] text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={publicar}
              disabled={!texto.trim()}
              className="flex items-center gap-1.5 rounded-[8px] bg-lime px-3 py-1.5 text-[12.5px] font-bold text-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={12} strokeWidth={2.5} />
              Publicar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRedactando(true)}
          className="mb-3 flex w-full items-center gap-2 rounded-soft border border-dashed border-line px-3.5 py-2.5 text-[13px] text-ink-3 transition-colors hover:border-ink-3/50 hover:bg-paper hover:text-ink"
        >
          <Plus size={15} strokeWidth={2.2} />
          Escribir una nota
        </button>
      )}

      {/* Lista */}
      {notasState.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-3">Todavía no hay notas</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notasState.map((n) => {
            const autor = persona(n.autor);
            return (
              <li key={n.id} className="rounded-soft border border-line-soft p-3">
                <p className="mb-1.5 flex items-center gap-2 text-[12px] text-ink-3">
                  <span className="notch-sm flex h-5 w-5 items-center justify-center rounded-[7px] bg-lime-soft text-[10px] font-bold text-ink">
                    {autor?.inicial}
                  </span>
                  <span className="font-bold text-ink">{autor?.nombre}</span>
                  · {n.fecha}
                </p>
                <p className="text-[13.5px] leading-relaxed">
                  {n.texto.split(/(@\w+)/g).map((parte, i) =>
                    parte.startsWith("@") ? (
                      <span
                        key={i}
                        className="rounded-[5px] bg-lime-soft px-1 font-bold text-ink"
                      >
                        {parte}
                      </span>
                    ) : (
                      parte
                    ),
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
