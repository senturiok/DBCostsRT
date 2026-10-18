# Tablero de Dirección

`direccion.serviceranchotrailers.org`: un solo tablero, solo lectura, con lo
crítico de los cuatro portales.

| Portal | De dónde lee |
| --- | --- |
| Costeo | `dbcosteo…/bot/datos` (Bearer `DIRECCION_TOKEN`) |
| Cobranza | `pcobranza…/bot/datos` (Bearer `DIRECCION_TOKEN`) |
| Cotizaciones | `pcot…/bot/datos` (Bearer `DIRECCION_TOKEN`) |
| Producción | `produccion…/api/public/ordenes` (público) |

- `src/resumen.js` arma los indicadores, las alertas y la tabla por proyecto
  (los portales se ligan por nombre del proyecto).
- `src/page.js` es la página; `src/index.js` el inicio de sesión y `/api/resumen`.

## Secretos

```bash
npx wrangler secret put DIRECCION_PASSWORD   # contraseña para entrar
npx wrangler secret put SESSION_SECRET       # firma la cookie; cambiarla cierra todas las sesiones
npx wrangler secret put DIRECCION_TOKEN      # mismo valor en Costeo, Cobranza y Cotizaciones
```

## Desplegar

```bash
cd direccion && npx wrangler deploy
```
