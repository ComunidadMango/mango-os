import { Hammer } from "lucide-react";

export default function EnConstruccion({
  titulo,
  cuando,
  detalle,
}: {
  titulo: string;
  cuando: string;
  detalle: string;
}) {
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-line bg-card p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-lime-soft text-ink">
          <Hammer size={18} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[28px] leading-none">{titulo}</h1>
        <p className="max-w-[52ch] text-[14.5px] leading-relaxed text-ink-2">{detalle}</p>
        <span className="rounded-chip bg-lime px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">
          {cuando}
        </span>
      </div>
    </div>
  );
}
