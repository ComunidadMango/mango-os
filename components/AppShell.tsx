"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Manguito from "./Manguito";
import PanelNotificaciones from "./PanelNotificaciones";
import DrawerNuevaPagina from "./DrawerNuevaPagina";
import BannerBienvenida from "./BannerBienvenida";
import { type PaginaCustom, type TipoPagina, type VisibilidadPagina } from "@/lib/paginas";
import { usePersonas } from "@/lib/usePersonas";
import { useUsuarioActual } from "@/lib/useUsuarioActual";
import { createBrowserClient, type PaginaRow } from "@/lib/supabase";

function rowAPagina(r: PaginaRow): PaginaCustom {
  return {
    id:          r.id,
    nombre:      r.nombre,
    tipo:        r.tipo as TipoPagina,
    icono:       r.icono,
    visibilidad: r.visibilidad as VisibilidadPagina,
    creadoEn:    r.creado_en,
  };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  usePersonas();

  const usuarioActual    = useUsuarioActual();
  const [notisAbiertas,  setNotisAbiertas]  = useState(false);
  const [drawerAbierto,  setDrawerAbierto]  = useState(false);
  const [paginasCustom,  setPaginasCustom]  = useState<PaginaCustom[]>([]);
  const [sinLeer,        setSinLeer]        = useState(0);

  const cargarSinLeer = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones");
      if (!res.ok) return;
      const data = await res.json() as Array<{ leida: boolean }>;
      setSinLeer(data.filter(n => !n.leida).length);
    } catch {}
  }, []);

  // Carga inicial del count de notificaciones
  useEffect(() => { cargarSinLeer(); }, [cargarSinLeer]);

  // Realtime: incrementar campanita cuando llega una notificación nueva
  useEffect(() => {
    if (!usuarioActual?.id) return;
    const supabase = createBrowserClient();
    const canal = supabase.channel(`notificaciones-${usuarioActual.id}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "notificaciones",
        filter: `persona_id=eq.${usuarioActual.id}`,
      }, () => { setSinLeer(prev => prev + 1); })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [usuarioActual?.id]);

  // Cargar páginas: primero localStorage (instantáneo) luego Supabase (fuente de verdad)
  useEffect(() => {
    const local = localStorage.getItem("mango-paginas");
    const localPages: PaginaCustom[] = local ? (JSON.parse(local) as PaginaCustom[]) : [];
    if (localPages.length) setPaginasCustom(localPages);

    fetch("/api/db/paginas")
      .then(r => r.ok ? r.json() : [])
      .then((rows: PaginaRow[]) => {
        const supabasePages = rows.map(rowAPagina);
        const supabaseIds   = new Set(supabasePages.map(p => p.id));
        const soloLocales   = localPages.filter(p => !supabaseIds.has(p.id));
        const merged        = [...supabasePages, ...soloLocales];
        setPaginasCustom(merged);
        localStorage.setItem("mango-paginas", JSON.stringify(merged));
      })
      .catch(() => {});
  }, []);

  // Realtime: ver páginas nuevas/eliminadas en tiempo real
  useEffect(() => {
    const supabase = createBrowserClient();
    const canal = supabase.channel("paginas-equipo")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "paginas" },
        (payload) => {
          const nueva = rowAPagina(payload.new as PaginaRow);
          setPaginasCustom(prev => {
            if (prev.some(p => p.id === nueva.id)) return prev;
            const updated = [nueva, ...prev];
            localStorage.setItem("mango-paginas", JSON.stringify(updated));
            return updated;
          });
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "paginas" },
        (payload) => {
          const id = (payload.old as { id: string })?.id;
          if (!id) return;
          setPaginasCustom(prev => {
            const updated = prev.filter(p => p.id !== id);
            localStorage.setItem("mango-paginas", JSON.stringify(updated));
            return updated;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  function agregarPagina(pagina: PaginaCustom) {
    setPaginasCustom(prev => {
      if (prev.some(p => p.id === pagina.id)) return prev;
      const updated = [...prev, pagina];
      localStorage.setItem("mango-paginas", JSON.stringify(updated));
      return updated;
    });
  }

  function eliminarPagina(id: string) {
    setPaginasCustom(prev => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem("mango-paginas", JSON.stringify(updated));
      return updated;
    });
    fetch(`/api/db/paginas/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function renombrarPagina(id: string, nuevoNombre: string) {
    setPaginasCustom(prev => {
      const updated = prev.map((p) => p.id === id ? { ...p, nombre: nuevoNombre } : p);
      localStorage.setItem("mango-paginas", JSON.stringify(updated));
      return updated;
    });
    fetch(`/api/db/paginas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoNombre }),
    }).catch(() => {});
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
        <main className="flex-1 overflow-y-auto px-7 pb-24 pt-6">
          <BannerBienvenida />
          {children}
        </main>
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
