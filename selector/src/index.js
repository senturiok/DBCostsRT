const PAGE = `<!DOCTYPE html>
<meta charset="UTF-8">
<title>Rancho Trailers — Portales</title>
<style>
  :root{
    --bg:#eef1f2; --surface:#ffffff; --ink:#10161a; --ink-2:#55636b;
    --line:#dde2e4; --accent:#c8501e; --accent-ink:#ffffff;
    --shadow: 0 1px 2px rgba(16,22,26,.06), 0 8px 24px -12px rgba(16,22,26,.18);
    --font-display:"Oswald",system-ui,"Segoe UI",sans-serif;
    --font-body:"IBM Plex Sans",system-ui,"Segoe UI",sans-serif;
  }
  *{box-sizing:border-box}
  body{
    margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:var(--bg); color:var(--ink); font-family:var(--font-body); padding:24px;
  }
  .wrap{width:100%; max-width:720px; text-align:center;}
  .brand-mark{
    width:44px; height:44px; margin:0 auto 14px; border-radius:6px; background:var(--accent);
    color:var(--accent-ink); display:flex; align-items:center; justify-content:center;
    font-family:var(--font-display); font-size:20px;
  }
  h1{
    font-family:var(--font-display); text-transform:uppercase; letter-spacing:.03em;
    font-size:24px; margin:0 0 6px;
  }
  p.sub{color:var(--ink-2); font-size:13.5px; margin:0 0 28px;}
  .cards{display:grid; grid-template-columns:1fr 1fr; gap:16px;}
  @media (max-width:560px){ .cards{grid-template-columns:1fr;} }
  a.card{
    display:block; background:var(--surface); border:1px solid var(--line); border-radius:8px;
    padding:28px 20px; text-decoration:none; color:var(--ink); box-shadow:var(--shadow);
    transition:transform .12s ease, border-color .12s ease;
  }
  a.card:hover{ border-color:var(--accent); transform:translateY(-2px); }
  .card-title{
    font-family:var(--font-display); text-transform:uppercase; letter-spacing:.02em;
    font-size:16px; margin:0 0 6px;
  }
  .card-desc{color:var(--ink-2); font-size:12.5px; margin:0;}
</style>
<div class="wrap">
  <div class="brand-mark">RT</div>
  <h1>Rancho Trailers</h1>
  <p class="sub">Selecciona el portal al que quieres entrar.</p>
  <div class="cards">
    <a class="card" href="https://dbcosteo.serviceranchotrailers.org">
      <div class="card-title">Costeo de Gastos</div>
      <p class="card-desc">Facturas, gastos y costeo por remolque.</p>
    </a>
    <a class="card" href="https://pcot.serviceranchotrailers.org">
      <div class="card-title">Portal</div>
      <p class="card-desc">pcot.serviceranchotrailers.org</p>
    </a>
  </div>
</div>
`;

export default {
  async fetch() {
    return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
