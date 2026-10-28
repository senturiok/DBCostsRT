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

/**
 * Carga al proyecto lo pendiente de las partes del nivel (solo del artículo
 * soloArticulo si se da) con lo que hay en existencia. Agrega los gastos a
 * gastosNuevos para que la siguiente llamada ya los cuente.
 */
async function cargarPartes(env, deps, state, todos, gastosNuevos, proyecto, nivel, soloArticulo, por, motivo) {
  const inv = resumenInventario(state.inventario_articulos || {}, gastosNuevos, state.inventario_ajustes || []);
  const partes = materialPendiente(proyecto, todos, gastosNuevos, inv, nivel);
  const fecha = houstonToday();
  const cargados = [], faltantes = [];
  // Los usos de un artículo comparten existencia: lo que toma uno ya no está para el otro.
  const queda = {};
  for (const i of partes.filter((x) => x.pendiente > 0 && (!soloArticulo || x.id === soloArticulo))) {
    if (!i.categoria) { faltantes.push({ id: i.id, articulo: i.nombre, falta: i.pendiente, motivo: "sin SG" }); continue; }
    if (!(i.costoProm > 0)) { faltantes.push({ id: i.id, articulo: i.nombre, falta: i.pendiente, motivo: "sin costo" }); continue; }
    if (!(i.id in queda)) queda[i.id] = Math.max(0, i.existencia);
    const cant = r3(Math.min(i.pendiente, queda[i.id]));
    if (cant > 0) {
      queda[i.id] = r3(queda[i.id] - cant);
      const g = gastoConsumo(i, cant, proyecto, fecha, por);
      g.descripcion = `Consumo de inventario: ${i.nombre} × ${cant} · material estándar (${motivo})`;
      const id = uid();
      await deps.putDoc(env, "gastos_nuevos", id, g);
      await deps.logActivity(env, { isMaster: false, nombre: por }, "POST", "gastos_nuevos", id, g);
      gastosNuevos.push(Object.assign({ id }, g));
      cargados.push({ articulo: i.nombre, cantidad: cant, unidad: i.a.unidad || "pieza", importe: g.importe });
    }
    if (i.pendiente - cant > 1e-9) faltantes.push({ id: i.id, articulo: i.nombre, falta: r3(i.pendiente - cant), motivo: "sin existencia" });
  }
  return { partes, cargados, faltantes };
}

/**
 * Lo que faltó por existencia queda en inventario_faltantes (id = proyecto|nivel)
 * para cargarlo solo cuando entre el artículo (surtirFaltantes). Sin faltantes, se borra.
 */
async function guardarFaltante(env, deps, proyecto, nivel, orden, faltantes, partes) {
  const id = `${slugify(proyecto.key)}|${nivel}`;
  const sinExistencia = faltantes.filter((f) => f.motivo === "sin existencia");
  const prev = await deps.getDoc(env, "inventario_faltantes", id);
  if (!sinExistencia.length) {
    if (prev) await deps.deleteDoc(env, "inventario_faltantes", id);
    return;
  }
  const unidad = (fid) => ((partes.find((p) => p.id === fid) || {}).a || {}).unidad || "pieza";
  await deps.putDoc(env, "inventario_faltantes", id, {
    proyecto_key: proyecto.key, proyecto: proyecto.nombre, nivel, orden: orden || (prev && prev.orden) || "",
    creadoEn: (prev && prev.creadoEn) || new Date().toISOString(), actualizadoEn: new Date().toISOString(),
    articulos: sinExistencia.map((f) => ({ id: f.id, nombre: f.articulo, falta: f.falta, unidad: unidad(f.id) })),
  });
}

/**
 * Entró material al inventario (compra o ajuste): se carga lo que les faltó a
 * los proyectos que lo esperaban, del faltante más antiguo al más nuevo.
 * articuloId: solo ese artículo (null = todos). → { cargados: [{proyecto, articulo, cantidad, importe}] }
 */
export async function surtirFaltantes(env, deps, articuloId) {
  const docs = (await deps.listDocs(env, "inventario_faltantes"))
    .filter((r) => r.data && (!articuloId || (r.data.articulos || []).some((x) => x.id === articuloId)))
    .sort((x, y) => String(x.data.creadoEn || "").localeCompare(String(y.data.creadoEn || "")));
  if (!docs.length) return { cargados: [] };
  const state = await deps.buildState(env);
  const todos = Object.fromEntries(Object.entries(state.inventario_articulos || {}).filter(([, a]) => a && !a.eliminado));
  const calc = makeCalc({
    gastosBase: deps.base.gastos, proyectosCat: deps.base.proyectos, proveedoresCat: deps.base.proveedores, categoriasCat: deps.base.categorias,
    gastosNuevos: state.gastos_nuevos || [], proyectosNuevos: state.proyectos_nuevos || [], proveedoresNuevos: state.proveedores_nuevos || [],
    categoriasNuevas: state.categorias_nuevas || [], proyectoEstado: state.proyecto_estado || {}, proveedoresInfo: state.proveedores_info || {},
    proyectosInfo: state.proyectos_info || {}, gastosEdits: {}, gastosContabilidad: {}, gastosUsd: [], categoriasUsd: {}, proyectosUsd: {},
    tiposCambio: {}, proveedoresUsd: {}, proyectosHouston: {},
  });
  const proyectos = calc.allProyectos();
  const gastosNuevos = state.gastos_nuevos || [];
  const out = [];
  for (const { id, data: f } of docs) {
    const proyecto = proyectos[f.proyecto_key];
    // Proyecto borrado o ya terminado: el faltante ya no aplica.
    if (!proyecto || !proyecto.tipoTraila || !proyecto.tamanoTraila || calc.estadoDeProyecto(f.proyecto_key) === "terminado") {
      await deps.deleteDoc(env, "inventario_faltantes", id);
      continue;
    }
    const ids = articuloId ? [articuloId] : [...new Set((f.articulos || []).map((x) => x.id))];
    const por = "Inventario · faltante surtido";
    for (const art of ids) {
      const r = await cargarPartes(env, deps, state, todos, gastosNuevos, proyecto, f.nivel, art, por, `faltante de ${f.nivel} surtido al entrar material`);
      r.cargados.forEach((c) => out.push(Object.assign({ proyecto: proyecto.nombre, nivel: f.nivel }, c)));
    }
    // Lo que sigue faltando de los artículos que esperaba.
    const inv = resumenInventario(state.inventario_articulos || {}, gastosNuevos, state.inventario_ajustes || []);
    const esperaba = new Set((f.articulos || []).map((x) => x.id));
    const siguen = materialPendiente(proyecto, todos, gastosNuevos, inv, f.nivel).filter((p) => esperaba.has(p.id) && p.pendiente > 1e-9);
    if (!siguen.length) await deps.deleteDoc(env, "inventario_faltantes", id);
    else await deps.putDoc(env, "inventario_faltantes", id, Object.assign({}, f, {
      actualizadoEn: new Date().toISOString(),
      articulos: siguen.map((p) => ({ id: p.id, nombre: p.nombre, falta: p.pendiente, unidad: p.a.unidad || "pieza" })),
    }));
  }
  return { cargados: out };
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
  const { partes, cargados, faltantes } = await cargarPartes(env, deps, state, todos, gastosNuevos, proyecto, nivel, null, `Producción · ${nivel}`, `orden pasó a ${nivel}`);
  await guardarFaltante(env, deps, proyecto, nivel, b.orden || "", faltantes, partes);
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
