// Acciones del bot de WhatsApp (servidor a servidor, solo el administrador
// general en el Portal de Producción). Protegido con su propio secreto
// ACCIONES_TOKEN, distinto del de solo lectura (BOT_TOKEN) y del de
// integración.
//
// POST /acciones { accion, datos, confirmar, por }
// - confirmar: false → valida y regresa { ok, resumen, datos } sin escribir nada.
// - confirmar: true  → vuelve a validar y escribe lo mismo que la página.
// Acciones: "gasto", "material_estandar" y "terminar_proyecto".
import { makeCalc } from "./costeo-calc.js";
import { normKey, slugify } from "./integracion.js";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function sameToken(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const text = (v) => (typeof v === "string" ? v.trim() : "");
const fold = (s) => normKey(String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, ""));
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const mxn = (n) => "$" + r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MXN";
const uid = () => crypto.randomUUID().replace(/-/g, "");
const INVENTARIO_KEY = "INVENTARIO";

export function houstonToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}
function fechaValida(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
}

/** Busca por nombre sin importar mayúsculas ni acentos: exacto, empieza o contiene (pura). */
export function buscar(items, nombre, q, que) {
  const n = fold(q);
  if (!n) return { error: `Falta ${que}.` };
  const exactos = items.filter((i) => fold(nombre(i)) === n);
  if (exactos.length === 1) return { item: exactos[0] };
  for (const f of [(s) => s.startsWith(n), (s) => s.includes(n)]) {
    const m = items.filter((i) => f(fold(nombre(i))));
    if (m.length === 1) return { item: m[0] };
    if (m.length > 1) return { error: `Hay varios para "${q}" (${que}): ${m.slice(0, 6).map(nombre).join(", ")}. Di cuál.` };
  }
  return { error: `No encontré ${que} "${q}" en Compras.` };
}

/** Existencia y costo promedio por artículo, igual que inventarioResumen() de la página. */
export function resumenInventario(articulos, gastosNuevos, ajustes) {
  const por = {};
  Object.keys(articulos).forEach((id) => {
    por[id] = { entradas: 0, entradasImporte: 0, consumos: 0, ajustes: 0, ultimaEntrada: null };
  });
  gastosNuevos.forEach((g) => {
    const x = g.inv_articulo && por[g.inv_articulo];
    if (!x) return;
    const q = Number(g.inv_cantidad) || 0;
    if (g.consumo_inventario) x.consumos += q;
    else if ((g.proyecto_key || normKey(g.proyecto)) === INVENTARIO_KEY) {
      x.entradas += q;
      x.entradasImporte += Number(g.importe) || 0;
      const fe = g.fecha_factura || g.fecha || "";
      if (!x.ultimaEntrada || fe > x.ultimaEntrada) x.ultimaEntrada = fe;
    }
  });
  ajustes.forEach((j) => {
    if (por[j.articulo]) por[j.articulo].ajustes += Number(j.cantidad) || 0;
  });
  Object.keys(por).forEach((id) => {
    const x = por[id];
    x.existencia = r3(x.entradas - x.consumos + x.ajustes);
    x.costoProm = x.entradas > 0 ? x.entradasImporte / x.entradas : Number(articulos[id].costo_ref) || 0;
  });
  return por;
}

const NIVELES = ["L1", "L2", "L3", "L4", "L5"];
const nivelDe = (n) => (NIVELES.includes(n) ? n : "L4");

/**
 * Partes de un artículo para el material estándar. Un artículo dividido por uso
 * (p. ej. Interior / Exterior) da una parte por uso, cada una con su SG, su nivel
 * de carga y su uso por remolque; todas comparten la existencia del artículo.
 * Sin división, el artículo completo es una sola parte (uso ""). Pura.
 */
export function partesArticulo(id, a) {
  const usos = Array.isArray(a.usos) ? a.usos.filter((u) => u && u.clave) : [];
  if (!usos.length) return [{ id, uso: "", nombre: a.nombre, categoria: a.categoria, nivelCarga: nivelDe(a.nivelCarga), std: a.uso || {} }];
  return usos.map((u) => ({ id, uso: u.clave, nombre: `${a.nombre} (${u.nombre || u.clave})`, categoria: u.categoria, nivelCarga: nivelDe(u.nivelCarga), std: u.uso || {} }));
}

