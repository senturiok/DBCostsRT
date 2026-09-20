/**
 * Rancho Trailers costing portal — Cloudflare Worker backend.
 *
 * Replaces the three Claude Artifact runtime capabilities the app used to
 * depend on:
 *   - window.claude.use("db")        -> /api/state (read) + /api/collections/*  (write), backed by D1
 *   - window.claude.use("assets")    -> /api/files (upload/delete) + /files/:id (serve), backed by R2
 *   - window.claude.use("downloads") -> removed entirely; the client now builds
 *                                        a Blob and triggers <a download> directly,
 *                                        since there is no sandbox to block it outside claude.ai.
 *
 * Login and permissions are enforced here, server-side, mirroring the
 * client's PERM_MAP / isMasterUser() rules in index.html. See
 * authorizeWrite() below for the exact rules and why a couple of
 * collections need special-casing beyond a flat "module required" table.
 */

const SESSION_COOKIE = "rt_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const LIST_COLLECTIONS = ["gastos_nuevos", "proyectos_nuevos", "proveedores_nuevos", "categorias_nuevas", "perfiles"];
const MAP_COLLECTIONS = ["proyecto_estado", "proveedores_info", "proyectos_info", "gastos_edits", "gastos_contabilidad"];
const ALL_COLLECTIONS = new Set([...LIST_COLLECTIONS, ...MAP_COLLECTIONS]);

const ACCEPTED_FILE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

// ---------------------------------------------------------------- utils --

function jsonResponse(body, init) {
  return new Response(JSON.stringify(body), Object.assign({ headers: { "content-type": "application/json; charset=utf-8" } }, init));
}
function errorResponse(status, error) {
  return jsonResponse({ error }, { status });
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function randomHex(byteLen) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLen)));
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}
function sessionCookieHeader(token, maxAgeSeconds, isHttps) {
  // "Secure" makes browsers refuse to store/send the cookie over plain
  // HTTP, which is how `wrangler dev` serves by default — so only set it
  // when the request itself came in over HTTPS (always true in production).
  const secure = isHttps ? " Secure;" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

// ------------------------------------------------------------ passwords --

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  return bytesToHex(salt) + ":" + bytesToHex(new Uint8Array(bits));
}
async function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(":") === -1) return false;
  const saltHex = stored.split(":")[0];
  const recomputed = await hashPassword(password, saltHex);
  return timingSafeEqual(recomputed, stored);
}

// -------------------------------------------------------------- storage --

async function getDoc(env, collection, id) {
  const row = await env.DB.prepare("SELECT data FROM documents WHERE collection = ? AND id = ?").bind(collection, id).first();
  return row ? JSON.parse(row.data) : null;
}
async function putDoc(env, collection, id, data) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO documents (collection, id, data, updated_at) VALUES (?,?,?,?) " +
      "ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at"
  ).bind(collection, id, JSON.stringify(data), now).run();
}
async function deleteDoc(env, collection, id) {
  await env.DB.prepare("DELETE FROM documents WHERE collection = ? AND id = ?").bind(collection, id).run();
}
async function listDocs(env, collection) {
  const { results } = await env.DB.prepare("SELECT id, data FROM documents WHERE collection = ?").bind(collection).all();
  return results.map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
}

// -------------------------------------------------------- activity log --

// "activity_log" is intentionally not in LIST_COLLECTIONS/MAP_COLLECTIONS/
// ALL_COLLECTIONS: it must never be reachable through the generic
// /api/collections/:col write endpoint (authorizeWrite already rejects any
// collection not in ALL_COLLECTIONS as unknown), only written by
// logActivity() below and read through the dedicated, master-only
// /api/activity-log route.
const ACTION_LABELS = { POST: "Creó", PUT: "Guardó", PATCH: "Editó", DELETE: "Eliminó" };
const COLLECTION_LABELS = {
  gastos_nuevos: "Gasto",
  gastos_edits: "Gasto (Excel)",
  gastos_contabilidad: "Crédito/Contabilidad",
  proyecto_estado: "Estado de proyecto",
  proyectos_info: "Proyecto",
  proyectos_nuevos: "Proyecto",
  proveedores_info: "Proveedor",
  proveedores_nuevos: "Proveedor",
  categorias_nuevas: "Categoría",
  perfiles: "Usuario",
};

