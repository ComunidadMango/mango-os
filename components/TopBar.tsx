"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search, Bell, Sun, Cloud, CloudRain, CloudSnow, type LucideIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useUsuarioActual } from "@/lib/useUsuarioActual";

const iconoClima = (codigo: number): LucideIcon => {
  if (codigo === 0 || codigo === 1) return Sun;
  if (codigo >= 71 && codigo <= 77) return CloudSnow;
  if (codigo >= 51 && codigo <= 67) return CloudRain;
  if (codigo >= 80) return CloudRain;
  return Cloud;
};

const saludo = (hora: number) => {
  if (hora < 6) return "Buenas noches";
  if (hora < 13) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
};

export default function TopBar({ onAbrirNotificaciones, sinLeer = 0 }: { onAbrirNotificaciones: () => void; sinLeer?: number }) {
  const { data: session } = useSession();
  const usuarioActual = useUsuarioActual();
  const [ahora, setAhora] = useState<Date | null>(null);
  const [clima, setClima] = useState<{ temp: number; codigo: number } | null>(null);

  useEffect(() => {
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=-34.60&longitude=-58.38&current=temperature_2m,weather_code&timezone=America%2FArgentina%2FBuenos_Aires";
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.current) {
          setClima({ temp: Math.round(d.current.temperature_2m), codigo: d.current.weather_code });
        }
      })
      .catch(() => setClima(null));
  }, []);

  const IconoClima = clima ? iconoClima(clima.codigo) : Cloud;

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-line bg-paper px-7 py-4">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] leading-none text-ink">
          {ahora ? saludo(ahora.getHours()) : "Hola"}, {usuarioActual.nombre}
        </h1>
        <p className="mt-1.5 flex items-center gap-2 text-[13px] text-ink-3">
          <span className="first-letter:uppercase">
            {ahora
              ? ahora.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
              : " "}
          </span>
          {ahora && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                {ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </>
          )}
          {clima && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <IconoClima size={14} strokeWidth={2} />
                {clima.temp}°
              </span>
            </>
          )}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="relative hidden md:block">
          <Search
            size={15}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            placeholder="Buscar clientes, tareas, archivos…"
            className="w-[290px] rounded-[10px] border border-line bg-card py-2 pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-ink-3 hover:border-ink-3/50 focus:border-ink"
          />
        </div>

        <button
          type="button"
          onClick={onAbrirNotificaciones}
          aria-label={`Notificaciones (${sinLeer} sin leer)`}
          className="relative rounded-[10px] border border-line bg-card p-2.5 text-ink transition-colors hover:border-ink-3/50 hover:bg-line-soft"
        >
          <Bell size={16} strokeWidth={2} />
          {sinLeer > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-crit px-1 text-[10px] font-bold tabular-nums text-white">
              {sinLeer}
            </span>
          )}
        </button>

        {session?.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name ?? ""}
            width={36}
            height={36}
            className="rounded-[11px] object-cover"
          />
        ) : (
          <div className="notch-sm flex h-9 w-9 items-center justify-center rounded-[11px] bg-lime text-[13px] font-bold text-ink">
            {usuarioActual.inicial}
          </div>
        )}
      </div>
    </header>
  );
}
