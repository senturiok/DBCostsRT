// HTML del Tablero de Dirección. Todo inline (con nonce de CSP); los datos se
// piden a /api/resumen y se pintan en el navegador.

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">`;

const BASE_CSS = `
:root{
  --bg:#eef1f4; --surface:#ffffff; --sunk:#e3e8ee; --ink:#18212b; --muted:#5b6876; --line:#cfd7e0;
  --accent:#d9771f; --accent-soft:#fbe8d6; --steel:#3c5a78;
  --good:#2f8a57; --warn:#b98400; --bad:#c2412d; --info:#3c6fa8; --good-bg:#e1f2e8; --warn-bg:#f8eecd; --bad-bg:#f8e0db; --info-bg:#e0eaf6;
  --display:"Barlow Condensed","Arial Narrow",sans-serif; --body:"IBM Plex Sans",system-ui,sans-serif; --mono:"IBM Plex Mono",ui-monospace,monospace;
  color-scheme:light;
}
@media (prefers-color-scheme: dark){:root{
  --bg:#12171d; --surface:#1a222b; --sunk:#222c37; --ink:#e6ebf0; --muted:#97a4b2; --line:#2f3b48;
  --accent:#f0913a; --accent-soft:#3a2a1b; --steel:#8fb0d0;
  --good:#5cc48a; --warn:#e2b23c; --bad:#ec6f5a; --info:#7fb0e6; --good-bg:#1b3327; --warn-bg:#382f15; --bad-bg:#3d211c; --info-bg:#1b2a3d; color-scheme:dark}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.5}
h1,h2,h3{font-family:var(--display);font-weight:600;letter-spacing:.01em;margin:0;line-height:1.1;text-wrap:balance}
button{font:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;

export function loginPage(nonce, error) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Dirección · Rancho Trailers</title>${FONTS}
<style nonce="${nonce}">${BASE_CSS}
body{min-height:100vh;display:grid;place-items:center;padding:24px 16px}
form{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:28px;width:100%;max-width:360px;display:grid;gap:14px}
.eyebrow{font-family:var(--mono);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
h1{font-size:32px}
label{display:grid;gap:6px;font-size:14px;color:var(--muted)}
input{font:inherit;font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
button{cursor:pointer;border:0;border-radius:8px;padding:11px;background:var(--ink);color:var(--surface);font-weight:600}
.err{color:var(--bad);font-size:14px;margin:0}
</style></head><body>
<form method="post" action="/login">
  <span class="eyebrow">Rancho Trailers</span>
  <h1>Tablero de Dirección</h1>
  <label for="password">Contraseña<input id="password" name="password" type="password" autocomplete="current-password" required autofocus></label>
  ${error ? `<p class="err">${error}</p>` : ""}
  <button type="submit">Entrar</button>
</form></body></html>`;
}

