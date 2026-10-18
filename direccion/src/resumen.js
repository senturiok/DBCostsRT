// Arma el resumen del Tablero de Dirección a partir de lo que entrega cada
// portal. Funciones puras (sin fetch) para poder probarlas con datos de ejemplo.
// Cada portal puede faltar (null): el tablero muestra lo que sí llegó.

const r0 = (n) => Math.round(Number(n) || 0);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Clave para ligar proyectos entre portales (solo hay coincidencia por nombre). */
export function normKey(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

// ---------- Cobranza ----------
function resumenCobranza(d, hoy) {
  if (!d) return null;
  const activos = d.clientes.filter((c) => c.activo && c.estado !== "liquidado");
  const atrasados = activos.filter((c) => c.estado === "atrasado");
  const desde = addDays(hoy, -7 * 8 + 1);
  const semanas = [];
  for (let i = 7; i >= 0; i--) semanas.push({ desde: addDays(hoy, -7 * i - 6), monto: 0 });
  for (const p of d.pagosRecientes || []) {
    if (p.fecha < desde || p.fecha > hoy) continue;
    const s = semanas.find((w, i) => p.fecha >= w.desde && (i === semanas.length - 1 || p.fecha < semanas[i + 1].desde));
    if (s) s.monto += p.monto;
  }
  return {
    mes: { ...d.mes, pct: d.mes.programado > 0 ? r0((d.mes.cobrado / d.mes.programado) * 100) : null },
    activos: activos.length,
    alDia: activos.filter((c) => c.estado === "al_dia").length,
    atrasados: atrasados.length,
    porConfirmar: activos.filter((c) => c.estado === "confirmar").length,
    vencido: r2(atrasados.reduce((a, c) => a + (c.vencido || 0), 0)),
    cartera: r2(activos.reduce((a, c) => a + (c.resta || 0), 0)),
    cobradoPorSemana: semanas.map((w) => ({ desde: w.desde, monto: r2(w.monto) })),
    contactar: atrasados
      .slice()
      .sort((a, b) => b.vencido - a.vencido)
      .slice(0, 10)
      .map((c) => ({
        cliente: c.cliente,
        negocio: c.negocio,
        traila: c.traila,
        vencido: c.vencido,
        diasAtraso: c.diasAtraso,
        cuota: c.cuota,
        frecuencia: c.frecuencia,
        ultimoContacto: c.ultimoContacto ? c.ultimoContacto.fecha : null,
        resultado: c.ultimoContacto ? c.ultimoContacto.resultado : null,
      })),
  };
}

// ---------- Producción ----------
function resumenProduccion(d, hoy) {
  if (!d) return null;
  const ordenes = d.orders.map((o) => {
    let estado = o.completed ? "terminada" : o.paused ? "pausada" : o.estimateStatus || "sin_plan";
    if (!o.completed && o.dueDate && o.dueDate < hoy) estado = "atrasada";
    return {
      nombre: o.name,
      modelo: o.model,
      nivel: o.level ? o.level.code : null,
      nivelNombre: o.level ? o.level.name : null,
      avance: o.progressPct,
      entrega: o.dueDate,
      estimada: o.estimatedDate,
      terminada: o.completedOn,
      estado,
    };
  });
  const activas = ordenes.filter((o) => o.estado !== "terminada");
  return {
    niveles: d.levels,
    porNivel: d.levels.map((l) => ({ ...l, n: activas.filter((o) => o.nivel === l.code).length })),
    activas: activas.length,
    atrasadas: activas.filter((o) => o.estado === "atrasada").length,
    enRiesgo: activas.filter((o) => o.estado === "en_riesgo").length,
    pausadas: activas.filter((o) => o.estado === "pausada").length,
    terminadasMes: ordenes.length - activas.length,
    ordenes,
  };
}

// ---------- Cotizaciones ----------
function resumenCotizaciones(d, hoy) {
  if (!d) return null;
  // Una cotización puede tener varias revisiones: cuenta solo la más reciente.
  const ultimas = {};
  for (const q of d.cotizaciones) {
    const k = q.dealId || q.id;
    if (!ultimas[k] || (q.revision || 0) > (ultimas[k].revision || 0)) ultimas[k] = q;
  }
  const lista = Object.values(ultimas);
  const desde = addDays(hoy, -89);
  const reciente = lista.filter((q) => q.fecha && q.fecha.slice(0, 10) >= desde);
  const abiertas = lista.filter((q) => q.estado === "sent");
  const ganadas = reciente.filter((q) => q.estado === "won");
  const perdidas = reciente.filter((q) => q.estado === "lost");
  const vendedores = {};
  for (const q of reciente) {
    if (q.estado === "draft") continue;
    const v = (vendedores[q.vendedor || "—"] = vendedores[q.vendedor || "—"] || { vendedor: q.vendedor || "—", enviadas: 0, ganadas: 0, valorGanado: 0 });
    v.enviadas++;
    if (q.estado === "won") {
      v.ganadas++;
      v.valorGanado += q.total;
    }
  }
  const corta = (q) => ({ cliente: q.cliente, negocio: q.negocio, vendedor: q.vendedor, fecha: q.fecha, total: q.total, tamano: q.tamano, tipo: q.tipo });
  return {
    abiertas: abiertas.length,
    valorAbierto: abiertas.reduce((a, q) => a + q.total, 0),
    ganadas90: ganadas.length,
    valorGanado90: ganadas.reduce((a, q) => a + q.total, 0),
    perdidas90: perdidas.length,
    cierre90: ganadas.length + perdidas.length > 0 ? r0((ganadas.length / (ganadas.length + perdidas.length)) * 100) : null,
    ticket: ganadas.length ? r0(ganadas.reduce((a, q) => a + q.total, 0) / ganadas.length) : null,
    ganadasSinOrden: lista.filter((q) => q.estado === "won" && !q.ordenDeVenta).map(corta),
    abiertasLista: abiertas.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 10).map(corta),
    vendedores: Object.values(vendedores).sort((a, b) => b.valorGanado - a.valorGanado),
    lista,
  };
}

