// Recibos de nómina por WhatsApp. Al marcar una semana pagada (o con
// "Reenviar"), se arma el PDF del recibo de cada empleado con el formato de
// ABA, se guarda en R2 y se le pide al Portal de Producción (donde vive el
// bot) que lo mande al WhatsApp del empleado. El sueldo no sale de aquí: a
// Producción solo va el teléfono, un texto y un enlace firmado al PDF que
// vence en 7 días (GET /recibo/<semana>/<empleado>.pdf?exp&sig).
import { PDFDocument, StandardFonts, rgb } from "./vendor/pdf-lib-1.17.1.esm.min.js";

const ORIGEN = "https://dbcosteo.serviceranchotrailers.org";
const PRODUCCION_URL = "https://produccion.serviceranchotrailers.org";
const ENLACE_MS = 7 * 24 * 60 * 60 * 1000;
// Igual que la página (index.html, módulo Nómina).
const NOM_BLOQUE = 480;
const NOM_HORAS_JORNADA = 9.5;
const NOM_DIAS = ["L", "M", "X", "J", "V"];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const enc = new TextEncoder();

async function firma(secret, semana, empId, exp) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`recibo:${semana}:${empId}:${exp}`)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
function mismo(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const claveR2 = (semana, empId) => `nomina/recibos/${semana}/${empId}.pdf`;

/** Solo dígitos con lada (10 dígitos = México). null si no hay teléfono útil. Igual que Producción. */
export function normTelefono(t) {
  const d = String(t || "").replace(/\D/g, "");
  if (d.length === 10) return "52" + d;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

const MES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fechaCorta = (iso) => (iso ? `${+iso.slice(8)}-${MES[+iso.slice(5, 7) - 1]}-${iso.slice(2, 4)}` : "");
const dinero = (n) => (n ? "$" + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "$ -");
const cant = (n) => String(Math.round((Number(n) || 0) * 100) / 100);

/** Datos del recibo de un empleado en una semana pagada (puro). semanas: todas las semanas de nómina. */
export function datosRecibo(semanaId, doc, empId, emp, semanas) {
  const l = (doc.lineas || {})[empId];
  if (!l || !l.calc || !l.despues) return null;
  const foto = Object.assign({}, emp || {}, l.foto || {});
  const c = l.calc, s = l.despues;
  const desde = s.ultimoAniversario || (emp && emp.ultimoAniversario) || (emp && emp.ingreso) || "";
  let usadas = 0, minMes = 0;
  const mes = (doc.desde || "").slice(0, 7);
  for (const [sid, d] of Object.entries(semanas || {})) {
    const x = d && d.estado === "pagada" && (d.lineas || {})[empId];
    if (!x) continue;
    if ((d.hasta || "") >= desde || sid === semanaId) usadas += ((x.calc || {}).vac || 0) + ((x.despues || {}).penSemana || 0);
    if ((d.desde || "").slice(0, 7) === mes) minMes += (x.calc || {}).retardo || 0;
  }
  const pu = Number(foto.pu) || 0;
  return {
    id: empId,
    nombre: foto.nombre || empId,
    categoria: foto.categoria || "",
    telefono: (emp && emp.telefono) || "",
    ingreso: (emp && emp.ingreso) || "",
    vacAsignadas: r2(s.vacaciones + usadas),
    vacUsadas: r2(usadas),
    vacDisponibles: r2(s.vacaciones),
    dias: c.dias, pu, sueldo: c.sueldo, he: c.he || 0, valorHora: r2((pu / NOM_HORAS_JORNADA) * 2), pagoExtra: c.pagoExtra || 0,
    otros: c.otros || 0, deduc: c.deduc || 0, total: c.total,
    cw: "cw" + Number(String(semanaId).split("W")[1]), inicio: doc.desde, termino: doc.hasta,
    minMes, mac: s.mac, mr: NOM_BLOQUE - s.mac, diasPenalizados: s.diasPenalizados,
    notas: l.obs || "",
  };
}

/** PDF carta del recibo, con el formato que ABA entrega a sus empleados. */
export async function reciboPdf(r, logoBytes) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Recibo de nómina ${r.cw} · ${r.nombre}`);
  const page = pdf.addPage([612, 792]);
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const b = await pdf.embedFont(StandardFonts.HelveticaBold);
  const negro = rgb(0, 0, 0), gris = rgb(0.91, 0.91, 0.91), rojo = rgb(0.89, 0.02, 0.07), blanco = rgb(1, 1, 1);
  const L = 48, R = 564;
  let y = 750;
  if (logoBytes) {
    try {
      const img = await pdf.embedPng(logoBytes);
      const h = 58, w = (img.width / img.height) * h;
      page.drawImage(img, { x: (612 - w) / 2, y: y - h, width: w, height: h });
      y -= h + 14;
    } catch {
      y -= 10;
    }
  }
  const txt = (s, x, yy, opts = {}) => page.drawText(String(s ?? ""), { x, y: yy, size: opts.size || 10, font: opts.bold ? b : f, color: opts.color || negro });
  const der = (s, xr, yy, opts = {}) => { const w = (opts.bold ? b : f).widthOfTextAtSize(String(s), opts.size || 10); txt(s, xr - w, yy, opts); };
  const centro = (s, yy, opts = {}) => { const w = (opts.bold ? b : f).widthOfTextAtSize(String(s), opts.size || 10); txt(s, (612 - w) / 2, yy, opts); };
  const barra = (titulo) => { page.drawRectangle({ x: L, y: y - 4, width: R - L, height: 15, color: gris }); centro(titulo, y, { bold: true }); y -= 17; };

  barra("DATOS GENERALES");
  const filasDatos = [
    ["ID EMPLEADO", r.id, "FECHA DE INGRESO", fechaCorta(r.ingreso)],
    ["NOMBRE DE EMPLEADO", r.nombre, "VACACIONES ASIGNADAS", cant(r.vacAsignadas)],
    ["CATEGORIA", r.categoria, "VACACIONES UTILIZADAS", cant(r.vacUsadas)],
    ["TELEFONO EMPLEADO", r.telefono, "VACACIONES DISPONIBLES", cant(r.vacDisponibles)],
  ];
  for (const [a, va, c, vc] of filasDatos) {
    txt(a, L + 4, y); txt(va, 230, y, { bold: true }); txt(c, 360, y); txt(vc, 505, y, { bold: true });
    y -= 15;
  }
  y -= 8;
  barra("PERCEPCIONES");
  txt("CANTIDAD", 280, y, { bold: true }); der("VALOR", 470, y, { bold: true }); der("TOTALES", R - 4, y, { bold: true });
  y -= 15;
  const perc = [
    ["SALARIO BASE", String(r.dias), dinero(r.pu), dinero(r.sueldo)],
    ["HORAS EXTRA DOBLE", String(r.he), dinero(r.valorHora), dinero(r.pagoExtra)],
    ["HORAS EXTRA TRIPLE", "", "", "$ -"],
    ["COMISIONES O BONOS", "", dinero(r.otros), dinero(r.otros)],
  ];
  for (const [a, q, v, t] of perc) {
    txt(a, L + 4, y); if (q) txt(q, 300, y); if (v) der(v, 470, y); der(t, R - 4, y, { bold: true });
    y -= 15;
  }
  page.drawRectangle({ x: L, y: y - 4, width: 430, height: 15, color: rojo });
  txt("DESCUENTOS", L + 4, y, { color: blanco }); der(dinero(r.deduc), 470, y, { color: blanco });
  der(r.deduc ? "-" + dinero(r.deduc) : "$ -", R - 4, y, { bold: true });
  y -= 24;
  txt("TOTAL A PAGAR", L + 4, y, { bold: true, size: 11 }); der(dinero(r.total), R - 4, y, { bold: true, size: 11 });
  y -= 24;
  txt("NUMERO DE SEMANA", L + 4, y); txt(r.cw, 250, y, { bold: true });
  y -= 15;
  txt("SEMANA INICIO", L + 4, y); txt(fechaCorta(r.inicio), 250, y, { bold: true }); txt("TERMINO", 380, y); txt(fechaCorta(r.termino), 500, y, { bold: true });
  y -= 22;
  barra("MINUTOS DE RETARDO ACUMULADOS");
  for (const [a, v] of [["MES ACTUAL", r.minMes], ["MINUTOS ACUMULADOS TOTAL", r.mac], ["MINUTOS RESTANTES ANTES DE PENALIZACION", r.mr], ["DIAS PENALIZADOS", r.diasPenalizados]]) {
    txt(a, L + 4, y); der(String(v), 470, y, { bold: true });
    y -= 15;
  }
  y -= 8;
  barra("NOTAS GENERALES DE NOMINA");
  const notas = (r.notas || "—").replace(/[^\x20-\x7E -ÿ]/g, "");
  // Partir en renglones que quepan.
  let linea = "";
  for (const w of notas.split(/\s+/)) {
    const prueba = linea ? linea + " " + w : w;
    if (f.widthOfTextAtSize(prueba, 10) > R - L - 8) { txt(linea, L + 4, y); y -= 13; linea = w; } else linea = prueba;
  }
  if (linea) txt(linea, L + 4, y);
  return await pdf.save();
}

async function logo(env) {
  try {
    const res = await env.ASSETS.fetch(new Request(ORIGEN + "/img/aba-logo.png"));
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/**
 * Arma y manda (vía Producción) los recibos de una semana pagada. soloEmp:
 * reenviar solo a ese empleado. Guarda en la semana a quién se mandó.
 * → { enviados: [nombres], sinTelefono: [nombres], errores: [{nombre, error}] }
 */
export async function enviarRecibos(env, semanaId, soloEmp, deps) {
  const out = { enviados: [], sinTelefono: [], errores: [] };
  const doc = await deps.getDoc(env, "nomina_semanas", semanaId);
  if (!doc || doc.estado !== "pagada") return { ...out, error: "La semana no está pagada." };
  if (!env.INTEGRACION_TOKEN) return { ...out, error: "Falta INTEGRACION_TOKEN." };
  const [empRows, semRows, png] = await Promise.all([deps.listDocs(env, "nomina_empleados"), deps.listDocs(env, "nomina_semanas"), logo(env)]);
  const empleados = Object.fromEntries(empRows.map((r) => [r.id, r.data]));
  const semanas = Object.fromEntries(semRows.map((r) => [r.id, r.data]));
  const mensajes = [], quienes = [];
  const envios = Object.assign({}, doc.envios || {});
  const ahora = new Date().toISOString();
  for (const empId of Object.keys(doc.lineas || {})) {
    if (soloEmp && empId !== soloEmp) continue;
    const emp = empleados[empId];
    const r = datosRecibo(semanaId, doc, empId, emp, semanas);
    if (!r) continue;
    const tel = normTelefono(emp && emp.telefono);
    if (!tel) {
      out.sinTelefono.push(r.nombre);
      envios[empId] = { fecha: ahora, ok: false, error: "Sin teléfono" };
      continue;
    }
    try {
      const bytes = await reciboPdf(r, png);
      await env.COMPROBANTES.put(claveR2(semanaId, empId), bytes, { httpMetadata: { contentType: "application/pdf" } });
      const exp = Date.now() + ENLACE_MS;
      const sig = await firma(env.INTEGRACION_TOKEN, semanaId, empId, exp);
      const nombre = r.nombre.split(" ")[0];
      mensajes.push({
        telefono: tel,
        texto: `Hola ${nombre.charAt(0) + nombre.slice(1).toLowerCase()}, aquí está tu recibo de nómina de la ${r.cw.toUpperCase()} (${fechaCorta(r.inicio)} al ${fechaCorta(r.termino)}). Total: ${dinero(r.total)}. ABA Manufacturing.`,
        documentUrl: `${ORIGEN}/recibo/${encodeURIComponent(semanaId)}/${encodeURIComponent(empId)}.pdf?exp=${exp}&sig=${sig}`,
        documentName: `Recibo ${r.cw.toUpperCase()} ${r.nombre}.pdf`,
      });
      quienes.push({ empId, nombre: r.nombre, tel });
    } catch (e) {
      out.errores.push({ nombre: r.nombre, error: String((e && e.message) || e) });
      envios[empId] = { fecha: ahora, ok: false, error: "No se pudo generar el PDF" };
    }
  }
  if (mensajes.length) {
    let resp = null;
    try {
      const res = await fetch(`${PRODUCCION_URL}/api/integracion/whatsapp`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.INTEGRACION_TOKEN}` },
        body: JSON.stringify({ mensajes }),
        signal: AbortSignal.timeout(20000),
      });
      resp = await res.json().catch(() => null);
      if (!res.ok || !resp || !resp.ok) throw new Error((resp && resp.error) || `Producción respondió ${res.status}`);
    } catch (e) {
      const err = String((e && e.message) || e);
      for (const q of quienes) { out.errores.push({ nombre: q.nombre, error: err }); envios[q.empId] = { fecha: ahora, ok: false, error: err }; }
      quienes.length = 0;
    }
    quienes.forEach((q, i) => {
      const r = resp && resp.resultados && resp.resultados[i];
      if (r && r.ok) { out.enviados.push(q.nombre); envios[q.empId] = { fecha: ahora, ok: true, telefono: q.tel }; }
      else { const err = (r && r.error) || "No se pudo encolar"; out.errores.push({ nombre: q.nombre, error: err }); envios[q.empId] = { fecha: ahora, ok: false, error: err }; }
    });
  }
  await deps.putDoc(env, "nomina_semanas", semanaId, Object.assign({}, doc, { envios }));
  return out;
}