function summarizeForLog(collection, data) {
  if (!data) return "";
  if (collection === "gastos_nuevos" || collection === "gastos_edits") {
    if (data.eliminado) return "Marcado como eliminado" + (data.descripcion ? ": " + data.descripcion : "");
    const parts = [];
    if (data.descripcion) parts.push(data.descripcion);
    if (data.proveedor) parts.push(data.proveedor);
    if (data.importe !== undefined && data.importe !== null) {
      parts.push("$" + Number(data.importe).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
    return parts.join(" · ");
  }
  if (collection === "gastos_contabilidad") return data.estado ? "Estado: " + data.estado : "";
  if (collection === "proyecto_estado") return (data.key || "") + (data.estado ? " → " + data.estado : "");
  if (
    collection === "proyectos_info" ||
    collection === "proyectos_nuevos" ||
    collection === "proveedores_info" ||
    collection === "proveedores_nuevos" ||
    collection === "categorias_nuevas"
  ) {
    return data.eliminado ? "Eliminado: " + (data.nombre || "") : data.nombre || "";
  }
  // "perfiles": only ever read .nombre here — password_hash must never reach a summary string.
  if (collection === "perfiles") return data.nombre || "";
  return "";
}

async function logActivity(env, profile, method, collection, id, data) {
  try {
    const entryId = randomHex(16);
    const entry = {
      ts: new Date().toISOString(),
      actor: profile.isMaster ? "Master Administrator" : profile.nombre,
      action: ACTION_LABELS[method] || method,
      collection,
      collectionLabel: COLLECTION_LABELS[collection] || collection,
      docId: id,
      summary: summarizeForLog(collection, data),
    };
    await putDoc(env, "activity_log", entryId, entry);
  } catch (e) {
    // A logging failure must never mask a successful write to the caller.
    console.error("logActivity failed", e);
  }
}

async function handleActivityLog(request, env) {
  const profile = await getProfileFromRequest(request, env);
  if (!profile || !profile.isMaster) return errorResponse(403, "Solo el Master Administrator puede ver el log de actividad.");
  const { results } = await env.DB.prepare(
    "SELECT id, data FROM documents WHERE collection = 'activity_log' ORDER BY updated_at DESC LIMIT 300"
  ).all();
  return jsonResponse(results.map((r) => Object.assign({ id: r.id }, JSON.parse(r.data))));
}

async function buildState(env) {
  const out = {};
  for (const col of LIST_COLLECTIONS) {
    const rows = await listDocs(env, col);
    out[col] = rows.map((r) => Object.assign({}, r.data, { id: r.id }));
  }
  for (const col of MAP_COLLECTIONS) {
    const rows = await listDocs(env, col);
    const m = {};
    rows.forEach((r) => { m[r.id] = r.data; });
    out[col] = m;
  }
  // Never let a password hash leave the server, even to an authenticated caller.
  out.perfiles = out.perfiles.map((p) => {
    const clean = Object.assign({}, p);
    delete clean.password_hash;
    return clean;
  });
  return out;
}

// ----------------------------------------------------------- sessions --

async function createSession(env, profileType, profileId) {
  const token = randomHex(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  await env.DB.prepare("INSERT INTO sessions (token, profile_type, profile_id, created_at, expires_at) VALUES (?,?,?,?,?)")
    .bind(token, profileType, profileId || null, now.toISOString(), expires.toISOString())
    .run();
  return token;
}
async function getProfileFromRequest(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare("SELECT * FROM sessions WHERE token = ?").bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  if (row.profile_type === "master") {
    return { isMaster: true, nombre: "Master Administrator" };
  }
  const perfil = await getDoc(env, "perfiles", row.profile_id);
  if (!perfil) return null; // profile was deleted since the session was created
  return { isMaster: false, id: row.profile_id, nombre: perfil.nombre, permisos: perfil.permisos || {} };
}

// --------------------------------------------------------- permissions --

/**
 * Server-side mirror of PERM_MAP / isMasterUser() in index.html. See the
 * migration plan for the reasoning behind each rule; the two that are not a
 * flat "this collection needs this module" lookup are called out explicitly
 * because getting them wrong would let a non-master user delete Excel-origin
 * data or edit it outside the UI's own guardrails.
 */
function hasModule(profile, moduleKey) {
  if (profile.isMaster) return true;
  return !!(profile.permisos && profile.permisos[moduleKey]);
}

const MASTER_ONLY_WRITE_COLLECTIONS = new Set(["perfiles", "gastos_edits"]);
const COLLECTION_MODULE = {
  gastos_contabilidad: "contabilidad",
  proyecto_estado: "catalogos",
  categorias_nuevas: "catalogos",
  proyectos_nuevos: ["catalogos", "registrar"],
  proveedores_nuevos: ["catalogos", "registrar"],
};

function authorizeWrite(profile, collection, method, payload) {
  if (!profile) return { ok: false, status: 401, error: "No autenticado." };
  if (!ALL_COLLECTIONS.has(collection)) return { ok: false, status: 400, error: "Colección desconocida." };

  // Deleting anything is always master-only, no exceptions — matches
  // isMasterUser() gating every delete button in the UI today.
  if (method === "DELETE") {
    return profile.isMaster ? { ok: true } : { ok: false, status: 403, error: "Solo el Master Administrator puede eliminar." };
  }

  // Editing perfiles (Usuarios) and Excel-origin gasto overrides is
  // master-only end to end today (canEditExcel = isMasterUser(), and the
  // Usuarios nav item itself is perm:null -> master only), regardless of
  // http method.
  if (MASTER_ONLY_WRITE_COLLECTIONS.has(collection)) {
    return profile.isMaster ? { ok: true } : { ok: false, status: 403, error: "Solo el Master Administrator puede modificar esto." };
  }

  if (collection === "gastos_nuevos") {
    // POST = registrar un gasto nuevo; PUT/PATCH = editar uno existente.
    const moduleKey = method === "POST" ? "registrar" : "gastos";
    return hasModule(profile, moduleKey) ? { ok: true } : { ok: false, status: 403, error: "No tienes permiso para esta acción." };
  }

  if (collection === "proyectos_info" || collection === "proveedores_info") {
    // The UI's "soft delete" of Excel-origin proyectos/proveedores is a
    // write to this exact collection with {eliminado:true} — not a separate
    // DELETE call. Without this check, any catalogos-permitted user could
    // hand-craft that payload and bypass "solo master puede eliminar".
    if (payload && payload.eliminado === true) {
      return profile.isMaster ? { ok: true } : { ok: false, status: 403, error: "Solo el Master Administrator puede eliminar." };
    }
    return hasModule(profile, "catalogos") ? { ok: true } : { ok: false, status: 403, error: "No tienes permiso de Catálogos." };
  }

  const rule = COLLECTION_MODULE[collection];
  if (Array.isArray(rule)) {
    const allowed = rule.some((m) => hasModule(profile, m));
    return allowed ? { ok: true } : { ok: false, status: 403, error: "No tienes permiso para esta acción." };
  }
  if (rule) {
    return hasModule(profile, rule) ? { ok: true } : { ok: false, status: 403, error: "No tienes permiso para esta acción." };
  }
  return { ok: false, status: 400, error: "Colección desconocida." };
}

// -------------------------------------------------------------- routes --

async function handleLogin(request, env) {
  const isHttps = new URL(request.url).protocol === "https:";
  let body;
  try { body = await request.json(); } catch (e) { return errorResponse(400, "JSON inválido."); }
  const { tipo, id, password } = body || {};
  if (!password) return errorResponse(400, "Falta la contraseña.");

  if (tipo === "master") {
    const masterPassword = env.MASTER_PASSWORD;
    if (!masterPassword || !timingSafeEqual(password, masterPassword)) {
      return errorResponse(401, "Contraseña incorrecta.");
    }
    const token = await createSession(env, "master", null);
    return jsonResponse(
      { profile: { isMaster: true, nombre: "Master Administrator" } },
      { headers: { "Set-Cookie": sessionCookieHeader(token, SESSION_TTL_SECONDS, isHttps) } }
    );
  }

  if (tipo === "perfil" && id) {
    const perfil = await getDoc(env, "perfiles", id);
    if (!perfil || !(await verifyPassword(password, perfil.password_hash))) {
      return errorResponse(401, "Usuario o contraseña incorrectos.");
    }
    const token = await createSession(env, "perfil", id);
    return jsonResponse(
      { profile: { isMaster: false, id, nombre: perfil.nombre, permisos: perfil.permisos || {} } },
      { headers: { "Set-Cookie": sessionCookieHeader(token, SESSION_TTL_SECONDS, isHttps) } }
    );
  }

  return errorResponse(400, "Solicitud de login inválida.");
}

async function handleLogoutRequest(request, env) {
  const isHttps = new URL(request.url).protocol === "https:";
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return jsonResponse({ ok: true }, { headers: { "Set-Cookie": sessionCookieHeader("", 0, isHttps) } });
}

async function handleLoginOptions(env) {
  // Public, pre-auth: only what the login screen's user picker needs.
  const rows = await listDocs(env, "perfiles");
  return jsonResponse(rows.map((r) => ({ id: r.id, nombre: r.data.nombre })));
}

async function handleFileUpload(request, env) {
  const profile = await getProfileFromRequest(request, env);
  if (!profile) return errorResponse(401, "No autenticado.");
  let form;
  try { form = await request.formData(); } catch (e) { return errorResponse(400, "Solicitud inválida."); }
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return errorResponse(400, "Falta el archivo.");
  const contentType = file.type || "application/octet-stream";
  if (!ACCEPTED_FILE_TYPES.has(contentType)) return errorResponse(415, "Tipo de archivo no permitido.");
  if (file.size > MAX_FILE_BYTES) return errorResponse(413, "El archivo es demasiado grande (máximo 20 MB).");
  const id = randomHex(16);
  const buf = await file.arrayBuffer();
  await env.COMPROBANTES.put(id, buf, { httpMetadata: { contentType } });
  return jsonResponse({ id, url: "/files/" + id, sizeBytes: buf.byteLength, contentType });
}

async function handleFileServe(request, env, id) {
  const profile = await getProfileFromRequest(request, env);
  if (!profile) return errorResponse(401, "No autenticado.");
  const obj = await env.COMPROBANTES.get(id);
  if (!obj) return errorResponse(404, "No encontrado.");
  return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "application/octet-stream" } });
}

