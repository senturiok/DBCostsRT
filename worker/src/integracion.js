// Entrada del Portal de Cotizaciones (servidor a servidor): al enviar un Sales
// Order a producción, crea o liga el proyecto en Compras. Protegido con el
// secreto INTEGRACION_TOKEN (distinto de los de solo lectura del bot).
//
// POST /integracion/proyectos { folio, internalName, projectName, nombresProduccion, tipo, tamano, cliente, cashPrice }
// - Si un proyecto ya tiene ese folio, lo regresa sin cambiar nada.
// - Si ya existe un proyecto activo sin folio que se llama como el nombre
//   interno, el de proyecto o la orden en Producción, lo liga.
// - Si no, lo crea (con " 2", " 3"… si el nombre ya lo usa otro remolque).
// El folio queda en proyectos_info/<slug>.salesFolio y el cash price (TOTAL PROJECT
// PRICE de la cotización, USD) en .cashPriceUsd: Houston lo propone como precio de venta.

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

// Mismas reglas que normKey/slugify de index.html.
export function normKey(s) {
  if (!s) return "";
  return String(s).trim().toUpperCase().replace(/\s+/g, " ").replace(/\.+$/, "");
}
export function slugify(s) {
  return normKey(s).replace(/[^A-Z0-9_.~:@+-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

const TAMANOS = ["8x12", "8x14", "8x16", "8x18", "8x20", "8x22", "8x24"];

/**
 * Decide qué hacer con el proyecto (pura, para probarla).
 * proyectos: { [key]: { key, info, estado } } con lo que hay hoy (sin eliminados).
 */
export function planProyecto(proyectos, input) {
  const conFolio = Object.values(proyectos).find((p) => p.info && p.info.salesFolio === input.folio);
  if (conFolio) return { accion: "existe", key: conFolio.key };

  const candidatos = [input.internalName, input.projectName, ...(input.nombresProduccion || [])].map(normKey).filter(Boolean);
  for (const k of candidatos) {
    const p = proyectos[k];
    if (p && !(p.info && p.info.salesFolio) && p.estado === "activo") return { accion: "ligar", key: k };
  }

  const base = candidatos[0];
  if (!base) return { accion: "error", error: "Falta el nombre del proyecto" };
  let key = base;
  for (let n = 2; proyectos[key]; n++) key = `${base} ${n}`;
  return { accion: "crear", key };
}

export async function handleIntegracion(request, env, url, deps) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!env.INTEGRACION_TOKEN || !sameToken(token, env.INTEGRACION_TOKEN)) return json({ ok: false, error: "No autorizado" }, 401);
  if (url.pathname !== "/integracion/proyectos") return json({ ok: false, error: "not found" }, 404);
  if (request.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }
  const folio = String(body.folio || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(folio)) return json({ ok: false, error: "Folio inválido" }, 400);
  const tipo = ["CGT", "ICT"].includes(body.tipo) ? body.tipo : "";
  const tamano = TAMANOS.includes(body.tamano) ? body.tamano : "";

  const { getDoc, putDoc, listDocs, logActivity, catalogo } = deps;
  const [nuevos, infos, estados] = await Promise.all([listDocs(env, "proyectos_nuevos"), listDocs(env, "proyectos_info"), listDocs(env, "proyecto_estado")]);
  const infoBySlug = Object.fromEntries(infos.map((d) => [d.id, d.data]));
  const estadoBySlug = Object.fromEntries(estados.map((d) => [d.id, d.data]));
  const proyectos = {};
  const add = (key) => {
    const slug = slugify(key);
    const info = infoBySlug[slug] || null;
    if (info && info.eliminado) return;
    proyectos[key] = { key, info, estado: (estadoBySlug[slug] && estadoBySlug[slug].estado) || "activo" };
  };
  catalogo.filter((p) => p.es_valido).forEach((p) => add(p.key));
  nuevos.forEach((d) => d.data && d.data.key && add(d.data.key));

  const nombresProduccion = Array.isArray(body.nombresProduccion) ? body.nombresProduccion.filter((n) => typeof n === "string") : [];
  const plan = planProyecto(proyectos, { folio, internalName: body.internalName, projectName: body.projectName, nombresProduccion });
  if (plan.accion === "error") return json({ ok: false, error: plan.error }, 400);
  const slug = slugify(plan.key);
  const cashPrice = Number(body.cashPrice) > 0 ? Math.round(Number(body.cashPrice) * 100) / 100 : null;
  if (plan.accion === "existe") {
    // Proyectos ligados antes de mandar el cash price: se completa solo si falta.
    const prev = (await getDoc(env, "proyectos_info", slug)) || {};
    if (cashPrice && !prev.cashPriceUsd) {
      const info = Object.assign({}, prev, { cashPriceUsd: cashPrice, updatedAt: new Date().toISOString() });
      await putDoc(env, "proyectos_info", slug, info);
      await logActivity(env, { isMaster: false, nombre: "Portal de Cotizaciones" }, "PUT", "proyectos_info", slug, info);
    }
    return json({ ok: true, accion: "existe", proyecto: plan.key });
  }

  const now = new Date().toISOString();
  const actor = { isMaster: false, nombre: "Portal de Cotizaciones" };
  if (plan.accion === "crear") {
    const proy = { nombre: plan.key, key: plan.key, creadoEn: now, salesFolio: folio };
    await putDoc(env, "proyectos_nuevos", slug, proy);
    await logActivity(env, actor, "POST", "proyectos_nuevos", slug, proy);
  }
  const prev = (await getDoc(env, "proyectos_info", slug)) || {};
  const info = Object.assign({}, prev, {
    nombre: prev.nombre || plan.key,
    tipoTraila: prev.tipoTraila || tipo,
    tamanoTraila: prev.tamanoTraila || tamano,
    salesFolio: folio,
    cliente: body.cliente || prev.cliente || "",
    cashPriceUsd: prev.cashPriceUsd || cashPrice,
    updatedAt: now,
  });
  await putDoc(env, "proyectos_info", slug, info);
  await logActivity(env, actor, "PUT", "proyectos_info", slug, info);
  return json({ ok: true, accion: plan.accion, proyecto: plan.key });
}