/** GET /recibo/<semana>/<empleado>.pdf?exp&sig — PDF guardado, solo con enlace firmado vigente. */
export async function handleReciboGet(env, url, semana, archivo) {
  const empId = decodeURIComponent(archivo.replace(/\.pdf$/, ""));
  const sem = decodeURIComponent(semana);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") || "";
  if (!env.INTEGRACION_TOKEN || !exp || exp < Date.now() || !mismo(sig, await firma(env.INTEGRACION_TOKEN, sem, empId, exp)))
    return new Response("Enlace vencido o inválido", { status: 403 });
  const obj = await env.COMPROBANTES.get(claveR2(sem, empId));
  if (!obj) return new Response("No encontrado", { status: 404 });
  return new Response(obj.body, { headers: { "content-type": "application/pdf", "cache-control": "no-store" } });
}

/**
 * Recibo de PRUEBA para un empleado: comprueba que su WhatsApp esté bien sin
 * pagar ninguna semana ni tocar saldos. Usa su último recibo pagado si tiene;
 * si no, una semana de ejemplo con su sueldo y sus saldos actuales. El PDF y
 * el mensaje dicen PRUEBA. → { ok, telefono } o { ok:false, error }
 */
export async function enviarReciboPrueba(env, empId, deps) {
  if (!env.INTEGRACION_TOKEN) return { ok: false, error: "Falta INTEGRACION_TOKEN." };
  const emp = await deps.getDoc(env, "nomina_empleados", empId);
  if (!emp) return { ok: false, error: "No existe el empleado." };
  const tel = normTelefono(emp.telefono);
  if (!tel) return { ok: false, error: "El empleado no tiene WhatsApp capturado." };
  const semRows = await deps.listDocs(env, "nomina_semanas");
  const semanas = Object.fromEntries(semRows.map((r) => [r.id, r.data]));
  const pagadas = Object.keys(semanas).filter((k) => semanas[k] && semanas[k].estado === "pagada" && (semanas[k].lineas || {})[empId]).sort();
  let r = pagadas.length ? datosRecibo(pagadas[pagadas.length - 1], semanas[pagadas[pagadas.length - 1]], empId, emp, semanas) : null;
  if (!r) {
    // Semana de ejemplo: la actual (lunes a viernes) con su sueldo completo y sus saldos de hoy.
    const hoy = new Date(Date.now() - 6 * 3600 * 1000);
    const dow = (hoy.getUTCDay() + 6) % 7;
    const lunes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - dow));
    const iso = (d) => d.toISOString().slice(0, 10);
    const jueves = new Date(lunes.getTime() + 3 * 864e5);
    const ene4 = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4));
    const cw = 1 + Math.round(((jueves - ene4) / 864e5 - 3 + ((ene4.getUTCDay() + 6) % 7)) / 7);
    const pu = Number(emp.pu) || 0, mac = Number(emp.mac) || 0, vac = Number(emp.vacaciones) || 0;
    r = {
      id: empId, nombre: emp.nombre || empId, categoria: emp.categoria || "", telefono: emp.telefono || "", ingreso: emp.ingreso || "",
      vacAsignadas: vac, vacUsadas: 0, vacDisponibles: vac,
      dias: 5, pu, sueldo: r2(pu * 5), he: 0, valorHora: r2((pu / NOM_HORAS_JORNADA) * 2), pagoExtra: 0, otros: 0, deduc: 0, total: r2(pu * 5),
      cw: "cw" + cw, inicio: iso(lunes), termino: iso(new Date(lunes.getTime() + 4 * 864e5)),
      minMes: 0, mac, mr: NOM_BLOQUE - mac, diasPenalizados: Number(emp.diasPenalizados) || 0,
    };
  }
  r = Object.assign({}, r, { notas: "RECIBO DE PRUEBA: no es un pago real. Sirve para comprobar que tu WhatsApp está bien registrado." });
  const semana = "PRUEBA";
  const bytes = await reciboPdf(r, await logo(env));
  await env.COMPROBANTES.put(claveR2(semana, empId), bytes, { httpMetadata: { contentType: "application/pdf" } });
  const exp = Date.now() + ENLACE_MS;
  const sig = await firma(env.INTEGRACION_TOKEN, semana, empId, exp);
  const nombre = r.nombre.split(" ")[0];
  const mensaje = {
    telefono: tel,
    texto: `Hola ${nombre.charAt(0) + nombre.slice(1).toLowerCase()}, este es un recibo de PRUEBA de ABA Manufacturing para comprobar que tu WhatsApp está bien registrado. No es un pago real; desde ahora aquí te llegará tu recibo de nómina cada semana.`,
    documentUrl: `${ORIGEN}/recibo/${semana}/${encodeURIComponent(empId)}.pdf?exp=${exp}&sig=${sig}`,
    documentName: `Recibo PRUEBA ${r.nombre}.pdf`,
  };
  try {
    const res = await fetch(`${PRODUCCION_URL}/api/integracion/whatsapp`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.INTEGRACION_TOKEN}` },
      body: JSON.stringify({ mensajes: [mensaje] }),
      signal: AbortSignal.timeout(20000),
    });
    const resp = await res.json().catch(() => null);
    const r0 = resp && resp.resultados && resp.resultados[0];
    if (!res.ok || !r0 || !r0.ok) return { ok: false, error: (r0 && r0.error) || (resp && resp.error) || `Producción respondió ${res.status}` };
    return { ok: true, telefono: emp.telefono };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}
