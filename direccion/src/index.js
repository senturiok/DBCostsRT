// Tablero de Dirección (direccion.serviceranchotrailers.org).
// Un solo usuario con contraseña (DIRECCION_PASSWORD) y cookie firmada con
// SESSION_SECRET. Solo lee: nunca escribe en ningún portal.
import { armarResumen } from "./resumen.js";
import { loginPage, dashboardPage } from "./page.js";

const COSTEO_URL = "https://dbcosteo.serviceranchotrailers.org";
const COBRANZA_URL = "https://pcobranza.serviceranchotrailers.org";
const COTIZACIONES_URL = "https://pcot.serviceranchotrailers.org";
const PRODUCCION_URL = "https://produccion.serviceranchotrailers.org";

const COOKIE = "rt_dir";
const SESSION_DAYS = 30;

const enc = new TextEncoder();

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sameString(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sessionValid(request, env) {
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)rt_dir=([^;]+)/);
  if (!m || !env.SESSION_SECRET) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sameString(sig, await hmac(env.SESSION_SECRET, "dir:" + exp));
}

const SECURITY = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "no-store",
};

function html(body, nonce, status = 200, extra = {}) {
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src https://fonts.gstatic.com",
    "connect-src 'self'",
    "img-src 'self' data:",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp, ...SECURITY, ...extra } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...SECURITY } });
}

const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: { location: to, ...SECURITY, ...extra } });

async function fuente(nombre, url, token) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { nombre, ok: false, error: `respondió ${res.status}`, ms: Date.now() - t0, datos: null };
    return { nombre, ok: true, ms: Date.now() - t0, datos: await res.json() };
  } catch (e) {
    return { nombre, ok: false, error: String(e && e.message ? e.message : e), ms: Date.now() - t0, datos: null };
  }
}

async function resumen(env) {
  const tok = env.DIRECCION_TOKEN;
  const fuentes = await Promise.all([
    fuente("costeo", `${COSTEO_URL}/bot/datos`, tok),
    fuente("cobranza", `${COBRANZA_URL}/bot/datos`, tok),
    fuente("cotizaciones", `${COTIZACIONES_URL}/bot/datos`, tok),
    fuente("produccion", `${PRODUCCION_URL}/api/public/ordenes`, null),
    // Lo que hizo cada equipo el día hábil anterior (su propia clave PRODUCCION_TOKEN).
    fuente("equipos", `${PRODUCCION_URL}/api/direccion/equipos`, env.PRODUCCION_TOKEN),
  ]);
  const crudos = Object.fromEntries(fuentes.map((f) => [f.nombre, f.datos]));
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return {
    generado: new Date().toISOString(),
    fuentes: Object.fromEntries(fuentes.map((f) => [f.nombre, { ok: f.ok, error: f.error || null, ms: f.ms }])),
    ...armarResumen(crudos, hoy),
    equipos: crudos.equipos || null,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const nonce = crypto.randomUUID().replace(/-/g, "");

    if (url.pathname === "/login") {
      if (request.method === "GET") return html(loginPage(nonce, ""), nonce);
      if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });
      const form = await request.formData();
      const pass = String(form.get("password") || "");
      // Se comparan las firmas para que el tiempo no dependa de la contraseña.
      const ok = env.DIRECCION_PASSWORD && env.SESSION_SECRET && sameString(await hmac(env.SESSION_SECRET, "pw:" + pass), await hmac(env.SESSION_SECRET, "pw:" + env.DIRECCION_PASSWORD));
      if (!ok) {
        await new Promise((r) => setTimeout(r, 1200));
        return html(loginPage(nonce, "Contraseña incorrecta."), nonce, 401);
      }
      const exp = String(Date.now() + SESSION_DAYS * 864e5);
      const cookie = `${COOKIE}=${exp}.${await hmac(env.SESSION_SECRET, "dir:" + exp)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`;
      return redirect("/", { "set-cookie": cookie });
    }

    if (url.pathname === "/logout" && request.method === "POST") {
      return redirect("/login", { "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
    }

    const valid = await sessionValid(request, env);
    if (url.pathname === "/api/resumen") {
      if (!valid) return json({ error: "Sesión vencida" }, 401);
      return json(await resumen(env));
    }
    if (url.pathname === "/") return valid ? html(dashboardPage(nonce), nonce) : redirect("/login");
    return new Response("No encontrado", { status: 404, headers: SECURITY });
  },
};
