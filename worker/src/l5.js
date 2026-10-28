// Producción avisa cuando una orden entra a L5: se guarda la fecha en
// proyecto_l5 (id = slug del proyecto). Los indirectos de México de cada mes se
// reparten entre las trailas que entraron a L5 ese mes (costeo-calc.js →
// computeIndirectosMx). Cuenta la primera vez que entra. Servidor a servidor
// con INTEGRACION_TOKEN.
//
// POST /integracion/l5 { folio, nombres: [nombre interno, cliente], orden, fecha: "AAAA-MM-DD" }
// → { ok, proyecto, fecha, yaEstaba }
import { makeCalc } from "./costeo-calc.js";
import { slugify } from "./integracion.js";
import { proyectoDeOrden } from "./material-l4.js";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function handleL5(request, env, deps) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha || "")) return json({ ok: false, error: "Fecha inválida" }, 400);
  const state = await deps.buildState(env);
  const calc = makeCalc({
    gastosBase: deps.base.gastos, proyectosCat: deps.base.proyectos, proveedoresCat: deps.base.proveedores, categoriasCat: deps.base.categorias,
    gastosNuevos: [], proyectosNuevos: state.proyectos_nuevos || [], proveedoresNuevos: [], categoriasNuevas: [],
    proyectoEstado: state.proyecto_estado || {}, proveedoresInfo: {}, proyectosInfo: state.proyectos_info || {},
    gastosEdits: {}, gastosContabilidad: {}, gastosUsd: [], categoriasUsd: {}, proyectosUsd: {}, tiposCambio: {}, proveedoresUsd: {}, proyectosHouston: {},
  });
  // También los ya terminados: el proyecto pudo marcarse como terminado antes de que la orden llegara a L5.
  const validos = Object.values(calc.allProyectos()).filter((p) => p.es_valido && p.key !== "INVENTARIO");
  const proyecto = proyectoDeOrden(validos, state.proyectos_info || {}, b.folio, b.nombres);
  if (!proyecto) return json({ ok: false, error: `No encontré en Compras el proyecto de la orden ${b.orden || ""}.` });
  const id = slugify(proyecto.key);
  const prev = (state.proyecto_l5 || {})[id];
  if (prev && prev.fecha) return json({ ok: true, proyecto: proyecto.nombre, fecha: prev.fecha, yaEstaba: true });
  const doc = { key: proyecto.key, fecha: b.fecha, orden: String(b.orden || "").slice(0, 120), folio: b.folio || null, registradoEn: new Date().toISOString() };
  await deps.putDoc(env, "proyecto_l5", id, doc);
  await deps.logActivity(env, { isMaster: false, nombre: "Producción · L5" }, "PUT", "proyecto_l5", id, doc);
  return json({ ok: true, proyecto: proyecto.nombre, fecha: b.fecha, yaEstaba: false });
}
