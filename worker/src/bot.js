// Acceso de solo lectura para el bot de WhatsApp del Portal de Producción.
// Protegido con el secreto BOT_TOKEN (el mismo valor que COSTEO_BOT_TOKEN en
// el Portal de Producción). No usa las sesiones del portal y nunca modifica
// nada. Los cálculos son los mismos de la página (ver costeo-calc.js).
import { makeCalc } from "./costeo-calc.js";

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

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function houstonToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Viernes en o después de la fecha (igual que viernesEnOPosterior en la página). */
function fridayOnOrAfter(iso) {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay();
  return addDays(iso, (5 - dow + 7) % 7);
}

/** Mismo STATE que arma la página: datos base de Excel + lo que regresa /api/state. */
function buildCalcState(base, state, hoy) {
  return {
    gastosBase: base.gastos, proyectosCat: base.proyectos, proveedoresCat: base.proveedores, categoriasCat: base.categorias,
    gastosNuevos: state.gastos_nuevos || [],
    proyectosNuevos: state.proyectos_nuevos || [],
    proveedoresNuevos: state.proveedores_nuevos || [],
    categoriasNuevas: state.categorias_nuevas || [],
    proyectoEstado: state.proyecto_estado || {},
    proveedoresInfo: state.proveedores_info || {},
    proyectosInfo: state.proyectos_info || {},
    gastosEdits: state.gastos_edits || {},
    gastosContabilidad: state.gastos_contabilidad || {},
    gastosUsd: state.gastos_usd || [],
    categoriasUsd: state.categorias_usd || {},
    proyectosUsd: state.proyectos_usd || {},
    tiposCambio: state.tipos_cambio || {},
    proveedoresUsd: state.proveedores_usd || {},
    proyectosHouston: state.proyectos_houston || {},
    // La propuesta de pago usa el viernes de esta semana en Houston.
    propViernes: fridayOnOrAfter(hoy),
  };
}