// ---------- Sales Orders (Cotizaciones → Producción, Compras, Cobranza) ----------
const PASOS = ["produccion", "compras", "cobranza"];

export function resumenSalesOrders(d) {
  if (!d) return null;
  const lista = d.cotizaciones
    .filter((q) => q.salesOrder)
    .map((q) => {
      const so = q.salesOrder;
      const e = so.envio;
      let estado;
      if (so.anterior) estado = "anterior";
      else if (!e) estado = q.estado === "won" ? "por_enviar" : "no_ganada";
      else estado = PASOS.every((k) => e[k] && e[k].ok) ? "enviada" : "error";
      return {
        folio: so.folio,
        proyecto: so.proyecto || q.negocio || q.cliente,
        cliente: q.cliente,
        vendedor: q.vendedor,
        entrega: so.entrega,
        total: q.total,
        financiado: !!q.financiamiento,
        estado,
        enviada: e ? e.at : null,
        produccion: e ? e.produccion : null,
        compras: e ? e.compras : null,
        cobranza: e ? e.cobranza : null,
      };
    });
  const orden = { error: 0, por_enviar: 1, no_ganada: 2, enviada: 3, anterior: 4 };
  lista.sort((a, b) => orden[a.estado] - orden[b.estado] || (b.enviada || b.entrega || "").localeCompare(a.enviada || a.entrega || ""));
  const n = (s) => lista.filter((x) => x.estado === s).length;
  return { porEnviar: n("por_enviar"), conError: n("error"), enviadas: n("enviada"), anteriores: n("anterior"), lista };
}

// ---------- Costeo ----------
function resumenCosteo(d, hoy) {
  if (!d) return null;
  const mesActual = hoy.slice(0, 7);
  const meses = (d.gastoPorMes || []).filter((m) => m.mes <= mesActual).slice(-13);
  const actual = meses.find((m) => m.mes === mesActual) || { mes: mesActual, mxn: 0, usd: 0 };
  const proyectos = d.proyectos.filter((p) => p.valido);
  return {
    gastoPorMes: meses,
    mesActual: actual,
    gasto14Mxn: r2(d.gastosRecientes.reduce((a, g) => a + g.importe, 0)),
    propuesta: {
      viernes: d.propuesta.viernes,
      total: d.propuesta.total,
      facturas: d.propuesta.facturas.length,
      atrasadas: d.propuesta.facturas.filter((f) => f.atrasada).length,
      porVerificar: d.propuesta.porVerificar,
    },
    indirectosPendientesMxn: d.indirectosPendientesMxn,
    activos: proyectos.filter((p) => p.estado === "activo").length,
    proyectos,
  };
}

