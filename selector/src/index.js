const PAGE = `<!DOCTYPE html>
<meta charset="UTF-8">
<title>Rancho Trailers — Portales</title>
<style>
  :root{
    --bg:#000000; --surface:#161616; --surface-2:#1e1e1e; --ink:#f4f4f4; --ink-2:#9a9a9a;
    --line:rgba(255,255,255,.08); --accent:#c8501e; --accent-2:#e97b46; --accent-ink:#ffffff;
    --font-display:"Oswald",system-ui,"Segoe UI",sans-serif;
    --font-body:"IBM Plex Sans",system-ui,"Segoe UI",sans-serif;
  }
  *{box-sizing:border-box}
  body{
    margin:0; min-height:100vh; display:flex; justify-content:center;
    background:
      radial-gradient(720px 420px at 50% -10%, rgba(200,80,30,.16), transparent),
      var(--bg);
    color:var(--ink); font-family:var(--font-body); padding:24px;
  }
  .wrap{width:100%; max-width:1320px; text-align:center;}
  .logo{ width:100%; max-width:420px; height:auto; margin:0 auto 20px; display:block; }
  p.sub{color:var(--ink-2); font-size:14px; margin:0 0 36px; letter-spacing:.01em;}
  .cards{display:grid; grid-template-columns:repeat(4, 1fr); gap:20px;}
  @media (max-width:1040px){ .cards{grid-template-columns:1fr 1fr;} }
  @media (max-width:560px){ .cards{grid-template-columns:1fr;} }
  a.card{
    position:relative; display:flex; flex-direction:column; align-items:flex-start; text-align:left;
    background:linear-gradient(160deg, var(--surface-2), var(--surface) 60%);
    border:1px solid var(--line); border-radius:16px;
    padding:30px 26px 26px; text-decoration:none; color:var(--ink); overflow:hidden;
    box-shadow:0 1px 2px rgba(0,0,0,.5), 0 14px 30px -16px rgba(0,0,0,.8);
    transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
  }
  a.card:hover{
    transform:translateY(-5px);
    border-color:rgba(233,123,70,.55);
    box-shadow:0 1px 2px rgba(0,0,0,.5), 0 20px 40px -14px rgba(200,80,30,.35);
  }
  .card-icon{
    width:46px; height:46px; border-radius:12px; margin-bottom:18px;
    display:flex; align-items:center; justify-content:center; flex:none;
    background:linear-gradient(150deg, var(--accent-2), var(--accent));
    color:var(--accent-ink); box-shadow:0 6px 16px -6px rgba(200,80,30,.6);
  }
  .card-title{
    font-family:var(--font-display); text-transform:uppercase; letter-spacing:.02em;
    font-size:17px; margin:0 0 8px;
  }
  .card-desc{color:var(--ink-2); font-size:12.5px; line-height:1.5; margin:0 0 20px;}
  .card-cta{
    margin-top:auto; display:inline-flex; align-items:center; gap:6px;
    font-size:12px; font-weight:600; letter-spacing:.03em; text-transform:uppercase;
    color:var(--accent-2);
  }
  .card-cta svg{ transition:transform .18s ease; }
  a.card:hover .card-cta svg{ transform:translateX(4px); }

  /* Tablero de producción (datos de produccion.serviceranchotrailers.org) */
  .dash{margin-top:48px; text-align:left;}
  .dash-head{display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:16px;}
  .dash h2{font-family:var(--font-display); text-transform:uppercase; letter-spacing:.02em; font-size:20px; margin:0;}
  .dash-meta{color:var(--ink-2); font-size:12px;}
  .kpis{display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:16px;}
  @media (max-width:560px){ .kpis{grid-template-columns:1fr;} }
  .kpi{background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:14px 16px;}
  .kpi-label{color:var(--ink-2); font-size:12px; margin:0 0 4px;}
  .kpi-value{font-family:var(--font-display); font-size:28px; margin:0; font-variant-numeric:tabular-nums;}
  .table-wrap{background:var(--surface); border:1px solid var(--line); border-radius:16px; overflow-x:auto;}
  table{width:100%; min-width:720px; border-collapse:collapse; font-size:13.5px;}
  th{color:var(--ink-2); font-weight:500; font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; text-align:left; padding:12px 16px; border-bottom:1px solid var(--line);}
  td{padding:12px 16px; border-bottom:1px solid var(--line); vertical-align:middle;}
  tr:last-child td{border-bottom:0;}
  tbody tr:hover td{background:var(--surface-2);}
  .o-name{font-weight:600;}
  .o-model{color:var(--ink-2); font-size:12px;}
  .lvl{display:flex; align-items:center; gap:10px;}
  .lvl-steps{display:flex; gap:2px;}
  .lvl-steps span{width:10px; height:6px; border-radius:2px; background:#2e2e2e;}
  .lvl-steps span.on{background:var(--accent-2);}
  .lvl-text{white-space:nowrap;}
  .lvl-code{color:var(--ink-2); font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:12px; margin-right:4px;}
  .bar{display:flex; align-items:center; gap:10px; min-width:160px;}
  .bar-track{flex:1; height:8px; border-radius:4px; background:#2e2e2e; overflow:hidden;}
  .bar-fill{height:100%; border-radius:4px; background:var(--accent-2);}
  .bar-pct{width:40px; text-align:right; font-variant-numeric:tabular-nums;}
  .due{white-space:nowrap;}
  .chip{display:inline-flex; align-items:center; gap:4px; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:11.5px; font-weight:600;}
  .chip.late{background:rgba(229,72,77,.16); color:#ff8589;}
  .chip.soon{background:rgba(245,166,35,.16); color:#ffc56b;}
  .chip.paused{background:rgba(154,154,154,.16); color:var(--ink-2);}
  .dash-msg{color:var(--ink-2); font-size:13px; padding:24px 16px; text-align:center;}
  /* En teléfono cada orden es una tarjeta: nombre, nivel, avance y entrega uno bajo otro. */
  @media (max-width:640px){
    table{min-width:0;}
    thead{display:none;}
    table, tbody, tr, td{display:block;}
    tbody tr{padding:14px 16px; border-bottom:1px solid var(--line);}
    tbody tr:last-child{border-bottom:0;}
    td{padding:4px 0; border-bottom:0;}
    tbody tr:hover td{background:transparent;}
    .due{white-space:normal;}
  }
</style>
<div class="wrap">
  <img class="logo" src="/logo.webp" alt="Rancho Trailers">
  <p class="sub">Selecciona el portal al que quieres entrar.</p>
  <div class="cards">
    <a class="card" href="https://dbcosteo.serviceranchotrailers.org">
      <div class="card-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      </div>
      <div class="card-title">Portal Compras</div>
      <p class="card-desc">Facturas, gastos y costeo por remolque.</p>
      <span class="card-cta">Entrar <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
    </a>
    <a class="card" href="https://pcot.serviceranchotrailers.org">
      <div class="card-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div class="card-title">Portal de Cotizaciones</div>
      <p class="card-desc">pcot.serviceranchotrailers.org</p>
      <span class="card-cta">Entrar <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
    </a>
    <a class="card" href="https://pcobranza.serviceranchotrailers.org">
      <div class="card-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2 0 0 0-2.5-1.5c-1.66 0-3 .9-3 2s1.34 2 3 2 3 .9 3 2-1.34 2-3 2a2.5 2 0 0 1-2.5-1.5"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>
      </div>
      <div class="card-title">Portal de Cobranza</div>
      <p class="card-desc">pcobranza.serviceranchotrailers.org</p>
      <span class="card-cta">Entrar <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
    </a>
    <a class="card" href="https://produccion.serviceranchotrailers.org">
      <div class="card-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M4 20V10l6 4v-4l6 4v-4l4 3v7"/></svg>
      </div>
      <div class="card-title">Portal de Producción</div>
      <p class="card-desc">produccion.serviceranchotrailers.org</p>
      <span class="card-cta">Entrar <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
    </a>
  </div>

  <section class="dash" aria-labelledby="dash-title">
    <div class="dash-head">
      <h2 id="dash-title">Producción en curso</h2>
      <span class="dash-meta" id="dash-updated">Cargando…</span>
    </div>
    <div class="kpis">
      <div class="kpi"><p class="kpi-label">Órdenes en curso</p><p class="kpi-value" id="kpi-total">—</p></div>
      <div class="kpi"><p class="kpi-label">Entregas en los próximos 7 días</p><p class="kpi-value" id="kpi-soon">—</p></div>
      <div class="kpi"><p class="kpi-label">Con fecha de entrega vencida</p><p class="kpi-value" id="kpi-late">—</p></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Orden</th><th>Nivel</th><th>Avance</th><th>Fecha de entrega</th></tr></thead>
        <tbody id="dash-rows"><tr><td colspan="4" class="dash-msg">Cargando órdenes…</td></tr></tbody>
      </table>
    </div>
  </section>
</div>
<script>
(function () {
  var API = "https://produccion.serviceranchotrailers.org/api/public/ordenes";
  var DAY = 86400000;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function today() {
    var d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function fmtDate(ymd) {
    var p = ymd.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  function daysLeft(ymd) {
    var p = ymd.split("-");
    return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - today()) / DAY);
  }

  function render(data) {
    var rows = document.getElementById("dash-rows");
    rows.textContent = "";
    var levels = data.levels || [];
    var soon = 0, late = 0;

    if (!data.orders.length) {
      var empty = el("tr");
      var td = el("td", "dash-msg", "No hay órdenes en curso.");
      td.colSpan = 4;
      empty.appendChild(td);
      rows.appendChild(empty);
    }

    data.orders.forEach(function (o) {
      var tr = el("tr");

      var c1 = el("td");
      c1.appendChild(el("div", "o-name", o.name));
      if (o.model) c1.appendChild(el("div", "o-model", o.model));
      tr.appendChild(c1);

      var c2 = el("td");
      var lvl = el("div", "lvl");
      var steps = el("div", "lvl-steps");
      var idx = o.level ? levels.findIndex(function (l) { return l.code === o.level.code; }) : -1;
      levels.forEach(function (_, i) { steps.appendChild(el("span", i <= idx ? "on" : "")); });
      steps.setAttribute("aria-hidden", "true");
      lvl.appendChild(steps);
      var txt = el("span", "lvl-text");
      if (o.level) {
        txt.appendChild(el("span", "lvl-code", o.level.code));
        txt.appendChild(document.createTextNode(o.level.name));
      } else {
        txt.textContent = "—";
      }
      lvl.appendChild(txt);
      c2.appendChild(lvl);
      tr.appendChild(c2);

      var c3 = el("td");
      var bar = el("div", "bar");
      bar.title = o.name + ": " + o.progressPct + "% de avance";
      var track = el("div", "bar-track");
      var fill = el("div", "bar-fill");
      fill.style.width = Math.max(0, Math.min(100, o.progressPct)) + "%";
      track.appendChild(fill);
      bar.appendChild(track);
      bar.appendChild(el("span", "bar-pct", o.progressPct + "%"));
      c3.appendChild(bar);
      tr.appendChild(c3);

      var c4 = el("td", "due");
      if (o.dueDate) {
        c4.appendChild(document.createTextNode(fmtDate(o.dueDate)));
        var left = daysLeft(o.dueDate);
        if (left < 0) {
          late++;
          c4.appendChild(el("span", "chip late", "⚠ Vencida hace " + -left + (left === -1 ? " día" : " días")));
        } else if (left <= 7) {
          soon++;
          c4.appendChild(el("span", "chip soon", "◷ " + (left === 0 ? "Hoy" : "En " + left + (left === 1 ? " día" : " días"))));
        }
      } else {
        c4.appendChild(el("span", "o-model", "Sin fecha"));
      }
      if (o.paused) c4.appendChild(el("span", "chip paused", "⏸ Pausada"));
      tr.appendChild(c4);

      rows.appendChild(tr);
    });

    document.getElementById("kpi-total").textContent = data.orders.length;
    document.getElementById("kpi-soon").textContent = soon;
    document.getElementById("kpi-late").textContent = late;
    document.getElementById("dash-updated").textContent =
      "Actualizado " + new Date(data.generatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }

  function load() {
    fetch(API, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(function () {
        document.getElementById("dash-updated").textContent = "No se pudo cargar la información de producción.";
      });
  }

  load();
  setInterval(load, 5 * 60 * 1000);
})();
</script>
`;

export default {
  async fetch() {
    return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
