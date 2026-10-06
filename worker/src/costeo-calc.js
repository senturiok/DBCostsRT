// Cálculos del portal de costeo para el servidor (los usa el acceso del bot
// de WhatsApp, ver bot.js). Son COPIA LITERAL de estas funciones de
// index.html, extraídas con todo lo que usan:
//   normKey, slugify, todayISO, isImplausibleYear, allGastos, allProyectos
//   allProveedoresFull, proyectoNombre, estadoDeProyecto, fechaTerminado, contKey, creditoInfo
//   saldoDeGasto, isoAddDays, viernesEnOPosterior, diasCreditoMap, vencimientoCredito, propuestaViernes
//   computePropuestaPago, tcSorted, tcParaFecha, fechaParaTc, proyectoUsdInfo, estadoHouston
//   allGastosUsd, allProyectosHouston, dayNum, computeOverheadProrrateo, esProyectoIndirecto, computeIndirectosMx
//   computeCostoTotal, computeProyectosHoustonCostos
// SI CAMBIAN ESOS CÁLCULOS EN index.html (costo total, indirectos, overhead,
// tipo de cambio, crédito/propuesta de pago), VUELVE A COPIARLOS AQUÍ para que
// el bot dé las mismas cifras que el portal.
//
// makeCalc(STATE) recibe un objeto con la misma forma que STATE en la página
// (ver buildCalcState en bot.js) y devuelve las funciones.
/* eslint-disable */
export function makeCalc(STATE) {
  "use strict";


  function normKey(s){ if(!s) return ""; return String(s).trim().toUpperCase().replace(/\s+/g," ").replace(/\.+$/,""); }

  function slugify(s){ var k=normKey(s); k=k.replace(/[^A-Z0-9_.~:@+-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""); return k||("k"+Math.random().toString(36).slice(2,8)); }

  function todayISO(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

  function isImplausibleYear(d){
    if(!d) return false;
    var y = parseInt(String(d).slice(0,4),10);
    if(isNaN(y)) return false;
    var now = new Date().getFullYear();
    return y < now-5 || y > now+3;
  }

  function allGastos(){
    var base = STATE.gastosBase.map(function(r){
      var edit = STATE.gastosEdits[String(r.id)];
      if(!edit) return r;
      if(edit.eliminado) return null;
      var merged = Object.assign({}, r, edit, {
        flag_sin_proveedor: !edit.proveedor, flag_sin_proyecto: !edit.proyecto_key, _edited:true
      });
      merged.flag_fecha = isImplausibleYear(merged.fecha) || isImplausibleYear(merged.fecha_factura);
      return merged;
    }).filter(Boolean);
    var extra = STATE.gastosNuevos.map(function(g){
      return {
        id:"n:"+g.id, proyecto_key:g.proyecto_key||normKey(g.proyecto), proyecto_raw:g.proyecto,
        fecha:g.fecha, fecha_factura:g.fecha_factura, proveedor:g.proveedor, descripcion:g.descripcion,
        factura:g.factura, importe:Number(g.importe)||0, cantidad:g.cantidad, kg:null, categoria:g.categoria,
        forma_pago:g.forma_pago||null,
        flag_sin_proveedor:!g.proveedor, flag_sin_proyecto:!g.proyecto, flag_fecha:false,
        origen:"portal", capturadoPor:g.capturadoPor||"", _docId:g.id,
        comprobanteId:g.comprobanteId||null, comprobanteUrl:g.comprobanteUrl||null, comprobanteTipo:g.comprobanteTipo||null
      };
    });
    return base.concat(extra);
  }

  function allProyectos(){
    var map = {};
    STATE.proyectosCat.forEach(function(p){ map[p.key]={key:p.key,nombre:p.nombre,es_valido:p.es_valido,origen:"excel"}; });
    STATE.proyectosNuevos.forEach(function(p){ if(!map[p.key]) map[p.key]={key:p.key,nombre:p.nombre,es_valido:true,origen:"portal",_docId:p.id}; });
    Object.keys(map).forEach(function(k){
      var info = STATE.proyectosInfo[slugify(k)];
      if(info && info.eliminado){ delete map[k]; return; }
      map[k].tipoTraila = (info&&info.tipoTraila)||"";
      map[k].tamanoTraila = (info&&info.tamanoTraila)||"";
      if(info && info.nombre) map[k].nombre = info.nombre;
    });
    return map;
  }

  function allProveedoresFull(){
    var portalIds = {};
    STATE.proveedoresNuevos.forEach(function(p){ portalIds[normKey(p.nombre)] = p.id; });
    var names = {};
    STATE.proveedoresCat.forEach(function(n){ names[normKey(n)] = n; });
    STATE.proveedoresNuevos.forEach(function(p){ var k=normKey(p.nombre); if(!names[k]) names[k]=p.nombre; });
    return Object.keys(names).map(function(k){
      var original = names[k];
      var key = slugify(original);
      var info = STATE.proveedoresInfo[key] || {};
      return {
        nombre: info.nombre || original, original: original, key: key,
        origen: portalIds[k] ? "portal" : "excel", _docId: portalIds[k] || null,
        direccion: info.direccion||"", telefono: info.telefono||"", email: info.email||"",
        dias_credito: (info.dias_credito===null||info.dias_credito===undefined||info.dias_credito==="") ? null : Number(info.dias_credito),
        eliminado: !!info.eliminado
      };
    }).filter(function(p){ return !p.eliminado; }).sort(function(a,b){return a.nombre.localeCompare(b.nombre);});
  }

  function proyectoNombre(key){ if(key==="SIN_PROYECTO"||!key) return "Sin proyecto asignado"; var p=allProyectos()[key]; return p?p.nombre:key; }

  function estadoDeProyecto(key){ var slug=slugify(key); var e=STATE.proyectoEstado[slug]; return (e&&e.estado)?e.estado:"activo"; }

  function fechaTerminado(key){
    var e = STATE.proyectoEstado[slugify(key)];
    if(!e || e.estado!=="terminado") return null;
    if(e.fecha_terminado) return e.fecha_terminado;
    if(e.updatedAt){ var d = new Date(e.updatedAt); if(!isNaN(d)) return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
    return null;
  }

  function contKey(id){ return String(id).replace(/[^A-Za-z0-9_.-]/g,"_"); }

  function creditoInfo(g){ return STATE.gastosContabilidad[contKey(g.id)] || {}; }

  function saldoDeGasto(id, g){
    var info = STATE.gastosContabilidad[contKey(id)] || {};
    var importe = g ? g.importe : 0;
    var estado = info.estado || "pendiente";
    var montoPagado = estado==="pagado" ? importe : (info.pagoParcial ? (info.montoPagado||0) : 0);
    var saldo = Math.max(0, importe - montoPagado);
    return { id:id, importe:importe, estado:estado, montoPagado:montoPagado, saldo:saldo };
  }

  var DIAS_CREDITO_DEFAULT = 30;

  function isoAddDays(iso, n){ var d = new Date(iso+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }

  function viernesEnOPosterior(iso){ var dow = new Date(iso+"T00:00:00Z").getUTCDay(); return isoAddDays(iso, (5-dow+7)%7); }

  function diasCreditoMap(){
    var m = {};
    allProveedoresFull().forEach(function(p){
      if(p.dias_credito===null || isNaN(p.dias_credito)) return;
      m[normKey(p.original)] = p.dias_credito; m[normKey(p.nombre)] = p.dias_credito;
    });
    return m;
  }

  function vencimientoCredito(r, diasMap){
    var dias = diasMap[normKey(r.proveedor||"")];
    if(dias===undefined) dias = DIAS_CREDITO_DEFAULT;
    if(!r.fecha_factura || isImplausibleYear(r.fecha_factura)) return { dias:dias, vence:null, viernes:null };
    var vence = isoAddDays(r.fecha_factura, dias);
    return { dias:dias, vence:vence, viernes:viernesEnOPosterior(vence) };
  }

  function propuestaViernes(){ return STATE.propViernes || viernesEnOPosterior(todayISO()); }

  function computePropuestaPago(viernes){
    var diasMap = diasCreditoMap();
    var incluidas = [], pendientes = [], sinFecha = [];
    allGastos().forEach(function(r){
      if(r.forma_pago!=="credito") return;
      var si = saldoDeGasto(r.id, r);
      if(si.estado==="pagado" || si.saldo<=0.004) return;
      var v = vencimientoCredito(r, diasMap);
      if(!v.viernes){ if(si.estado==="verificado") sinFecha.push(r); return; }
      if(v.viernes>viernes) return;
      var item = { r:r, saldo:si.saldo, dias:v.dias, vence:v.vence, viernesPago:v.viernes, atrasada:v.viernes<viernes };
      if(si.estado==="verificado") incluidas.push(item); else pendientes.push(item);
    });
    // Una factura con varias líneas (varios proyectos) se muestra en un renglón.
    var facturas = {}, orden = [];
    incluidas.forEach(function(it){
      var r = it.r, facturaTrim = (r.factura||"").trim();
      var k = normKey(r.proveedor||"")+"||"+(facturaTrim ? facturaTrim.toUpperCase() : "SIN-FACTURA-"+r.id);
      var f = facturas[k];
      if(!f){ f = facturas[k] = { proveedor:r.proveedor||"—", factura:r.factura, fecha_factura:r.fecha_factura, dias:it.dias, vence:it.vence, viernesPago:it.viernesPago, atrasada:false, saldo:0, ids:[], proyectos:[] }; orden.push(k); }
      f.saldo += it.saldo; f.ids.push(r.id);
      if(it.vence<f.vence){ f.vence = it.vence; f.viernesPago = it.viernesPago; f.fecha_factura = r.fecha_factura; }
      f.atrasada = f.atrasada || it.atrasada;
      var pn = proyectoNombre(r.proyecto_key); if(f.proyectos.indexOf(pn)<0) f.proyectos.push(pn);
    });
    var lista = orden.map(function(k){ return facturas[k]; }).sort(function(a,b){
      var pa = a.proveedor.toUpperCase(), pb = b.proveedor.toUpperCase();
      if(pa!==pb) return pa<pb?-1:1;
      return a.vence.localeCompare(b.vence);
    });
    return { facturas:lista, pendientes:pendientes, sinFecha:sinFecha };
  }

  var _tcCache = null;

  function tcSorted(){
    if(_tcCache) return _tcCache;
    _tcCache = Object.keys(STATE.tiposCambio).map(function(k){
      var t = STATE.tiposCambio[k] || {};
      return { fecha:t.fecha||k, fix:Number(t.fix), fuente:t.fuente||"" };
    }).filter(function(t){ return /^\d{4}-\d{2}-\d{2}$/.test(t.fecha) && t.fix>0; })
      .sort(function(a,b){ return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0; });
    return _tcCache;
  }

  function tcParaFecha(fecha){
    var list = tcSorted();
    if(!fecha || !list.length || fecha < list[0].fecha) return null;
    var lo=0, hi=list.length-1;
    while(lo<hi){ var mid=(lo+hi+1)>>1; if(list[mid].fecha<=fecha) lo=mid; else hi=mid-1; }
    return list[lo];
  }

  function fechaParaTc(r){
    if(r.fecha_factura && !isImplausibleYear(r.fecha_factura)) return r.fecha_factura;
    return r.fecha;
  }

  function proyectoUsdInfo(key){ return STATE.proyectosUsd[slugify(key)] || {}; }

  function estadoHouston(key){
    var i = proyectoUsdInfo(key);
    if(i.fecha_venta) return "vendido";
    if(i.fecha_exportacion) return "exportado";
    return "mexico";
  }

  function allGastosUsd(){
    return STATE.gastosUsd.map(function(g){
      var tipo = (g.tipo==="houston" && g.proyecto_houston) ? "houston" : (g.tipo==="overhead" || !g.proyecto_key) ? "overhead" : "proyecto";
      return Object.assign({}, g, { _docId:g.id, tipo:tipo, proyecto_key: tipo==="proyecto"?g.proyecto_key:"", proyecto_houston: tipo==="houston"?g.proyecto_houston:"", importe_usd:Number(g.importe_usd)||0 });
    });
  }

  function allProyectosHouston(includeDeleted){
    return Object.keys(STATE.proyectosHouston).map(function(id){
      var p = STATE.proyectosHouston[id] || {};
      var ing = (p.ingreso_usd===null||p.ingreso_usd===undefined||p.ingreso_usd==="") ? null : Number(p.ingreso_usd);
      return { id:id, nombre:p.nombre||id, tipo:p.tipo||"otro", cliente:p.cliente||"", descripcion:p.descripcion||"",
        fecha_inicio:p.fecha_inicio||"", fecha_cierre:p.fecha_cierre||"", ingreso_usd:ing, eliminado:!!p.eliminado };
    }).filter(function(p){ return includeDeleted || !p.eliminado; })
      .sort(function(a,b){ return (b.fecha_inicio||"").localeCompare(a.fecha_inicio||"") || a.nombre.localeCompare(b.nombre); });
  }

  function dayNum(iso){ var p=iso.split("-"); return Date.UTC(+p[0], +p[1]-1, +p[2])/86400000; }

  function computeOverheadProrrateo(){
    var porMes = {};
    allGastosUsd().forEach(function(g){
      if(g.tipo!=="overhead") return;
      var d = fechaParaTc(g); if(!d) return;
      var ym = d.slice(0,7);
      porMes[ym] = (porMes[ym]||0) + g.importe_usd;
    });
    var proyMap = allProyectos();
    var enHouston = Object.keys(proyMap).map(function(k){
      var i = proyectoUsdInfo(k);
      return i.fecha_exportacion ? { key:k, desde:dayNum(i.fecha_exportacion), hasta:i.fecha_venta?dayNum(i.fecha_venta):Infinity } : null;
    }).filter(Boolean);
    // Los proyectos Houston participan igual que un remolque, del inicio al cierre.
    allProyectosHouston(false).forEach(function(ph){
      if(ph.fecha_inicio) enHouston.push({ key:"H:"+ph.id, desde:dayNum(ph.fecha_inicio), hasta:ph.fecha_cierre?dayNum(ph.fecha_cierre):Infinity });
    });
    var porProyecto = {}, detalle = {}, sinAsignar = 0, sinAsignarMeses = [];
    Object.keys(porMes).sort().forEach(function(ym){
      var y=+ym.slice(0,4), m=+ym.slice(5,7);
      var ini = Date.UTC(y,m-1,1)/86400000, fin = Date.UTC(y,m,0)/86400000;
      var dias = {}, totalDias = 0;
      enHouston.forEach(function(p){
        var a = Math.max(ini, p.desde), b = Math.min(fin, p.hasta);
        if(b>=a){ dias[p.key] = b-a+1; totalDias += b-a+1; }
      });
      if(!totalDias){ sinAsignar += porMes[ym]; sinAsignarMeses.push(ym); return; }
      Object.keys(dias).forEach(function(k){
        var share = dias[k]/totalDias, monto = porMes[ym]*share;
        porProyecto[k] = (porProyecto[k]||0) + monto;
        (detalle[k] = detalle[k]||[]).push({ ym:ym, overheadMes:porMes[ym], dias:dias[k], totalDias:totalDias, share:share, monto:monto });
      });
    });
    return { porMes:porMes, porProyecto:porProyecto, detalle:detalle, sinAsignar:sinAsignar, sinAsignarMeses:sinAsignarMeses };
  }

  var INDIRECTO_PROYECTO_KEYS = ["GASTO GENERAL", "CONSUMIBLES G"];

  function esProyectoIndirecto(key){ return INDIRECTO_PROYECTO_KEYS.indexOf(normKey(key||""))>-1; }

  function computeIndirectosMx(){
    var porMes = {}, sinFecha = { n:0, mxn:0 }, directo = {}, nGastos = 0;
    allGastos().forEach(function(r){
      var v = Number(r.importe)||0;
      if(esProyectoIndirecto(r.proyecto_key)){
        var d = fechaParaTc(r);
        if(!d || isImplausibleYear(d)){ sinFecha.n++; sinFecha.mxn += v; return; }
        var ym = d.slice(0,7);
        porMes[ym] = (porMes[ym]||0) + v; nGastos++;
      } else if(r.proyecto_key){
        directo[r.proyecto_key] = (directo[r.proyecto_key]||0) + v;
      }
    });
    var proyMap = allProyectos(), terminadosPorMes = {}, terminadosSinFecha = [];
    Object.keys(proyMap).forEach(function(k){
      if(!proyMap[k].es_valido || esProyectoIndirecto(k) || estadoDeProyecto(k)!=="terminado") return;
      var f = fechaTerminado(k);
      if(!f){ terminadosSinFecha.push(k); return; }
      (terminadosPorMes[f.slice(0,7)] = terminadosPorMes[f.slice(0,7)]||[]).push({ key:k, fecha:f });
    });
    var meses = Object.keys(porMes).concat(Object.keys(terminadosPorMes))
      .filter(function(ym,i,a){ return a.indexOf(ym)===i; }).sort();
    var arrastre = 0, filas = [], porProyecto = {};
    meses.forEach(function(ym){
      var delMes = porMes[ym]||0, disponible = arrastre + delMes, terms = terminadosPorMes[ym]||[];
      var fila = { ym:ym, indirecto:delMes, arrastre:arrastre, disponible:disponible, proyectos:[], asignado:0, pasa:0 };
      if(terms.length && disponible>0){
        var pesoTotal = terms.reduce(function(s,t){ return s+Math.max(0, directo[t.key]||0); },0);
        terms.forEach(function(t){
          var share = pesoTotal>0 ? Math.max(0, directo[t.key]||0)/pesoTotal : 1/terms.length;
          var monto = disponible*share;
          fila.proyectos.push({ key:t.key, fecha:t.fecha, directo:directo[t.key]||0, share:share, monto:monto });
          porProyecto[t.key] = { ym:ym, fecha:t.fecha, directo:directo[t.key]||0, share:share, monto:monto, indirectoMes:delMes, arrastre:arrastre };
        });
        fila.asignado = disponible; arrastre = 0;
      } else {
        terms.forEach(function(t){ fila.proyectos.push({ key:t.key, fecha:t.fecha, directo:directo[t.key]||0, share:0, monto:0 }); });
        arrastre = disponible; fila.pasa = disponible;
      }
      filas.push(fila);
    });
    var total = Object.keys(porMes).reduce(function(s,k){ return s+porMes[k]; },0);
    return { filas:filas, porProyecto:porProyecto, total:total, asignado:total-arrastre, pendiente:arrastre,
      sinFecha:sinFecha, terminadosSinFecha:terminadosSinFecha, directo:directo, nGastos:nGastos };
  }

  function computeCostoTotal(){
    var proyMap = allProyectos();
    var rows = {};
    function row(k){
      if(!rows[k]) rows[k] = { key:k, mxn:0, mxnConTc:0, usdMx:0, sinTc:0, sinTcMxn:0, mxByCat:{}, houston:0, houstonByCat:{}, overhead:0, indirectoMxn:0, indirectoUsd:0, indirectoTc:null, indirectoInfo:null, gastosMx:0, gastosUsd:0 };
      return rows[k];
    }
    allGastos().forEach(function(r){
      var k = r.proyecto_key; if(!k || !proyMap[k] || esProyectoIndirecto(k)) return;
      var x = row(k), v = Number(r.importe)||0;
      x.mxn += v; x.gastosMx++;
      var tc = tcParaFecha(fechaParaTc(r));
      if(!tc){ x.sinTc++; x.sinTcMxn += v; return; }
      var usd = v/tc.fix;
      x.mxnConTc += v; x.usdMx += usd;
      var c = r.categoria||"SIN-CAT";
      if(!x.mxByCat[c]) x.mxByCat[c] = { mxn:0, usd:0 };
      x.mxByCat[c].mxn += v; x.mxByCat[c].usd += usd;
    });
    allGastosUsd().forEach(function(g){
      if(g.tipo!=="proyecto" || !proyMap[g.proyecto_key]) return;
      var x = row(g.proyecto_key);
      x.houston += g.importe_usd; x.gastosUsd++;
      var c = g.categoria||"—";
      x.houstonByCat[c] = (x.houstonByCat[c]||0) + g.importe_usd;
    });
    var pr = computeOverheadProrrateo();
    Object.keys(pr.porProyecto).forEach(function(k){ if(proyMap[k]) row(k).overhead = pr.porProyecto[k]; });
    // Indirecto de México: se convierte al FIX del día en que se terminó el proyecto.
    var ix = computeIndirectosMx(), indSinTc = 0;
    Object.keys(ix.porProyecto).forEach(function(k){
      var p = ix.porProyecto[k]; if(!proyMap[k] || !(p.monto>0.004)) return;
      var x = row(k), tc = tcParaFecha(p.fecha);
      x.indirectoMxn = p.monto; x.indirectoInfo = p;
      if(tc){ x.indirectoUsd = p.monto/tc.fix; x.indirectoTc = tc.fix; } else { indSinTc += p.monto; }
    });
    Object.keys(proyMap).forEach(function(k){ if(proyMap[k].es_valido && STATE.proyectosUsd[slugify(k)]) row(k); });
    var list = Object.keys(rows).filter(function(k){ return proyMap[k].es_valido && !esProyectoIndirecto(k); }).map(function(k){
      var x = rows[k], info = proyectoUsdInfo(k);
      x.nombre = proyMap[k].nombre;
      x.estado = estadoHouston(k);
      x.fecha_exportacion = info.fecha_exportacion || null;
      x.tcProm = x.usdMx>0 ? x.mxnConTc/x.usdMx : null;
      x.total = x.usdMx + x.indirectoUsd + x.houston + x.overhead;
      x.venta = Number(info.precio_venta_usd)||0;
      x.margen = x.venta ? x.venta - x.total : null;
      x.margenPct = x.venta ? x.margen/x.venta*100 : null;
      x.overheadDetalle = pr.detalle[k] || [];
      return x;
    });
    return { rows:list, prorrateo:pr, indirectos:{ pendiente:ix.pendiente, sinTc:indSinTc } };
  }

  function computeProyectosHoustonCostos(){
    var directo = {}, nGastos = {};
    allGastosUsd().forEach(function(g){ if(g.tipo==="houston"){ directo[g.proyecto_houston] = (directo[g.proyecto_houston]||0) + g.importe_usd; nGastos[g.proyecto_houston] = (nGastos[g.proyecto_houston]||0)+1; } });
    var pr = computeOverheadProrrateo();
    return allProyectosHouston(false).map(function(p){
      var d = directo[p.id]||0, oh = pr.porProyecto["H:"+p.id]||0, costo = d+oh;
      return Object.assign({}, p, { directo:d, overhead:oh, costo:costo, nGastos:nGastos[p.id]||0,
        margen: p.ingreso_usd===null ? null : p.ingreso_usd-costo,
        margenPct: (p.ingreso_usd===null || !p.ingreso_usd) ? null : (p.ingreso_usd-costo)/p.ingreso_usd*100 });
    });
  }
  return {
    allGastos, allGastosUsd, allProyectos, allProyectosHouston, proyectoNombre, estadoDeProyecto,
    computeCostoTotal, computeIndirectosMx, computeOverheadProrrateo, computeProyectosHoustonCostos,
    computePropuestaPago, propuestaViernes, saldoDeGasto, creditoInfo, vencimientoCredito,
  };
}