// ---------- Proyectos ligados entre portales ----------
function ligarProyectos({ costeo, produccion, cotizaciones, cobranza }, crudos) {
  const filas = {};
  const fila = (nombre) => {
    const k = normKey(nombre);
    if (!k) return null;
    return (filas[k] = filas[k] || { key: k, nombre, costeo: null, produccion: null, venta: null, cobranza: null });
  };
  if (produccion) for (const o of produccion.ordenes) { const f = fila(o.nombre); if (f) f.produccion = o; }
  if (costeo) {
    for (const p of costeo.proyectos) {
      // Solo proyectos vivos o que siguen en producción: lo terminado hace tiempo no aporta.
      if (p.estado !== "activo" && !filas[normKey(p.nombre)] && !filas[normKey(p.key)]) continue;
      const f = filas[normKey(p.key)] || fila(p.nombre);
      if (f) f.costeo = { mxn: p.mxn, totalUsd: p.costo ? p.costo.totalUsd : null, ventaUsd: p.costo ? p.costo.ventaUsd : null, margenPct: p.costo ? p.costo.margenPct : null, estado: p.estado, ultimoGasto: p.ultimoGasto ? p.ultimoGasto.fecha : null };
    }
  }
  if (cotizaciones) {
    for (const q of cotizaciones.lista) {
      if (q.estado !== "won") continue;
      const f = filas[normKey(q.proyecto)] || filas[normKey(q.negocio)] || filas[normKey(q.cliente)];
      if (f) f.venta = { total: q.total, vendedor: q.vendedor, fecha: q.fecha };
    }
  }
  if (cobranza && crudos.cobranza) {
    for (const c of crudos.cobranza.clientes) {
      if (!c.activo) continue;
      const f = filas[normKey(c.negocio)] || filas[normKey(c.cliente)] || filas[normKey(c.traila)];
      if (f) f.cobranza = { estado: c.estado, vencido: c.vencido, diasAtraso: c.diasAtraso, resta: c.resta };
    }
  }
  const prioridad = (f) => (f.produccion && f.produccion.estado !== "terminada" ? 0 : 1);
  return Object.values(filas).sort((a, b) => prioridad(a) - prioridad(b) || (b.costeo ? b.costeo.mxn : 0) - (a.costeo ? a.costeo.mxn : 0));
}

// ---------- Alertas ----------
const fmtUsd = (n) => "$" + r0(n).toLocaleString("en-US") + " USD";
const fmtMxn = (n) => "$" + r0(n).toLocaleString("en-US") + " MXN";