/**
 * Lo que le falta consumir a un proyecto según el uso estándar de su remolque,
 * por parte (artículo o uso del artículo). nivel: solo las partes que se cargan
 * en ese nivel. Pura.
 */
export function materialPendiente(proyecto, articulos, gastosNuevos, inv, nivel) {
  const usado = {};
  gastosNuevos.forEach((g) => {
    if (!g.consumo_inventario || !g.inv_articulo || g.proyecto_key !== proyecto.key) return;
    const k = `${g.inv_articulo}|${g.inv_uso || ""}`;
    usado[k] = (usado[k] || 0) + (Number(g.inv_cantidad) || 0);
  });
  const k = `${proyecto.tamanoTraila}|${proyecto.tipoTraila}`;
  return Object.keys(articulos)
    .filter((id) => !articulos[id].eliminado)
    .flatMap((id) => partesArticulo(id, articulos[id]))
    .filter((p) => !nivel || p.nivelCarga === nivel)
    .map((p) => {
      const std = Number(p.std[k]) || 0;
      if (!(std > 0)) return null;
      const pendiente = Math.max(0, r3(std - (usado[`${p.id}|${p.uso}`] || 0)));
      return { id: p.id, uso: p.uso, nombre: p.nombre, categoria: p.categoria, a: articulos[p.id], estandar: std, pendiente, existencia: inv[p.id].existencia, costoProm: inv[p.id].costoProm };
    })
    .filter(Boolean)
    .sort((x, y) => String(x.nombre).localeCompare(String(y.nombre)));
}

/** Gasto de consumo de una parte (de materialPendiente) al proyecto. */
export function gastoConsumo(i, cant, proyecto, fecha, por) {
  const g = {
    proyecto: proyecto.nombre, proyecto_key: proyecto.key, fecha, fecha_factura: fecha, proveedor: "INVENTARIO",
    descripcion: `Consumo de inventario: ${i.nombre} × ${r3(cant)} · material estándar`, factura: null,
    importe: r2(cant * i.costoProm), cantidad: cant, categoria: i.categoria, forma_pago: "inventario",
    capturadoPor: por, creadoEn: new Date().toISOString(), _cid: uid(),
    consumo_inventario: true, inv_articulo: i.id, inv_cantidad: cant,
  };
  if (i.uso) g.inv_uso = i.uso;
  return g;
}

export async function handleAcciones(request, env, deps) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!env.ACCIONES_TOKEN || !sameToken(token, env.ACCIONES_TOKEN)) return json({ ok: false, error: "No autorizado" }, 401);
  if (request.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }
  const datos = b && typeof b.datos === "object" && b.datos ? b.datos : {};
  const confirmar = b.confirmar === true;
  const por = `WhatsApp · ${text(b.por).slice(0, 60) || "Bot"}`;
  try {
    const state = await deps.buildState(env);
    const calc = makeCalc({
      gastosBase: deps.base.gastos, proyectosCat: deps.base.proyectos, proveedoresCat: deps.base.proveedores, categoriasCat: deps.base.categorias,
      gastosNuevos: state.gastos_nuevos || [], proyectosNuevos: state.proyectos_nuevos || [], proveedoresNuevos: state.proveedores_nuevos || [],
      categoriasNuevas: state.categorias_nuevas || [], proyectoEstado: state.proyecto_estado || {}, proveedoresInfo: state.proveedores_info || {},
      proyectosInfo: state.proyectos_info || {}, gastosEdits: {}, gastosContabilidad: {}, gastosUsd: [], categoriasUsd: {}, proyectosUsd: {},
      tiposCambio: {}, proveedoresUsd: {}, proyectosHouston: {},
    });
    const proyMap = calc.allProyectos();
    const proyectos = Object.values(proyMap).filter((p) => p.es_valido && p.key !== INVENTARIO_KEY);
    const activos = proyectos.filter((p) => calc.estadoDeProyecto(p.key) !== "terminado");
    const ctx = { env, deps, state, calc, proyectos, activos, datos, confirmar, por };
    const out =
      b.accion === "gasto" ? await gasto(ctx)
      : b.accion === "material_estandar" ? await materialEstandar(ctx)
      : b.accion === "terminar_proyecto" ? await terminarProyecto(ctx)
      : { ok: false, error: "Acción desconocida" };
    return json(out, out.ok ? 200 : 400);
  } catch (e) {
    return json({ ok: false, error: "Error en Compras: " + String(e && e.message ? e.message : e) }, 500);
  }
}

