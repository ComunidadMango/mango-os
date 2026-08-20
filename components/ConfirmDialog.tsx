"use client";

type Props = {
  titulo: string;
  mensaje?: string;
  labelConfirmar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
};

export default function ConfirmDialog({
  titulo,
  mensaje,
  labelConfirmar = "Eliminar",
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-[380px] rounded-[16px] border border-line bg-paper p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[18px] text-ink">{titulo}</h2>
        {mensaje && <p className="mt-2 text-[13.5px] text-ink-3">{mensaje}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-[10px] border border-line px-4 py-2 text-[13px] font-bold text-ink-2 transition-colors hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="rounded-[10px] bg-crit px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-85"
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