export function dashboardPage(nonce) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Dirección · Rancho Trailers</title>${FONTS}
<style nonce="${nonce}">${BASE_CSS}
[hidden]{display:none!important}
#hoy,#proy,#so{display:grid;gap:16px;align-content:start}
.flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:760px){.flow{grid-template-columns:repeat(2,minmax(0,1fr))}}
.step{display:flex;flex-direction:column;gap:2px;max-width:220px;white-space:normal}
.step .sub{overflow-wrap:anywhere}
tr.anterior td{color:var(--muted)}
.wrap{max-width:1240px;margin:0 auto;padding:20px 16px 56px;display:grid;gap:18px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
header h1{font-size:clamp(28px,4.5vw,38px)}
.eyebrow{font-family:var(--mono);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.btn{cursor:pointer;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:7px 13px;border-radius:8px;font-size:14px}
.btn.dark{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font-family:var(--mono);font-size:11px;padding:3px 8px;border-radius:999px;background:var(--good-bg);color:var(--good)}
.chip.off{background:var(--bad-bg);color:var(--bad)}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
.tabs button{cursor:pointer;background:none;border:0;padding:10px 14px;color:var(--muted);font-family:var(--display);font-size:19px;font-weight:600;border-bottom:3px solid transparent;margin-bottom:-1px;white-space:nowrap;flex:none}
@media (max-width:520px){.tabs button{font-size:16px;padding:9px 10px}}
.tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--accent)}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:980px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:520px){.tiles{grid-template-columns:1fr}}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:5px;align-content:start;min-width:0}
.tile .k{display:flex;justify-content:space-between;align-items:center;gap:8px}
.src{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--steel)}
.tile .v{font-family:var(--mono);font-size:26px;font-weight:500;font-variant-numeric:tabular-nums;line-height:1.15;overflow-wrap:anywhere}
.tile .s{font-size:13px;color:var(--muted)}
.pill{font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:999px;white-space:nowrap;background:var(--sunk);color:var(--muted)}
.pill.good{background:var(--good-bg);color:var(--good)} .pill.warn{background:var(--warn-bg);color:var(--warn)} .pill.bad{background:var(--bad-bg);color:var(--bad)} .pill.info{background:var(--info-bg);color:var(--info)}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
@media (max-width:860px){.grid2{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:10px;align-content:start;min-width:0}
.panel-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
.panel-h h3{font-size:20px}
.panel-h span{font-size:12.5px;color:var(--muted)}
.muted{color:var(--muted);font-size:13px}
.alerts{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.alerts li{display:grid;grid-template-columns:5px minmax(0,1fr);gap:10px;font-size:14px}
.alerts li::before{content:"";border-radius:3px;background:var(--muted)}
.alerts li.bad::before{background:var(--bad)} .alerts li.warn::before{background:var(--warn)} .alerts li.info::before{background:var(--info)}
.alerts .m{color:var(--muted);font-size:12.5px}
.alerts .p{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--steel)}
svg{display:block;width:100%;height:auto}
svg text{fill:var(--muted);font-family:var(--mono);font-size:10.5px}
svg .grid{stroke:var(--line)} svg .area{fill:var(--accent-soft)} svg .line{fill:none;stroke:var(--accent);stroke-width:2} svg .dot{fill:var(--accent)}
svg .bar{fill:var(--steel)} svg .bar.hi{fill:var(--accent)}
.tbl{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;font-weight:500;padding:8px 9px;background:var(--sunk);white-space:nowrap}
td{padding:8px 9px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap}
td.r,th.r{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
td .sub{display:block;color:var(--muted);font-size:12px}
.wide table{min-width:900px}
.steps{display:inline-flex;gap:2px;vertical-align:middle}
.mbars{display:flex;flex-direction:column;gap:3px}
.mbar{display:block;height:7px;border-radius:2px;min-width:2px}
.mbar.prog{background:var(--steel)} .mbar.cob{background:var(--accent)}
.steps i{width:11px;height:8px;border-radius:2px;background:var(--sunk)}
.steps i.on{background:var(--steel)} .steps i.cur{background:var(--accent)}
.filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.filters .btn{border-radius:999px;font-size:13px;padding:5px 12px}
.filters .btn[aria-pressed="true"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.state{padding:40px 16px;text-align:center;color:var(--muted)}
.foot{font-size:12.5px;color:var(--muted)}
</style></head><body>
<div class="wrap">
  <header>
    <div><div class="eyebrow" id="fecha">Rancho Trailers</div><h1>Tablero de Dirección</h1></div>
    <div class="actions">
      <div class="chips" id="fuentes"></div>
      <button class="btn" id="refresh" type="button">Actualizar</button>
      <form method="post" action="/logout"><button class="btn" type="submit">Salir</button></form>
    </div>
  </header>
  <nav class="tabs" role="tablist">
    <button role="tab" id="tab-hoy" aria-selected="true" type="button">Hoy</button>
    <button role="tab" id="tab-proy" aria-selected="false" type="button">Proyectos</button>
    <button role="tab" id="tab-so" aria-selected="false" type="button">Sales Orders</button>
    <button role="tab" id="tab-eq" aria-selected="false" type="button">Equipos</button>
  </nav>
  <main id="hoy"><div class="state">Cargando datos de los portales…</div></main>
  <main id="proy" hidden></main>
  <main id="so" hidden></main>
  <main id="eq" hidden></main>
  <p class="foot" id="foot"></p>
</div>
<script nonce="${nonce}">${CLIENT_JS}</script>
</body></html>`;
}

const CLIENT_JS = String.raw`
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n0 = (n) => Math.round(Number(n) || 0).toLocaleString("es-MX");
const usd = (n) => n == null ? "—" : "$" + n0(n);
const mxn = (n) => n == null ? "—" : "$" + n0(n);
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const fecha = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return Number(d) + " " + MESES[Number(m) - 1]; };
const mesCorto = (ym) => { const [y, m] = ym.split("-"); return MESES[Number(m) - 1] + (m === "01" ? " " + y.slice(2) : ""); };
const NOMBRES = { costeo: "Costeo", cobranza: "Cobranza", cotizaciones: "Cotizaciones", produccion: "Producción" };
const ESTADO_PROD = { atrasada: ["bad", "Atrasada"], en_riesgo: ["warn", "En riesgo"], a_tiempo: ["good", "A tiempo"], pausada: ["", "Pausada"], terminada: ["good", "Terminada"], sin_plan: ["", "Sin plan"] };
const ESTADO_COB = { al_dia: ["good", "Al día"], atrasado: ["bad", "Atrasado"], diferencia_min: ["warn", "Diferencia mínima"], liquidado: ["good", "Liquidado"], confirmar: ["info", "Por confirmar"] };
const pill = (cls, txt) => '<span class="pill ' + cls + '">' + esc(txt) + "</span>";
const noData = (p) => '<div class="panel"><p class="muted">No llegaron datos de ' + NOMBRES[p] + ". Revisa el estado arriba.</p></div>";

let DATA = null;
let filtro = "all";

function lineChart(points, fmt) {
  if (!points.length) return '<p class="muted">Sin datos.</p>';
  const W = 560, H = 180, pl = 46, pr = 26, pt = 12, pb = 24;
  const top = Math.max(...points.map((p) => p.v), 1);
  const step = Math.pow(10, Math.floor(Math.log10(top)));
  const max = Math.ceil(top / step) * step;
  const x = (i) => pl + (points.length === 1 ? 0 : (i * (W - pl - pr)) / (points.length - 1));
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img">';
  for (let k = 0; k <= 2; k++) { const v = (max / 2) * k; s += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (pl - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + fmt(v) + "</text>"; }
  const pts = points.map((p, i) => x(i) + "," + y(p.v)).join(" ");
  s += '<polygon class="area" points="' + x(0) + "," + y(0) + " " + pts + " " + x(points.length - 1) + "," + y(0) + '"/>';
  s += '<polyline class="line" points="' + pts + '"/>';
  const every = Math.ceil(points.length / 7);
  points.forEach((p, i) => { if (i % every === 0 || i === points.length - 1) s += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(p.l) + "</text>"; });
  const li = points.length - 1;
  s += '<circle class="dot" cx="' + x(li) + '" cy="' + y(points[li].v) + '" r="4"/>';
  return s + "</svg>";
}

function barChart(rows, fmt) {
  const W = 560, rowH = 26, lw = 150, H = rows.length * rowH + 4;
  const max = Math.max(...rows.map((r) => r.v), 1);
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img">';
  rows.forEach((r, i) => {
    const w = Math.max(2, ((W - lw - 70) * r.v) / max), yy = i * rowH + 4;
    s += '<text x="' + (lw - 8) + '" y="' + (yy + 13) + '" text-anchor="end">' + esc(r.l) + '</text><rect class="bar' + (r.hi ? " hi" : "") + '" x="' + lw + '" y="' + (yy + 3) + '" width="' + w + '" height="14" rx="2"/><text x="' + (lw + w + 6) + '" y="' + (yy + 14) + '">' + fmt(r.v) + "</text>";
  });
  return s + "</svg>";
}

const short = (v) => v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : v >= 1e3 ? Math.round(v / 1e3) + "k" : String(Math.round(v));

function steps(o) {
  if (!o || !DATA.produccion) return '<span class="muted">—</span>';
  const lv = DATA.produccion.niveles.map((l) => l.code);
  const idx = lv.indexOf(o.nivel);
  const done = o.estado === "terminada";
  return '<span class="steps" title="' + esc(o.nivel + " " + (o.nivelNombre || "")) + '">' + lv.map((_, i) => '<i class="' + (done || i < idx ? "on" : i === idx ? "cur" : "") + '"></i>').join("") + '</span> <span class="num">' + esc(o.nivel || "") + "</span>";
}

const MES_LARGO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const mesLargo = (ym) => { const [y, m] = ym.split("-"); return MES_LARGO[Number(m) - 1] + " " + y; };
const TIPO_MES = { historico: ["", "Histórico"], actual: ["info", "Mes actual"], proyeccion: ["warn", "Proyección"] };
// Cobranza por mes: lo programado (cuotas del mes) contra lo cobrado de esas cuotas (eficiencia); el actual y los 2 siguientes como proyección.
function cobranzaMeses(meses) {
  const top = Math.max(1, ...meses.map((m) => Math.max(m.programado || 0, m.cobrado || 0)));
  const bar = (v, cls) => '<span class="mbar ' + cls + '" style="width:' + Math.max(0, Math.min(100, (v || 0) / top * 100)).toFixed(1) + '%"></span>';
  const proy = meses.filter((m) => m.tipo !== "historico").reduce((s, m) => s + (m.programado || 0), 0);
  let h = '<div class="panel"><div class="panel-h"><h3>Cobranza por mes</h3><span>USD · 3 meses de histórico, el actual y 2 de proyección</span></div>';
  h += '<div class="tbl"><table><thead><tr><th>Mes</th><th></th><th class="r">Programado</th><th class="r">Cobrado del mes</th><th class="r">Eficiencia</th><th style="min-width:160px"></th><th>Notas</th></tr></thead><tbody>';
  h += meses.map((m) => {
    const t = TIPO_MES[m.tipo] || ["", m.tipo];
    const notas = [];
    if (m.tipo === "actual") notas.push("faltan " + usd(m.pendiente));
    if (m.nuevos) notas.push("+" + usd(m.nuevos) + " de clientes por entregar");
    if (m.clientes) notas.push(m.clientes + " clientes");
    return "<tr" + (m.tipo === "actual" ? ' style="font-weight:600"' : "") + "><td>" + esc(mesLargo(m.mes)) + "</td><td>" + pill(t[0], t[1]) + '</td><td class="r">' + usd(m.programado) + '</td><td class="r">' + (m.cobrado == null ? "—" : usd(m.cobrado)) + '</td><td class="r">' + (m.porcentaje == null ? "—" : m.porcentaje + "%") + '</td><td><div class="mbars">' + bar(m.programado, "prog") + (m.cobrado == null ? "" : bar(m.cobrado, "cob")) + '</div></td><td class="muted">' + esc(notas.join(" · ")) + "</td></tr>";
  }).join("");
  h += '</tbody></table></div><p class="muted">Programado = las cuotas que tocan en el mes según cada contrato (respeta liquidaciones y pausas). Cobrado del mes = solo lo que cada cliente pagó para su cuota de ese mes; los pagos de más (adelantos, liquidaciones o atrasos de otros meses) no cuentan. Eficiencia = cobrado del mes ÷ programado. Proyección de este mes y los 2 siguientes: ' + usd(proy) + ' USD.</p></div>';
  return h;
}

// Propuesta de pago a proveedores de los próximos 4 viernes (MXN), del Portal de Compras.
function propuestasViernes(list) {
  if (!list || !list.length) return "";
  const total = list.reduce((t, p) => t + (p.total || 0), 0);
  return '<div class="panel-h" style="margin-top:14px"><h3>Propuestas de pago</h3><span>MXN · próximos 4 viernes</span></div>' +
    '<div class="tbl"><table><thead><tr><th>Viernes</th><th class="r">Propuesta</th><th class="r">Facturas</th><th>Notas</th></tr></thead><tbody>' +
    list.map((p, i) => {
      const notas = [];
      if (p.atrasadas) notas.push(p.atrasadas + " vencida" + (p.atrasadas > 1 ? "s" : ""));
      if (p.porVerificarN) notas.push("+" + mxn(p.porVerificar) + " por verificar (" + p.porVerificarN + ")");
      return "<tr" + (i === 0 ? ' style="font-weight:600"' : "") + "><td>" + esc(diaLargo(p.viernes)) + '</td><td class="r">' + mxn(p.total) + '</td><td class="r">' + p.facturas + '</td><td class="muted">' + esc(notas.join(" · ")) + "</td></tr>";
    }).join("") +
    '</tbody></table></div><p class="muted">Facturas a crédito ya verificadas, en el viernes en que se pagan según los días de crédito del proveedor; el primer viernes incluye lo vencido. Total 4 viernes: ' + mxn(total) + " MXN.</p>";
}

function renderHoy() {
  const d = DATA, cob = d.cobranza, pr = d.produccion, cot = d.cotizaciones, cos = d.costeo;
  let h = '<div class="tiles">';
  h += cob ? '<div class="tile"><div class="k"><span class="src">Cobranza</span>' + pill(cob.atrasados ? "bad" : "good", cob.atrasados + (cob.atrasados === 1 ? " atrasado" : " atrasados")) + '</div><div class="v">' + usd(cob.vencido) + '</div><div class="s">USD vencido · este mes cobrado ' + usd(cob.mes.cobrado) + " de " + usd(cob.mes.programado) + (cob.mes.pct != null ? " (" + cob.mes.pct + "%)" : "") + "</div></div>" : '<div class="tile"><span class="src">Cobranza</span><div class="s">Sin datos</div></div>';
  h += pr ? '<div class="tile"><div class="k"><span class="src">Producción</span>' + pill(pr.atrasadas ? "bad" : pr.enRiesgo ? "warn" : "good", pr.atrasadas + " atrasadas · " + pr.enRiesgo + " en riesgo") + '</div><div class="v">' + pr.activas + ' órdenes</div><div class="s">en piso · ' + pr.terminadasMes + " terminadas este mes" + (pr.pausadas ? " · " + pr.pausadas + " pausadas" : "") + "</div></div>" : '<div class="tile"><span class="src">Producción</span><div class="s">Sin datos</div></div>';
  h += cot ? '<div class="tile"><div class="k"><span class="src">Cotizaciones</span>' + pill("good", cot.ganadas90 + " ganadas 90 días") + '</div><div class="v">' + usd(cot.valorAbierto) + '</div><div class="s">USD en ' + cot.abiertas + " cotizaciones enviadas sin cerrar" + (cot.cierre90 != null ? " · cierre " + cot.cierre90 + "%" : "") + "</div></div>" : '<div class="tile"><span class="src">Cotizaciones</span><div class="s">Sin datos</div></div>';
  h += cos ? '<div class="tile"><div class="k"><span class="src">Costeo</span>' + pill(cos.propuesta.atrasadas ? "warn" : "", "pago " + fecha(cos.propuesta.viernes)) + '</div><div class="v">' + mxn(cos.mesActual.mxn) + '</div><div class="s">MXN gastado en ' + mesCorto(cos.mesActual.mes) + " · propuesta del viernes " + mxn(cos.propuesta.total) + " MXN (" + cos.propuesta.facturas + " facturas)</div></div>" : '<div class="tile"><span class="src">Costeo</span><div class="s">Sin datos</div></div>';
  h += "</div>";

  h += '<div class="grid2">';
  h += '<div class="panel"><div class="panel-h"><h3>Requiere tu atención</h3><span>' + d.alertas.length + " pendientes</span></div>";
  h += d.alertas.length ? '<ul class="alerts">' + d.alertas.map((a) => '<li class="' + a.nivel + '"><div><span class="p">' + esc(a.portal) + "</span><br><b>" + esc(a.titulo) + '</b><div class="m">' + esc(a.detalle) + "</div></div></li>").join("") + "</ul>" : '<p class="muted">Nada urgente. Todo en orden.</p>';
  h += "</div>";
  h += cos ? '<div class="panel"><div class="panel-h"><h3>Gasto mensual en taller</h3><span>MXN · México</span></div>' + lineChart(cos.gastoPorMes.map((m) => ({ l: mesCorto(m.mes), v: m.mxn })), short) + '<p class="muted">El último punto es el mes en curso. Gasto de los últimos 14 días: ' + mxn(cos.gasto14Mxn) + " MXN.</p>" + propuestasViernes(cos.propuestas) + "</div>" : noData("costeo");
  h += "</div>";

  h += '<div class="grid2">';
  if (pr) {
    const foco = pr.ordenes.filter((o) => o.estado !== "terminada").sort((a, b) => (a.entrega || "9").localeCompare(b.entrega || "9"));
    h += '<div class="panel"><div class="panel-h"><h3>Producción por nivel</h3><span>' + pr.activas + " activas</span></div>" + barChart(pr.porNivel.map((l) => ({ l: l.code + " " + l.name, v: l.n })), String);
    h += '<div class="tbl"><table><thead><tr><th>Orden</th><th>Nivel</th><th class="r">Avance</th><th>Entrega</th><th>Estado</th></tr></thead><tbody>' + foco.slice(0, 12).map((o) => { const e = ESTADO_PROD[o.estado] || ["", o.estado]; return "<tr><td><b>" + esc(o.nombre) + '</b><span class="sub">' + esc(o.modelo || "") + "</span></td><td>" + steps(o) + '</td><td class="r">' + (o.avance == null ? "—" : Math.round(o.avance) + "%") + "</td><td>" + fecha(o.entrega) + (o.estimada && o.estimada !== o.entrega ? '<span class="sub">est. ' + fecha(o.estimada) + "</span>" : "") + "</td><td>" + pill(e[0], e[1]) + "</td></tr>"; }).join("") + "</tbody></table></div></div>";
  } else h += noData("produccion");
  if (cob) {
    h += '<div class="panel"><div class="panel-h"><h3>A quién cobrar</h3><span>' + cob.atrasados + (cob.atrasados === 1 ? " atrasado" : " atrasados") + " · cartera " + usd(cob.cartera) + " USD</span></div>";
    h += cob.contactar.length ? '<div class="tbl"><table><thead><tr><th>Cliente</th><th class="r">Vencido</th><th class="r">Días</th><th>Último contacto</th></tr></thead><tbody>' + cob.contactar.map((c) => "<tr><td><b>" + esc(c.negocio || c.cliente) + '</b><span class="sub">' + esc([c.cliente !== c.negocio ? c.cliente : "", c.traila].filter(Boolean).join(" · ")) + '</span></td><td class="r">' + usd(c.vencido) + '</td><td class="r">' + c.diasAtraso + "</td><td>" + (c.ultimoContacto ? fecha(c.ultimoContacto) + '<span class="sub">' + esc(c.resultado || "") + "</span>" : '<span class="pill bad">Sin contacto</span>') + "</td></tr>").join("") + "</tbody></table></div>" : '<p class="muted">Nadie atrasado.</p>';
    h += '<div class="panel-h"><h3>Cobrado por semana</h3><span>USD · últimas 8 semanas</span></div>' + lineChart(cob.cobradoPorSemana.map((w) => ({ l: fecha(w.desde), v: w.monto })), short) + "</div>";
  } else h += noData("cobranza");
  h += "</div>";

  if (cob && cob.meses && cob.meses.length) h += cobranzaMeses(cob.meses);

  if (cot) {
    h += '<div class="grid2"><div class="panel"><div class="panel-h"><h3>Cotizaciones abiertas</h3><span>enviadas, sin ganar ni perder</span></div>';
    h += cot.abiertasLista.length ? '<div class="tbl"><table><thead><tr><th>Cliente</th><th>Remolque</th><th>Vendedor</th><th>Fecha</th><th class="r">Total USD</th></tr></thead><tbody>' + cot.abiertasLista.map((q) => "<tr><td><b>" + esc(q.negocio || q.cliente) + '</b><span class="sub">' + esc(q.negocio ? q.cliente : "") + "</span></td><td>" + esc(q.tamano + " " + q.tipo) + "</td><td>" + esc(q.vendedor) + "</td><td>" + fecha(q.fecha) + '</td><td class="r">' + usd(q.total) + "</td></tr>").join("") + "</tbody></table></div>" : '<p class="muted">No hay cotizaciones abiertas.</p>';
    h += '</div><div class="panel"><div class="panel-h"><h3>Vendedores</h3><span>últimos 90 días</span></div>';
    h += cot.vendedores.length ? '<div class="tbl"><table><thead><tr><th>Vendedor</th><th class="r">Enviadas</th><th class="r">Ganadas</th><th class="r">Vendido USD</th></tr></thead><tbody>' + cot.vendedores.map((v) => "<tr><td><b>" + esc(v.vendedor) + '</b></td><td class="r">' + v.enviadas + '</td><td class="r">' + v.ganadas + '</td><td class="r">' + usd(v.valorGanado) + "</td></tr>").join("") + "</tbody></table></div>" : '<p class="muted">Sin actividad.</p>';
    h += '<p class="muted">Ticket promedio ganado: ' + usd(cot.ticket) + " USD · " + cot.perdidas90 + " perdidas en 90 días.</p></div></div>";
  }
  $("hoy").innerHTML = h;
}

function margenDe(p) {
  const c = p.costeo;
  if (c && c.margenPct != null) return c.margenPct;
  const venta = (c && c.ventaUsd) || (p.venta && p.venta.total);
  if (venta && c && c.totalUsd) return ((venta - c.totalUsd) / venta) * 100;
  return null;
}
function conAlerta(p) {
  const m = margenDe(p);
  return (p.produccion && ["atrasada", "en_riesgo"].includes(p.produccion.estado)) || (p.cobranza && p.cobranza.estado === "atrasado") || (m != null && m < 15);
}

function renderProy() {
  const rows = DATA.proyectos.filter((p) => filtro === "all" || (filtro === "risk" && conAlerta(p)) || (filtro === "prod" && p.produccion && p.produccion.estado !== "terminada"));
  let h = '<div class="panel"><div class="panel-h"><h3>Cada remolque en todos los portales</h3><span>' + rows.length + " proyectos</span></div>";
  h += '<div class="filters" role="group"><button class="btn" type="button" data-f="all" aria-pressed="' + (filtro === "all") + '">Todos</button><button class="btn" type="button" data-f="risk" aria-pressed="' + (filtro === "risk") + '">Con alerta</button><button class="btn" type="button" data-f="prod" aria-pressed="' + (filtro === "prod") + '">En producción</button></div>';
  h += '<div class="tbl wide"><table><thead><tr><th>Proyecto</th><th>Nivel</th><th>Entrega</th><th class="r">Costo MXN</th><th class="r">Costo total USD</th><th class="r">Venta USD</th><th class="r">Margen</th><th>Cobranza</th></tr></thead><tbody>';
  h += rows.map((p) => {
    const c = p.costeo, o = p.produccion, cb = p.cobranza;
    const venta = (c && c.ventaUsd) || (p.venta && p.venta.total) || null;
    const m = margenDe(p);
    const e = o ? ESTADO_PROD[o.estado] || ["", o.estado] : null;
    const ce = cb ? ESTADO_COB[cb.estado] || ["", cb.estado] : null;
    return "<tr><td><b>" + esc(p.nombre) + '</b><span class="sub">' + esc([c ? c.estado : "", p.venta ? p.venta.vendedor : ""].filter(Boolean).join(" · ")) + "</span></td><td>" + steps(o) + "</td><td>" + (o ? (o.estado === "terminada" ? "Terminada " + fecha(o.terminada) : fecha(o.entrega)) + (e && o.estado !== "terminada" ? " " + pill(e[0], e[1]) : "") : "—") + '</td><td class="r">' + (c ? mxn(c.mxn) : "—") + '</td><td class="r">' + (c && c.totalUsd != null ? usd(c.totalUsd) : "—") + '</td><td class="r">' + (venta ? usd(venta) : "—") + '</td><td class="r">' + (m == null ? "—" : pill(m < 5 ? "bad" : m < 15 ? "warn" : "good", Math.round(m) + "%")) + "</td><td>" + (ce ? pill(ce[0], ce[1] + (cb.diasAtraso ? " · " + cb.diasAtraso + " d" : "")) : '<span class="muted">—</span>') + "</td></tr>";
  }).join("");
  h += '</tbody></table></div><p class="muted">Los portales se ligan por nombre del proyecto. Si un remolque se llama distinto en un portal, sus datos de ese portal salen con guion.</p></div>';
  $("proy").innerHTML = h;
  document.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { filtro = b.dataset.f; renderProy(); }));
}

const ESTADO_SO = { error: ["bad", "Con error"], por_enviar: ["warn", "Sin enviar"], no_ganada: ["", "Cotización no ganada"], enviada: ["good", "Enviada"], anterior: ["", "Capturada antes"] };
const ACCION_COMPRAS = { crear: "creado", ligar: "ligado", existe: "ya ligado" };

function paso(k, r, so) {
  if (so.estado === "anterior") return '<span class="muted">—</span>';
  const sinCobranza = (motivo) => pill("", motivo === "financiera_externa" ? "Financiera externa" : "Contado");
  if (k === "cobranza" && so.tipoCobranza !== "si" && (!r || r.omitido)) return sinCobranza(so.tipoCobranza);
  if (!r) return so.estado === "por_enviar" ? pill("warn", "Pendiente") : '<span class="muted">—</span>';
  if (!r.ok) return '<span class="step">' + pill("bad", "Error") + '<span class="sub">' + esc(r.error) + "</span></span>";
  if (r.omitido) return sinCobranza(r.motivo);
  const txt = k === "produccion" ? (r.accion === "existe" ? "Ya existía" : "Orden creada") : k === "compras" ? "Proyecto " + (ACCION_COMPRAS[r.accion] || "listo") : r.accion === "existe" ? "Ya existía" : "Contrato creado";
  return '<span class="step">' + pill("good", txt) + (r.nombre ? '<span class="sub">' + esc(r.nombre) + "</span>" : "") + "</span>";
}

function renderSo() {
  const s = DATA.salesOrders;
  if (!s) { $("so").innerHTML = noData("cotizaciones"); return; }
  const tile = (cls, n, label, sub) => '<div class="tile"><div class="k"><span class="src">' + label + "</span>" + (n && cls ? pill(cls, cls === "good" ? "listo" : "revisar") : "") + '</div><div class="v">' + n + '</div><div class="s">' + sub + "</div></div>";
  let h = '<div class="flow">' +
    tile("warn", s.porEnviar, "Sin enviar", "Ganadas con Sales Order que no se han mandado a producción") +
    tile("bad", s.conError, "Con error", "Algún portal rechazó el envío; reintentar en Cotizaciones") +
    tile("good", s.enviadas, "Enviadas", "Orden, proyecto y (si es financiada) contrato creados") +
    tile("", s.anteriores, "Capturadas antes", "Se quedaron como estaban antes del envío automático") + "</div>";
  h += '<div class="panel"><div class="panel-h"><h3>Cotización → Producción → Compras → Cobranza</h3><span>' + s.lista.length + " Sales Orders</span></div>";
  h += s.lista.length ? '<div class="tbl wide"><table><thead><tr><th>Sales Order</th><th>Estado</th><th>Entrega</th><th class="r">Venta USD</th><th>Producción</th><th>Compras</th><th>Cobranza</th><th>Enviada</th></tr></thead><tbody>' + s.lista.map((x) => {
    const e = ESTADO_SO[x.estado] || ["", x.estado];
    return '<tr class="' + (x.estado === "anterior" ? "anterior" : "") + '"><td><b>' + esc(x.proyecto) + '</b><span class="sub">' + esc([x.folio, x.vendedor, x.tipoCobranza === "financiera_externa" ? "financiada por el socio" : x.financiado ? "financiada" : "contado"].filter(Boolean).join(" · ")) + "</span></td><td>" + pill(e[0], e[1]) + "</td><td>" + fecha(x.entrega) + '</td><td class="r">' + usd(x.total) + "</td><td>" + paso("produccion", x.produccion, x) + "</td><td>" + paso("compras", x.compras, x) + "</td><td>" + paso("cobranza", x.cobranza, x) + "</td><td>" + (x.enviada ? fecha(x.enviada) : "—") + "</td></tr>";
  }).join("") + "</tbody></table></div>" : '<p class="muted">Todavía no hay Sales Orders.</p>';
  h += '<p class="muted">Las Sales Orders se mandan desde Cotizaciones con "Send to production" (solo el administrador). Reenviar solo reintenta lo que falló.</p></div>';
  $("so").innerHTML = h;
}

const DIAS = ["dom","lun","mar","mié","jue","vie","sáb"];
const diaLargo = (iso) => DIAS[new Date(iso + "T12:00:00Z").getUTCDay()] + " " + fecha(iso);
const h1 = (n) => n == null ? "—" : (Math.round(n * 10) / 10).toLocaleString("es-MX");
const cumplePill = (pct) => pct == null ? pill("", "sin plan") : pill(pct >= 90 ? "good" : pct >= 60 ? "warn" : "bad", pct + "% del plan");

function renderEq() {
  const e = DATA.equipos;
  if (!e) { $("eq").innerHTML = '<div class="panel"><p class="muted">No llegaron los datos de equipos de Producción' + (DATA.fuentes.equipos && DATA.fuentes.equipos.error ? " (" + esc(DATA.fuentes.equipos.error) + ")" : "") + ".</p></div>"; return; }
  const t = e.totales;
  const rango = e.desde === e.hasta ? diaLargo(e.desde) : diaLargo(e.desde) + " a " + diaLargo(e.hasta);
  let h = '<div class="tiles">';
  h += '<div class="tile"><div class="k"><span class="src">Horas hechas</span>' + cumplePill(t.cumplimiento) + '</div><div class="v">' + h1(t.horasHechas) + ' h</div><div class="s">de ' + h1(t.horasPlan) + " h que tenía el plan · " + esc(rango) + "</div></div>";
  h += '<div class="tile"><div class="k"><span class="src">Tareas avanzadas</span></div><div class="v">' + t.tareas + '</div><div class="s">' + t.terminadas + " terminadas</div></div>";
  h += '<div class="tile"><div class="k"><span class="src">Sin captura</span>' + pill(t.sinCaptura.length ? "warn" : "good", t.sinCaptura.length ? t.sinCaptura.length + " equipos" : "todos capturaron") + '</div><div class="v">' + t.sinCaptura.length + '</div><div class="s">' + (t.sinCaptura.length ? esc(t.sinCaptura.join(", ")) : "Todos los equipos registraron avance") + "</div></div>";
  h += "</div>";
  h += '<div class="panel"><div class="panel-h"><h3>Por equipo</h3><span>' + esc(rango) + ' · horas del equipo, igual que Capacidad → Real</span></div><div class="tbl"><table><thead><tr><th>Equipo</th><th class="r">Plan</th><th class="r">Hecho</th><th class="r">Fuera de plan</th><th>Cumplimiento</th><th class="r">Terminadas</th></tr></thead><tbody>';
  h += e.equipos.map((q) => "<tr><td><b>" + esc(q.equipo) + "</b>" + (q.activo ? "" : '<span class="sub">inactivo</span>') + '</td><td class="r">' + h1(q.horasPlan) + '</td><td class="r">' + h1(q.horasHechas) + '</td><td class="r">' + (q.horasFueraPlan ? h1(q.horasFueraPlan) : "—") + "</td><td>" + (q.tareas.length || q.horasHechas ? cumplePill(q.cumplimiento) : pill("bad", "sin captura")) + '</td><td class="r">' + q.terminadas + "</td></tr>").join("");
  h += "</tbody></table></div></div>";
  const conTareas = e.equipos.filter((q) => q.tareas.length);
  if (conTareas.length) {
    h += '<div class="grid2">' + conTareas.map((q) => '<div class="panel"><div class="panel-h"><h3>' + esc(q.equipo) + "</h3><span>" + h1(q.horasHechas) + " h · " + q.tareas.length + " tarea" + (q.tareas.length > 1 ? "s" : "") + '</span></div><div class="tbl"><table><thead><tr>' + (e.dias.length > 1 ? "<th>Día</th>" : "") + '<th>Orden</th><th>Tarea</th><th class="r">Avance</th></tr></thead><tbody>' +
      q.tareas.map((x) => "<tr>" + (e.dias.length > 1 ? "<td>" + esc(diaLargo(x.dia)) + "</td>" : "") + "<td><b>" + esc(x.orden) + "</b></td><td>" + esc((x.n ? x.n + " " : "") + x.tarea) + (x.fueraDePlan ? ' <span class="pill info">fuera de plan</span>' : "") + '</td><td class="r">' + (x.avanceDia != null ? "+" + x.avanceDia + "% → " : "") + x.avanceTotal + "%" + (x.avanceTotal >= 100 ? " ✓" : "") + "</td></tr>").join("") +
      "</tbody></table></div></div>").join("") + "</div>";
  }
  $("eq").innerHTML = h;
}

function render() {
  const f = DATA.fuentes;
  $("fuentes").innerHTML = Object.keys(NOMBRES).map((k) => '<span class="chip' + (f[k] && f[k].ok ? "" : " off") + '" title="' + esc(f[k] && f[k].error ? f[k].error : "Conectado") + '">' + NOMBRES[k] + (f[k] && f[k].ok ? "" : " sin datos") + "</span>").join("");
  const [y, m, dd] = DATA.hoy.split("-");
  $("fecha").textContent = "Rancho Trailers · " + Number(dd) + " " + MESES[Number(m) - 1] + " " + y;
  $("foot").textContent = "Actualizado " + new Date(DATA.generado).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + ". Solo lectura: este tablero no modifica nada en los portales.";
  // Cada pestaña por separado: si una falla con datos incompletos, las demás se ven.
  for (const [id, fn] of [["hoy", renderHoy], ["proy", renderProy], ["so", renderSo], ["eq", renderEq]]) {
    try { fn(); } catch (e) { $(id).innerHTML = '<div class="state">No se pudo mostrar esta sección: ' + esc(e.message) + "</div>"; }
  }
}

async function load() {
  $("refresh").disabled = true;
  try {
    const res = await fetch("/api/resumen", { cache: "no-store" });
    if (res.status === 401) { location.href = "/login"; return; }
    if (!res.ok) throw new Error("El servidor respondió " + res.status);
    DATA = await res.json();
    render();
  } catch (e) {
    if (!DATA) $("hoy").innerHTML = '<div class="state">No se pudieron cargar los datos: ' + esc(e.message) + ". Presiona Actualizar.</div>";
  } finally {
    $("refresh").disabled = false;
  }
}

function tab(which) {
  for (const t of ["hoy", "proy", "so", "eq"]) {
    $("tab-" + t).setAttribute("aria-selected", t === which);
    $(t).hidden = t !== which;
  }
}
for (const t of ["hoy", "proy", "so", "eq"]) $("tab-" + t).addEventListener("click", () => tab(t));
$("refresh").addEventListener("click", load);
load();
setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
`;