/** GET /bot/datos → costeo por proyecto, gastos recientes y propuesta de pago. */
async function datos(env, deps) {
  const hoy = houstonToday();
  const calc = makeCalc(buildCalcState(deps.base, await deps.buildState(env), hoy));
  const proyMap = calc.allProyectos();
  const gastos = calc.allGastos();
  const gastosUsd = calc.allGastosUsd();

  // A. Gastos directos por proyecto (MXN de México y USD de Houston).
  const porProyecto = {};
  const fila = (k) =>
    (porProyecto[k] = porProyecto[k] || { key: k, nombre: calc.proyectoNombre(k), estado: calc.estadoDeProyecto(k), mxn: 0, nMx: 0, mxPorCategoria: {}, usd: 0, nUsd: 0, ultimo: null });
  for (const r of gastos) {
    if (!r.proyecto_key) continue;
    const x = fila(r.proyecto_key);
    const v = Number(r.importe) || 0;
    x.mxn += v;
    x.nMx++;
    const c = r.categoria || "SIN-CAT";
    x.mxPorCategoria[c] = (x.mxPorCategoria[c] || 0) + v;
    if (r.fecha && (!x.ultimo || r.fecha > x.ultimo.fecha)) x.ultimo = { fecha: r.fecha, proveedor: r.proveedor || "", importe: r2(v), descripcion: r.descripcion || "" };
  }
  for (const g of gastosUsd) {
    if (g.tipo !== "proyecto" || !g.proyecto_key) continue;
    const x = fila(g.proyecto_key);
    x.usd += g.importe_usd;
    x.nUsd++;
  }

  // B. Costo total (USD) como en la pestaña "Costo total".
  const costo = calc.computeCostoTotal();
  const costoPorKey = {};
  for (const x of costo.rows) {
    costoPorKey[x.key] = {
      totalUsd: r2(x.total),
      mexicoUsd: r2(x.usdMx),
      indirectoUsd: r2(x.indirectoUsd),
      houstonUsd: r2(x.houston),
      overheadUsd: r2(x.overhead),
      tcPromedio: x.tcProm ? r2(x.tcProm) : null,
      gastosSinTc: x.sinTc,
      mxnSinTc: r2(x.sinTcMxn),
      estadoHouston: x.estado,
      fechaExportacion: x.fecha_exportacion,
      ventaUsd: x.venta ? r2(x.venta) : null,
      margenUsd: x.margen == null ? null : r2(x.margen),
      margenPct: x.margenPct == null ? null : r2(x.margenPct),
    };
  }
  const proyectos = Object.values(porProyecto).map((x) => ({
    key: x.key,
    nombre: x.nombre,
    valido: proyMap[x.key] ? !!proyMap[x.key].es_valido : false,
    estado: x.estado,
    mxn: r2(x.mxn),
    gastosMx: x.nMx,
    mxPorCategoria: Object.fromEntries(Object.entries(x.mxPorCategoria).map(([k, v]) => [k, r2(v)]).sort((a, b) => b[1] - a[1])),
    usdHouston: r2(x.usd),
    gastosUsd: x.nUsd,
    ultimoGasto: x.ultimo,
    costo: costoPorKey[x.key] || null,
  }));
  // Proyectos con costo total pero sin gastos de México (solo Houston).
  for (const k of Object.keys(costoPorKey)) {
    if (porProyecto[k]) continue;
    proyectos.push({ key: k, nombre: calc.proyectoNombre(k), valido: true, estado: calc.estadoDeProyecto(k), mxn: 0, gastosMx: 0, mxPorCategoria: {}, usdHouston: 0, gastosUsd: 0, ultimoGasto: null, costo: costoPorKey[k] });
  }

  // Gastos de los últimos 14 días.
  const desde = addDays(hoy, -13);
  const recientes = gastos
    .filter((r) => r.fecha && r.fecha >= desde && r.fecha <= hoy)
    .map((r) => ({ fecha: r.fecha, proyecto: r.proyecto_key ? calc.proyectoNombre(r.proyecto_key) : "", proveedor: r.proveedor || "", categoria: r.categoria || "", importe: r2(r.importe), formaPago: r.forma_pago || null }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const recientesUsd = gastosUsd
    .filter((g) => g.fecha && g.fecha >= desde && g.fecha <= hoy)
    .map((g) => ({ fecha: g.fecha, tipo: g.tipo, proyecto: g.proyecto_key ? calc.proyectoNombre(g.proyecto_key) : g.proyecto_houston || "", proveedor: g.proveedor || "", importeUsd: r2(g.importe_usd) }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  // C. Propuesta de pago a proveedores del viernes.
  const viernes = calc.propuestaViernes();
  const prop = calc.computePropuestaPago(viernes);
  const propuesta = {
    viernes,
    facturas: prop.facturas.map((f) => ({ proveedor: f.proveedor, factura: f.factura || "", fechaFactura: f.fecha_factura, vence: f.vence, atrasada: !!f.atrasada, saldo: r2(f.saldo), proyectos: f.proyectos })),
    total: r2(prop.facturas.reduce((s, f) => s + f.saldo, 0)),
    porVerificar: { n: prop.pendientes.length, saldo: r2(prop.pendientes.reduce((s, it) => s + it.saldo, 0)) },
    sinFechaFactura: prop.sinFecha.length,
  };

  const houston = calc.computeProyectosHoustonCostos().map((p) => ({
    nombre: p.nombre || p.id,
    tipo: p.tipo,
    estado: p.fecha_cierre ? "cerrado" : "abierto",
    directoUsd: r2(p.directo),
    overheadUsd: r2(p.overhead),
    costoUsd: r2(p.costo),
    ingresoUsd: p.ingreso_usd == null ? null : r2(p.ingreso_usd),
    margenUsd: p.margen == null ? null : r2(p.margen),
  }));

  return {
    hoy,
    proyectos,
    gastosRecientes: recientes,
    gastosRecientesUsd: recientesUsd,
    propuesta,
    proyectosHouston: houston,
    indirectosPendientesMxn: r2(costo.indirectos.pendiente),
  };
}

export async function handleBot(request, env, url, deps) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!env.BOT_TOKEN || !sameToken(token, env.BOT_TOKEN)) return json({ error: "No autorizado" }, 401);
  if (request.method !== "GET") return json({ error: "Solo lectura" }, 405);
  if (url.pathname === "/bot/datos") return json(await datos(env, deps));
  return json({ error: "not found" }, 404);
}
