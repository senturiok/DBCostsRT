// Producción pregunta qué artículos del inventario están en su punto de
// reorden (existencia ≤ punto de reorden, o agotados) para avisar por WhatsApp
// y recordar cada 3 días hasta que entre material. Solo lectura, servidor a
// servidor con el secreto INTEGRACION_TOKEN.
//
// GET /integracion/reorden
// → { ok, articulos: [{ id, nombre, unidad, existencia, punto, entradas, ultimaEntrada, proveedor, liga }] }
import { resumenInventario } from "./acciones.js";

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

/** Artículos activos en o debajo de su punto de reorden (pura). */
export function articulosEnReorden(articulos, gastosNuevos, ajustes) {
  const inv = resumenInventario(articulos, gastosNuevos, ajustes);
  return Object.keys(articulos)
    .filter((id) => articulos[id] && !articulos[id].eliminado)
    .map((id) => {
      const a = articulos[id], x = inv[id], punto = Number(a.punto_reorden) || 0;
      return {
        id, nombre: a.nombre || id, unidad: a.unidad || "pieza", existencia: x.existencia, punto,
        entradas: r3(x.entradas), ultimaEntrada: x.ultimaEntrada || null, proveedor: a.proveedor || "", liga: a.liga || "",
      };
    })
    .filter((x) => x.existencia <= 0 || x.existencia <= x.punto)
    .sort((a, b) => a.existencia - a.punto - (b.existencia - b.punto) || a.nombre.localeCompare(b.nombre));
}

export async function handleReorden(env, deps) {
  const state = await deps.buildState(env);
  const articulos = articulosEnReorden(state.inventario_articulos || {}, state.gastos_nuevos || [], state.inventario_ajustes || []);
  return new Response(JSON.stringify({ ok: true, articulos }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