async function gasto({ env, deps, state, proyectos, datos, confirmar, por }) {
  const p = buscar(proyectos, (x) => x.nombre, datos.proyecto, "el proyecto");
  if (p.error) return { ok: false, error: p.error };
  const nombresProv = proveedoresDe(deps, state);
  const pr = buscar(nombresProv, (x) => x, datos.proveedor, "el proveedor");
  if (pr.error) return { ok: false, error: pr.error + " Si es nuevo, dalo de alta en Catálogos → Proveedores." };
  const cats = deps.base.categorias.concat((state.categorias_nuevas || []).map((c) => ({ codigo: c.codigo, nombre: c.nombre }))).filter((c) => c.codigo !== "SIN-CAT");
  const cq = text(datos.categoria);
  const sg = /^SG[0-9A-Z]\b/i.test(cq) ? cats.filter((c) => normKey(c.codigo).startsWith(normKey(cq.slice(0, 3)))) : [];
  const cat = sg.length === 1 ? { item: sg[0] } : buscar(cats, (c) => `${c.codigo} ${c.nombre}`, cq, "la categoría (SG)");
  if (cat.error) return { ok: false, error: cat.error };
  const importe = r2(Number(datos.importe));
  if (!(importe > 0)) return { ok: false, error: "El importe debe ser mayor que cero (en pesos)." };
  const forma = text(datos.forma_pago).toLowerCase() === "credito" || text(datos.forma_pago).toLowerCase() === "crédito" ? "credito" : "efectivo";
  const hoy = houstonToday();
  const fecha = text(datos.fecha) || hoy;
  if (!fechaValida(fecha) || fecha > hoy) return { ok: false, error: "Fecha inválida (AAAA-MM-DD, no futura)." };
  const descripcion = text(datos.descripcion).slice(0, 200);
  const factura = text(datos.factura).slice(0, 40) || null;
  const proyecto = p.item, categoria = cat.item;
  const resumen = `Registrar gasto de *${mxn(importe)}* a *${proyecto.nombre}* · ${pr.item} · ${categoria.codigo} · ${forma === "credito" ? "crédito" : "efectivo"} · ${fecha}${descripcion ? ` · "${descripcion}"` : ""}${factura ? ` · factura ${factura}` : ""}.`;
  const normal = { proyecto: proyecto.nombre, proveedor: pr.item, categoria: categoria.codigo, importe, forma_pago: forma, fecha, descripcion, factura };
  if (!confirmar) return { ok: true, resumen, datos: normal };
  const doc = {
    proyecto: proyecto.nombre, proyecto_key: proyecto.key, fecha, fecha_factura: fecha, proveedor: pr.item,
    descripcion, factura, importe, cantidad: 1, categoria: categoria.codigo, forma_pago: forma,
    capturadoPor: por, creadoEn: new Date().toISOString(), _cid: uid(),
  };
  const id = uid();
  await deps.putDoc(env, "gastos_nuevos", id, doc);
  await deps.logActivity(env, { isMaster: false, nombre: por }, "POST", "gastos_nuevos", id, doc);
  return { ok: true, hecho: true, resumen: `Gasto de ${mxn(importe)} registrado a ${proyecto.nombre}.` };
}

function proveedoresDe(deps, state) {
  const info = state.proveedores_info || {};
  const names = {};
  deps.base.proveedores.forEach((n) => (names[normKey(n)] = n));
  (state.proveedores_nuevos || []).forEach((p) => {
    if (!names[normKey(p.nombre)]) names[normKey(p.nombre)] = p.nombre;
  });
  return Object.values(names)
    .map((n) => {
      const i = info[slugify(n)] || {};
      return i.eliminado ? null : i.nombre || n;
    })
    .filter(Boolean);
}

