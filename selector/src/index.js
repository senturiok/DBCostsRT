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
    margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:
      radial-gradient(720px 420px at 50% -10%, rgba(200,80,30,.16), transparent),
      var(--bg);
    color:var(--ink); font-family:var(--font-body); padding:24px;
  }
  .wrap{width:100%; max-width:760px; text-align:center;}
  .logo{ width:100%; max-width:420px; height:auto; margin:0 auto 20px; display:block; }
  p.sub{color:var(--ink-2); font-size:14px; margin:0 0 36px; letter-spacing:.01em;}
  .cards{display:grid; grid-template-columns:1fr 1fr; gap:20px;}
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
    <a class="card" href="https://produccion.serviceranchotrailers.org">
      <div class="card-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M4 20V10l5-5 5 5v10"/><path d="M14 20v-6l4-3 4 3v6"/></svg>
      </div>
      <div class="card-title">Portal de Producción</div>
      <p class="card-desc">Control y seguimiento de producción.</p>
      <span class="card-cta">Entrar <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
    </a>
  </div>
</div>
`;

export default {
  async fetch() {
    return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