async function handleFileDelete(request, env, id) {
  const profile = await getProfileFromRequest(request, env);
  if (!profile || !profile.isMaster) return errorResponse(403, "Solo el Master Administrator puede eliminar.");
  await env.COMPROBANTES.delete(id);
  return jsonResponse({ deleted: true });
}

async function handleCollectionWrite(request, env, collection, id, method) {
  const profile = await getProfileFromRequest(request, env);
  let payload = null;
  if (method !== "DELETE") {
    try { payload = await request.json(); } catch (e) { return errorResponse(400, "JSON inválido."); }
  }
  const decision = authorizeWrite(profile, collection, method, payload);
  if (!decision.ok) return errorResponse(decision.status, decision.error);

  // The client's perfil form (index.html handlePerfilSubmit) sends a plain
  // "password" field, same as it always did for the Claude-artifact db —
  // it must never be persisted as-is. Hash it here, once, regardless of
  // which write path (create or edit) carried it.
  if (collection === "perfiles" && payload && typeof payload.password === "string") {
    if (payload.password) payload.password_hash = await hashPassword(payload.password);
    delete payload.password;
  }

  if (method === "POST") {
    const newId = randomHex(16);
    await putDoc(env, collection, newId, payload);
    await logActivity(env, profile, method, collection, newId, payload);
    return jsonResponse({ id: newId });
  }
  if (method === "PUT") {
    await putDoc(env, collection, id, payload);
    await logActivity(env, profile, method, collection, id, payload);
    return jsonResponse({ ok: true });
  }
  if (method === "PATCH") {
    const existing = (await getDoc(env, collection, id)) || {};
    const merged = Object.assign({}, existing, payload);
    await putDoc(env, collection, id, merged);
    await logActivity(env, profile, method, collection, id, merged);
    return jsonResponse({ ok: true });
  }
  if (method === "DELETE") {
    const existing = await getDoc(env, collection, id);
    await deleteDoc(env, collection, id);
    await logActivity(env, profile, method, collection, id, existing);
    return jsonResponse({ ok: true });
  }
  return errorResponse(405, "Método no soportado.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    // url.pathname keeps percent-encoding as-is (e.g. a slugify()'d id with
    // ":" or "@" arrives as "%3A"/"%40"), so route on decoded segments
    // rather than regex-matching the raw pathname.
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

    try {
      if (segments.length === 2 && segments[0] === "api" && segments[1] === "login" && method === "POST") {
        return handleLogin(request, env);
      }
      if (segments.length === 2 && segments[0] === "api" && segments[1] === "logout" && method === "POST") {
        return handleLogoutRequest(request, env);
      }
      if (segments.length === 2 && segments[0] === "api" && segments[1] === "login-options" && method === "GET") {
        return handleLoginOptions(env);
      }
      if (segments.length === 2 && segments[0] === "api" && segments[1] === "me" && method === "GET") {
        const profile = await getProfileFromRequest(request, env);
        return profile ? jsonResponse({ profile }) : errorResponse(401, "Sin sesión.");
      }
      if (segments.length === 2 && segments[0] === "api" && segments[1] === "state" && method === "GET") {
        const profile = await getProfileFromRequest(request, env);
        if (!profile) return errorResponse(401, "No autenticado.");
        return jsonResponse(await buildState(env));
      }
      if (segments.length === 2 && segments[0] === "api" && segments[1] === "activity-log" && method === "GET") {
        return handleActivityLog(request, env);
      }
      if (segments.length === 2 && segments[0] === "api" && segments[1] === "files" && method === "POST") {
        return handleFileUpload(request, env);
      }
      if (segments.length === 2 && segments[0] === "files" && method === "GET") {
        return handleFileServe(request, env, segments[1]);
      }
      if (segments.length === 3 && segments[0] === "api" && segments[1] === "files" && method === "DELETE") {
        return handleFileDelete(request, env, segments[2]);
      }
      if (segments[0] === "api" && segments[1] === "collections" && /^[a-z_]+$/.test(segments[2] || "")) {
        const collection = segments[2];
        if (segments.length === 3 && method === "POST") return handleCollectionWrite(request, env, collection, null, "POST");
        if (segments.length === 4 && (method === "PUT" || method === "PATCH" || method === "DELETE")) {
          return handleCollectionWrite(request, env, collection, segments[3], method);
        }
      }

      return errorResponse(404, "No encontrado.");
    } catch (err) {
      console.error(err);
      return errorResponse(500, "Error interno.");
    }
  },
};
