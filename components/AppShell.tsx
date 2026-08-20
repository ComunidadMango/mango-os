"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Manguito from "./Manguito";
import PanelNotificaciones from "./PanelNotificaciones";
import DrawerNuevaPagina from "./DrawerNuevaPagina";
import { type PaginaCustom } from "@/lib/paginas";
import { usePersonas } from "@/lib/usePersonas";

export default function AppShell({ children }: { children: React.ReactNode }) {
  usePersonas();

  const [notisAbiertas, setNotisAbiertas] = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [paginasCustom, setPaginasCustom] = useState<PaginaCustom[]>([]);
  const [sinLeer, setSinLeer] = useState(0);

  const cargarSinLeer = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones");
      if (!res.ok) return;
      const data = await res.json() as Array<{ leida: boolean }>;
      setSinLeer(data.filter(n => !n.leida).length);
    } catch {}
  }, []);

  useEffect(() => {
    cargarSinLeer();
  }, [cargarSinLeer]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mango-paginas");
      if (stored) setPaginasCustom(JSON.parse(stored) as PaginaCustom[]);
    } catch {}
  }, []);

  function agregarPagina(pagina: PaginaCustom) {
    const nuevas = [...paginasCustom, pagina];
    setPaginasCustom(nuevas);
    localStorage.setItem("mango-paginas", JSON.stringify(nuevas));
  }

  function eliminarPagina(id: string) {
    const nuevas = paginasCustom.filter((p) => p.id !== id);
    setPaginasCustom(nuevas);
    localStorage.setItem("mango-paginas", JSON.stringify(nuevas));
  }

  function renombrarPagina(id: string, nuevoNombre: string) {
    const nuevas = paginasCustom.map((p) =>
      p.id === id ? { ...p, nombre: nuevoNombre } : p,
    );
    setPaginasCustom(nuevas);
    localStorage.setItem("mango-paginas", JSON.stringify(nuevas));
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        paginasCustom={paginasCustom}
        onNuevaPagina={() => setDrawerAbierto(true)}
        onEliminarPagina={eliminarPagina}
        onRenombrarPagina={renombrarPagina}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onAbrirNotificaciones={() => setNotisAbiertas(true)} sinLeer={sinLeer} />
        <main className="flex-1 overflow-y-auto px-7 pb-24 pt-6">{children}</main>
      </div>
      {/* <Manguito /> */}
      <PanelNotificaciones
        abierto={notisAbiertas}
        onCerrar={() => setNotisAbiertas(false)}
        onMarcarLeidas={() => setSinLeer(0)}
      />
      <DrawerNuevaPagina
        abierto={drawerAbierto}
        onCerrar={() => setDrawerAbierto(false)}
        onCrear={agregarPagina}
      />
    </div>
  );
}