async function materialEstandar({ env, deps, state, activos, datos, confirmar, por }) {
  const p = buscar(activos, (x) => x.nombre, datos.proyecto, "el proyecto activo");
  if (p.error) return { ok: false, error: p.error };
  const proyecto = p.item;
  if (!proyecto.tipoTraila || !proyecto.tamanoTraila) return { ok: false, error: `${proyecto.nombre} no tiene tamaño o tipo de remolque; captúralo en Compras → Proyectos.` };
  const articulos = state.inventario_articulos || {};
  const gastosNuevos = state.gastos_nuevos || [];
  const inv = resumenInventario(articulos, gastosNuevos, state.inventario_ajustes || []);
  const items = materialPendiente(proyecto, articulos, gastosNuevos, inv).filter((i) => i.pendiente > 0);
  if (!items.length) return { ok: false, error: `${proyecto.nombre} (${proyecto.tamanoTraila} ${proyecto.tipoTraila}) ya tiene cargado todo su material estándar, o no hay uso estándar para esa medida.` };
  // Los usos de un mismo artículo comparten existencia: se compara lo que piden entre todos.
  const pide = {};
  items.forEach((i) => { pide[i.id] = r3((pide[i.id] || 0) + i.pendiente); });
  const problemas = items
    .map((i) => (!i.categoria ? `${i.nombre}: sin SG` : !(i.costoProm > 0) ? `${i.nombre}: sin costo` : pide[i.id] > i.existencia + 1e-9 ? `${i.nombre}: necesita ${pide[i.id] === i.pendiente ? i.pendiente : `${pide[i.id]} entre sus usos`}, hay ${i.existencia}` : null))
    .filter(Boolean);
  if (problemas.length) return { ok: false, error: `No se puede cargar el material de ${proyecto.nombre}: ${problemas.join("; ")}. Registra la compra o corrígelo en Inventario.` };
  const total = items.reduce((s, i) => s + i.pendiente * i.costoProm, 0);
  const resumen = `Cargar material estándar a *${proyecto.nombre}* (${proyecto.tamanoTraila} ${proyecto.tipoTraila}): ${items.map((i) => `${i.nombre} × ${i.pendiente}`).join(", ")} — *${mxn(total)}* a costo promedio.`;
  if (!confirmar) return { ok: true, resumen, datos: { proyecto: proyecto.nombre } };
  const fecha = houstonToday();
  for (const i of items) {
    const g = gastoConsumo(i, i.pendiente, proyecto, fecha, por);
    const id = uid();
    await deps.putDoc(env, "gastos_nuevos", id, g);
    await deps.logActivity(env, { isMaster: false, nombre: por }, "POST", "gastos_nuevos", id, g);
  }
  return { ok: true, hecho: true, resumen: `${items.length} consumos cargados a ${proyecto.nombre} (${mxn(total)}).` };
}

async function terminarProyecto({ env, deps, state, activos, datos, confirmar, por }) {
  const p = buscar(activos, (x) => x.nombre, datos.proyecto, "el proyecto activo");
  if (p.error) return { ok: false, error: p.error };
  const hoy = houstonToday();
  const fecha = text(datos.fecha) || hoy;
  if (!fechaValida(fecha) || fecha > hoy) return { ok: false, error: "Fecha inválida (AAAA-MM-DD, no futura)." };
  const resumen = `Marcar *${p.item.nombre}* como terminado en Compras con fecha ${fecha}.`;
  if (!confirmar) return { ok: true, resumen, datos: { proyecto: p.item.nombre, fecha } };
  const slug = slugify(p.item.key);
  const prev = (state.proyecto_estado || {})[slug] || {};
  const data = Object.assign({}, prev, { estado: "terminado", key: p.item.key, fecha_terminado: fecha, updatedAt: new Date().toISOString() });
  await deps.putDoc(env, "proyecto_estado", slug, data);
  await deps.logActivity(env, { isMaster: false, nombre: por }, "PUT", "proyecto_estado", slug, data);
  return { ok: true, hecho: true, resumen: `${p.item.nombre} quedó terminado (${fecha}).` };
}
