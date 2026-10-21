// Producción avisa cuando una orden entra a un nivel (L1–L5): se carga a su
// proyecto el material estándar que le falta (Inventario → Uso por remolque) de
// los artículos que se cargan en ese nivel (nivelCarga, L4 si no se eligió; un
// artículo dividido por uso, p. ej. Interior / Exterior, tiene nivel y SG por uso),
// solo lo que hay en existencia. Lo que falta se reporta para comprarlo y se carga después
// (vuelve a correr sin duplicar: solo toma lo pendiente). Servidor a servidor
// con el secreto INTEGRACION_TOKEN.
//
// POST /integracion/material-l4 { folio, nombres: [nombre interno, cliente], orden, nivel }
// → { ok, nivel, proyecto, medida, cargados: [{articulo, cantidad, unidad, importe}],
//     faltantes: [{articulo, falta, motivo}], total, sinArticulos }
import { makeCalc } from "./costeo-calc.js";
import { normKey, slugify } from "./integracion.js";
import { gastoConsumo, houstonToday, materialPendiente, partesArticulo, resumenInventario } from "./acciones.js";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const uid = () => crypto.randomUUID().replace(/-/g, "");

/** El proyecto de la orden: por folio del Sales Order, luego por nombre exacto, luego por primera palabra (única). Pura. */
export function proyectoDeOrden(activos, infos, folio, nombres) {
  if (folio) {
    const f = String(folio).toUpperCase();
    const p = activos.find((x) => (infos[slugify(x.key)] || {}).salesFolio === f);
    if (p) return p;
  }
  const ns = (nombres || []).map(normKey).filter(Boolean);
  for (const n of ns) {
    const p = activos.find((x) => normKey(x.key) === n || normKey(x.nombre) === n);
    if (p) return p;
  }
  for (const n of ns) {
    const w = n.split(/[\s-]+/)[0];
    const m = activos.filter((x) => normKey(x.key) === w || normKey(x.nombre) === w);
    if (m.length === 1) return m[0];
  }
  return null;
}

export async function handleMaterialL4(request, env, deps) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }
  const state = await deps.buildState(env);
  const nivel = ["L1", "L2", "L3", "L4", "L5"].includes(b.nivel) ? b.nivel : "L4";
  const todos = Object.fromEntries(Object.entries(state.inventario_articulos || {}).filter(([, a]) => a && !a.eliminado));
  // Ningún artículo (ni uso de artículo) se carga en este nivel: no hay nada que hacer ni que avisar.
  if (!Object.entries(todos).some(([id, a]) => partesArticulo(id, a).some((p) => p.nivelCarga === nivel)))
    return json({ ok: true, nivel, sinArticulos: true, cargados: [], faltantes: [], total: 0 });
  const calc = makeCalc({
    gastosBase: deps.base.gastos, proyectosCat: deps.base.proyectos, proveedoresCat: deps.base.proveedores, categoriasCat: deps.base.categorias,
    gastosNuevos: state.gastos_nuevos || [], proyectosNuevos: state.proyectos_nuevos || [], proveedoresNuevos: state.proveedores_nuevos || [],
    categoriasNuevas: state.categorias_nuevas || [], proyectoEstado: state.proyecto_estado || {}, proveedoresInfo: state.proveedores_info || {},
    proyectosInfo: state.proyectos_info || {}, gastosEdits: {}, gastosContabilidad: {}, gastosUsd: [], categoriasUsd: {}, proyectosUsd: {},
    tiposCambio: {}, proveedoresUsd: {}, proyectosHouston: {},
  });
  const activos = Object.values(calc.allProyectos()).filter((p) => p.es_valido && p.key !== "INVENTARIO" && calc.estadoDeProyecto(p.key) !== "terminado");
  const proyecto = proyectoDeOrden(activos, state.proyectos_info || {}, b.folio, b.nombres);
  if (!proyecto) return json({ ok: false, error: `No encontré en Compras el proyecto de la orden ${b.orden || ""}.` });
  if (!proyecto.tipoTraila || !proyecto.tamanoTraila) return json({ ok: false, proyecto: proyecto.nombre, error: `${proyecto.nombre} no tiene tamaño o tipo de remolque en Compras.` });

  const gastosNuevos = state.gastos_nuevos || [];
  const inv = resumenInventario(state.inventario_articulos || {}, gastosNuevos, state.inventario_ajustes || []);
  const partes = materialPendiente(proyecto, todos, gastosNuevos, inv, nivel);
  const por = `Producción · ${nivel}`;
  const fecha = houstonToday();
  const cargados = [], faltantes = [];
  // Los usos de un artículo comparten existencia: lo que toma uno ya no está para el otro.
  const queda = {};
  for (const i of partes.filter((x) => x.pendiente > 0)) {
    if (!i.categoria) { faltantes.push({ articulo: i.nombre, falta: i.pendiente, motivo: "sin SG" }); continue; }
    if (!(i.costoProm > 0)) { faltantes.push({ articulo: i.nombre, falta: i.pendiente, motivo: "sin costo" }); continue; }
    if (!(i.id in queda)) queda[i.id] = Math.max(0, i.existencia);
    const cant = r3(Math.min(i.pendiente, queda[i.id]));
    if (cant > 0) {
      queda[i.id] = r3(queda[i.id] - cant);
      const g = gastoConsumo(i, cant, proyecto, fecha, por);
      g.descripcion = `Consumo de inventario: ${i.nombre} × ${cant} · material estándar (orden pasó a ${nivel})`;
      const id = uid();
      await deps.putDoc(env, "gastos_nuevos", id, g);
      await deps.logActivity(env, { isMaster: false, nombre: por }, "POST", "gastos_nuevos", id, g);
      cargados.push({ articulo: i.nombre, cantidad: cant, unidad: i.a.unidad || "pieza", importe: g.importe });
    }
    if (i.pendiente - cant > 1e-9) faltantes.push({ articulo: i.nombre, falta: r3(i.pendiente - cant), motivo: "sin existencia" });
  }
  return json({
    ok: true,
    nivel,
    sinArticulos: !partes.length,
    proyecto: proyecto.nombre,
    medida: `${proyecto.tamanoTraila} ${proyecto.tipoTraila}`,
    cargados,
    faltantes,
    total: r2(cargados.reduce((s, c) => s + c.importe, 0)),
  });
}
