// Nómina → Carga a proyectos: la nómina pagada de una semana se carga como
// gastos de mano de obra (SGA-Payroll) a los proyectos. Karen ajusta el
// reparto en la pestaña y aquí se crean los gastos, uno por proyecto, sin
// sueldos individuales (la descripción solo lleva los nombres).

const PRODUCCION_URL = "https://produccion.serviceranchotrailers.org";
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const r2 = (n) => Math.round(n * 100) / 100;

/** GET ?desde&hasta → horas por equipo y orden de Producción (proxy con INTEGRACION_TOKEN). */
export async function horasProduccion(env, url) {
  const desde = url.searchParams.get("desde") || "", hasta = url.searchParams.get("hasta") || "";
  if (!FECHA.test(desde) || !FECHA.test(hasta)) return { ok: false, error: "Rango de fechas inválido." };
  if (!env.INTEGRACION_TOKEN) return { ok: false, error: "Falta INTEGRACION_TOKEN." };
  try {
    const res = await fetch(`${PRODUCCION_URL}/api/integracion/horas?desde=${desde}&hasta=${hasta}`, {
      headers: { authorization: `Bearer ${env.INTEGRACION_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    });
    return (await res.json().catch(() => null)) || { ok: false, error: `Producción respondió ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/**
 * POST { semana, fecha, gastos: [{ proyecto_key, proyecto, importe, empleados: [nombre] }] }
 * Crea los gastos de la semana y borra los de una carga anterior de la misma
 * semana (así se puede rehacer). → { ok, gastos, total } o { ok:false, error }
 */
export async function cargarNomina(env, profile, b, deps) {
  if (!b || typeof b.semana !== "string" || !/^\d{4}-W\d{2}$/.test(b.semana)) return { ok: false, error: "Falta la semana." };
  if (!FECHA.test(b.fecha || "")) return { ok: false, error: "Fecha del gasto inválida." };
  const sem = await deps.getDoc(env, "nomina_semanas", b.semana);
  if (!sem || sem.estado !== "pagada") return { ok: false, error: "Solo se carga una semana ya pagada." };
  const gastos = (Array.isArray(b.gastos) ? b.gastos : [])
    .map((g) => ({
      key: String((g && g.proyecto_key) || "").trim(),
      nombre: String((g && g.proyecto) || (g && g.proyecto_key) || "").trim(),
      importe: r2(Number(g && g.importe) || 0),
      empleados: (Array.isArray(g && g.empleados) ? g.empleados : []).map((x) => String(x).trim()).filter(Boolean),
    }))
    .filter((g) => g.importe > 0);
  if (!gastos.length) return { ok: false, error: "No hay importes para cargar." };
  if (gastos.some((g) => !g.key)) return { ok: false, error: "Hay importes sin proyecto." };
  const total = r2(gastos.reduce((s, g) => s + g.importe, 0));
  if (total > (Number(sem.total) || 0) + 1) return { ok: false, error: "La carga suma más que la nómina pagada de la semana." };

  // Carga anterior de la misma semana: se reemplaza.
  const previos = (await deps.listDocs(env, "gastos_nuevos")).filter((r) => r.data && r.data.nomina_semana === b.semana);
  for (const r of previos) await deps.deleteDoc(env, "gastos_nuevos", r.id);

  const cw = "CW" + b.semana.slice(-2);
  const quien = profile.isMaster ? "Master Administrator" : profile.nombre;
  const ahora = new Date().toISOString();
  const ids = [];
  for (const g of gastos) {
    const id = deps.randomHex(16);
    await deps.putDoc(env, "gastos_nuevos", id, {
      proyecto: g.nombre, proyecto_key: g.key, fecha: b.fecha, fecha_factura: b.fecha, proveedor: "NOMINA",
      descripcion: `Nómina ${cw}: ${g.empleados.join(", ")}`.slice(0, 500), factura: null,
      importe: g.importe, cantidad: 1, categoria: "SGA-Payroll", forma_pago: "efectivo",
      capturadoPor: quien, creadoEn: ahora, _cid: deps.randomHex(7), nomina_semana: b.semana,
    });
    ids.push(id);
  }
  const prev = (await deps.getDoc(env, "nomina_cargas", b.semana)) || {};
  await deps.putDoc(env, "nomina_cargas", b.semana, Object.assign({}, prev, {
    estado: "cargada", fecha: b.fecha, total, gastoIds: ids, cargadaPor: quien, cargadaEn: ahora, totalSemana: Number(sem.total) || 0,
  }));
  await deps.logActivity(env, profile, "POST", "gastos_nuevos", b.semana, { nominaCarga: b.semana, gastos: ids.length, total, reemplazados: previos.length });
  return { ok: true, gastos: ids.length, total, reemplazados: previos.length };
}