function alertas({ costeo, produccion, cotizaciones, cobranza, salesOrders }, proyectos) {
  const a = [];
  if (salesOrders) {
    const errores = salesOrders.lista.filter((x) => x.estado === "error");
    if (errores.length) {
      a.push({ nivel: "bad", portal: "Sales Orders", titulo: `${errores.length} Sales Order${errores.length > 1 ? "s" : ""} con error al enviar`, detalle: errores.slice(0, 3).map((x) => x.proyecto).join(", ") + " · reintentar en Cotizaciones" });
    }
    const pendientes = salesOrders.lista.filter((x) => x.estado === "por_enviar");
    if (pendientes.length) {
      a.push({ nivel: "warn", portal: "Sales Orders", titulo: `${pendientes.length} Sales Order${pendientes.length > 1 ? "s" : ""} sin enviar a producción`, detalle: pendientes.slice(0, 4).map((x) => x.proyecto).join(", ") });
    }
  }
  if (cobranza) {
    const graves = cobranza.contactar.filter((c) => c.diasAtraso > 14);
    if (graves.length) a.push({ nivel: "bad", portal: "Cobranza", titulo: `${graves.length} cliente${graves.length > 1 ? "s" : ""} con más de 14 días de atraso`, detalle: `Suman ${fmtUsd(graves.reduce((s, c) => s + c.vencido, 0))} · ${graves.slice(0, 3).map((c) => c.negocio || c.cliente).join(", ")}` });
    if (cobranza.porConfirmar) a.push({ nivel: "warn", portal: "Cobranza", titulo: `${cobranza.porConfirmar} cliente${cobranza.porConfirmar > 1 ? "s" : ""} por confirmar`, detalle: "Contratos pendientes de revisar en el portal" });
  }
  if (produccion) {
    for (const o of produccion.ordenes.filter((x) => x.estado === "atrasada").slice(0, 4))
      a.push({ nivel: "bad", portal: "Producción", titulo: `${o.nombre} atrasada${o.nivelNombre ? " en " + o.nivel + " " + o.nivelNombre : ""}`, detalle: `Entrega ${o.entrega || "sin fecha"}${o.estimada ? " · estimada " + o.estimada : ""}` });
    if (produccion.enRiesgo) a.push({ nivel: "warn", portal: "Producción", titulo: `${produccion.enRiesgo} orden${produccion.enRiesgo > 1 ? "es" : ""} en riesgo de no llegar a tiempo`, detalle: produccion.ordenes.filter((o) => o.estado === "en_riesgo").map((o) => o.nombre).slice(0, 4).join(", ") });
  }
  if (costeo) {
    if (costeo.propuesta.atrasadas) a.push({ nivel: "warn", portal: "Costeo", titulo: `${costeo.propuesta.atrasadas} factura${costeo.propuesta.atrasadas > 1 ? "s" : ""} de proveedor vencida${costeo.propuesta.atrasadas > 1 ? "s" : ""}`, detalle: `Propuesta del viernes ${costeo.propuesta.viernes}: ${fmtMxn(costeo.propuesta.total)}` });
    for (const p of costeo.proyectos.filter((x) => x.estado === "activo" && x.costo && x.costo.margenPct != null && x.costo.margenPct < 15).slice(0, 3))
      a.push({ nivel: p.costo.margenPct < 5 ? "bad" : "warn", portal: "Costeo", titulo: `Margen de ${p.nombre} en ${r0(p.costo.margenPct)}%`, detalle: `Costo ${fmtUsd(p.costo.totalUsd)} contra venta ${fmtUsd(p.costo.ventaUsd)}` });
  }
  if (cotizaciones && cotizaciones.ganadasSinOrden.length) {
    const n = cotizaciones.ganadasSinOrden.length;
    a.push({ nivel: "info", portal: "Cotizaciones", titulo: `${n} cotización${n > 1 ? "es" : ""} ganada${n > 1 ? "s" : ""} sin orden de venta`, detalle: cotizaciones.ganadasSinOrden.slice(0, 4).map((q) => q.negocio || q.cliente).join(", ") });
  }
  const orden = { bad: 0, warn: 1, info: 2 };
  return a.sort((x, y) => orden[x.nivel] - orden[y.nivel]);
}

/** crudos: { costeo, cobranza, cotizaciones, produccion } con lo que respondió cada portal (o null). */
export function armarResumen(crudos, hoy) {
  const r = {
    costeo: resumenCosteo(crudos.costeo, hoy),
    cobranza: resumenCobranza(crudos.cobranza, hoy),
    cotizaciones: resumenCotizaciones(crudos.cotizaciones, hoy),
    produccion: resumenProduccion(crudos.produccion, hoy),
    salesOrders: resumenSalesOrders(crudos.cotizaciones),
  };
  const proyectos = ligarProyectos(r, crudos);
  const out = { hoy, ...r, proyectos, alertas: alertas(r, proyectos) };
  // La lista completa de cotizaciones y proyectos de costeo solo sirve para ligar; no se manda al navegador.
  if (out.cotizaciones) delete out.cotizaciones.lista;
  if (out.costeo) out.costeo = { ...out.costeo, proyectos: undefined };
  return out;
}
