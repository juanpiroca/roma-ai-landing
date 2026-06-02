# ROMA AI — ENVIRONMENT CHECK
## Auditoría del Entorno Técnico Completo
**Fecha:** 2026-05-28
**Auditado por:** Claude Sonnet 4.6 (main agent)

---

## ESTADO GENERAL

| Ítem | Estado | Detalle |
|------|--------|---------|
| Servicio Landing | ✅ ONLINE | PM2 id:1 `roma-webchat`, puerto 3000, uptime 5h |
| WordPress | ✅ ONLINE | Docker `roma-wordpress`, puerto 8090, uptime 39h |
| MySQL | ✅ ONLINE | Docker `roma-wordpress-db`, uptime 39h |
| Bot Telegram | ✅ ONLINE | PM2 id:6 `roma-bot` |
| Bot WhatsApp | ✅ ONLINE | PM2 id:0 `roma-whatsapp`, puerto 3201 |
| Nginx | ✅ ACTIVO | Reverse proxy con SSL (roma.dementetv.com) |
| Node.js | ✅ v20.20.2 | LTS estable |
| npm | ✅ v10.8.2 | Actual |
| bun | ✅ disponible | `/home/juanpi/.bun/bin/bun` |
| pnpm | ❌ no instalado | Disponible si se necesita |
| git | ✅ v2.47.3 | |
| docker | ✅ v29.5.2 | |

---

## SERVICIOS PM2

```
id:0  roma-whatsapp    online  39h  puerto 3201
id:1  roma-webchat     online  5h   puerto 3000  ← LANDING
id:2  trading-bot      online  39h
id:3  trading-dashboard online 39h
id:4  trading-news     online  39h
id:5  luka-alexa       online  39h
id:6  roma-bot         online  39h  (Telegram)
id:7  hermes-dashboard online  6h
id:8  n8n              online  39h  (294MB RAM)
id:9  lab-dashboard    online  39h
id:10 juanpi-dash-backend  online 39h
id:11 juanpi-dash-frontend online 39h
```

⚠️ `roma-webchat` tiene 159 reinicios — indica inestabilidad o crash loops históricos.

---

## ESTRUCTURA DEL PROYECTO LANDING

**Path:** `/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/`

```
├── index.html          ← LANDING COMPLETA (1903 líneas, TODO en un archivo)
├── voice.html          ← Página de voz
├── server.js           ← Express server (sirve estáticos + API webchat)
├── server.js.bak_phase11
├── ai-client.js
├── ecosystem.config.js ← Config PM2
├── package.json
├── package-lock.json
├── favicon-roma.svg
├── assets/             ← Imágenes y SVGs
│   ├── avatar-ana.png
│   ├── avatar-carlos.png
│   ├── avatar-laura.png
│   ├── avatar-roma-real.jpg
│   ├── avatar-roma.svg
│   ├── bg-pattern.png
│   ├── dashboard-mockup.png
│   ├── favicon.svg
│   ├── footer-logo-negative.svg
│   ├── hero-logo-lockup.svg
│   ├── icono-automatizacion.png
│   ├── icono-captura.png
│   ├── icono-ia.png
│   ├── icono-multichannel.png
│   ├── icono-reportes.png
│   ├── icono-routing.png
│   ├── logo-roma.png
│   ├── navbar-logo.svg
│   ├── problem-horas.jpg
│   ├── problem-perdidos.jpg
│   └── problem-tiempo.jpg
├── node_modules/       ← (cors, express, node-fetch, ws)
├── shared/
└── tests/
```

---

## DEPENDENCIAS (package.json)

```json
{
  "dependencies": {
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "node-fetch": "^2.7.0",
    "ws": "^8.20.1"
  }
}
```

**Sin devDependencies** — no hay build system, linter, ni test runner configurado.

---

## STACK TÉCNICO ACTUAL

| Tecnología | Estado | Versión |
|------------|--------|---------|
| HTML | ✅ vanilla | — (1903 líneas, monolítico) |
| CSS | ✅ vanilla | — (inline en index.html) |
| JavaScript | ✅ vanilla | — (inline en index.html) |
| React | ❌ no existe | — |
| Tailwind | ❌ no existe | — |
| Vite | ❌ no existe | — |
| Webpack | ❌ no existe | — |
| TypeScript | ❌ no existe | — |
| Build system | ❌ no existe | — |
| Test suite | ❌ no existe | — |
| Linter | ❌ no existe | — |

---

## DEPENDENCIAS EXTERNAS (cargadas en runtime)

| Recurso | URL | Tipo | Impacto Performance |
|---------|-----|------|---------------------|
| Google Fonts | fonts.googleapis.com | CSS + Font files | ⚠️ Render blocking potencial |
| Spline Viewer | unpkg.com/@splinetool/viewer@1.9.82 | JS module | 🔴 CRÍTICO — sin defer, bloquea render |
| Spline Scene | prod.spline.design/kZDDjO5HuC9GJUM2/... | 3D asset | 🔴 CRÍTICO — probablemente MBs |

---

## SECCIONES DE LA LANDING (11 secciones + footer)

| # | ID | Nombre | data-reveal | data-bg-color |
|---|----|----|---|---|
| 1 | #hero | Hero (split + canvas + Spline) | No | No |
| 2 | .problem-section | El problema (3 cards) | Sí | #080d24 |
| 3 | #features | Funcionalidades (6 cards) | Sí | #050816 |
| 4 | #how | Cómo funciona (3 gears) | Sí | #141b32 |
| 5 | #dashboard | Dashboard preview | Sí | #0d1233 |
| — | (7 faltante) | — | — | — |
| 6 | #testimonials | Testimonios (3 cards) | Sí | #050816 |
| 7 | #pricing | Precios (3 planes) | No | No |
| 8 | #faq | FAQ (4 items) | Sí | #0a0f26 |
| 9 | #cta-final | CTA final | Sí | #0a0e1a |
| — | #footer | Footer (4 cols) | Sí | — |

⚠️ Pricing y Hero NO tienen data-reveal ni data-bg-color — inconsistencia de sistema.

---

## BUGS CRÍTICOS (HTML/CSS)

### 🔴 BUG 1: Hero section nunca se cierra
```html
<!-- línea 1199 — ABRE -->
<section id="hero">
  ...
  <!-- Problem section empieza en línea 1260 sin cerrar hero -->
  <section class="section problem-section" ...>
```
Las secciones 2-11 están anidadas dentro del `<section id="hero">`. Esto es HTML inválido.

### 🔴 BUG 2: Regla CSS duplicada conflictiva
```css
/* línea 263 */
#hero .hero-left p { text-align: left; }

/* línea 357 — sobrescribe, cambia a center */
#hero .hero-left p { text-align: center; }
```

### ⚠️ BUG 3: Marquee definido dos veces
```css
/* línea 313 — primera definición, sin animación */
.marquee-track { animation: none; }

/* línea 381 — segunda definición, también sin animación */
.marquee-track { animation: none; }
```
La segunda definición anula cualquier animación de scroll. El marquee no se mueve.

### ⚠️ BUG 4: Custom cursor en mobile
El cursor custom corre en todos los dispositivos, incluido mobile donde no hay cursor.

### ⚠️ BUG 5: Logo size conflict
```html
<img style="width:auto;height:32px;">  <!-- inline style -->
```
```css
.nav-logo-img { width: 36px; height: 36px; } /* CSS rule */
```

---

## NGINX CONFIG

**Archivo:** `/etc/nginx/sites-available/roma`

Rutas configuradas:
- `/` → Node.js puerto 3000 (landing)
- `/voice` → `http://127.0.0.1:3000/voice.html`
- `/api/` → Node.js puerto 3000
- `/wp-admin/` → WordPress puerto 8090
- `/wp-login.php` → WordPress puerto 8090
- `/wp-content/` → WordPress puerto 8090
- `/wp-includes/` → WordPress puerto 8090
- `/wp-json/` → WordPress puerto 8090
- `/webhook/whatsapp` → WhatsApp bot puerto 3201

SSL probablemente manejado por Let's Encrypt (Certbot).

---

## WORDPRESS

| Ítem | Detalle |
|------|---------|
| URL interna | http://127.0.0.1:8090 |
| URL pública | https://roma.dementetv.com/wp-admin/ |
| Versión | 6.5-php8.2-apache |
| DB | MySQL 8.0, `roma_wordpress`, table prefix `rma_` |
| Estado | Online, pero uso en producción desconocido |

**Pregunta crítica:** ¿Para qué se usa WordPress actualmente? Si está sin uso real, es una superficie de ataque innecesaria.

---

## QUÉ EXISTE

- Landing funcional con diseño dark/cinematic
- Sistema de diseño en CSS custom properties
- Scroll reveal y blur-fade vía IntersectionObserver
- Canvas animations (rings + orbital particles)
- Spline 3D viewer en hero
- Dynamic background on scroll
- Custom cursor
- Webchat integrado
- Footer con 4 columnas (incompleto)
- FAQ accordion nativo
- Pricing section con 3 planes
- Testimonials section
- Sección de problemas + features + how it works

## QUÉ FALTA

- Build system (Vite/Bun) — para optimización
- Lazy loading en imágenes
- Imágenes WebP/AVIF
- Structured data (JSON-LD)
- Sitemap.xml
- robots.txt
- Canonical tag
- Páginas legales reales (Términos, Privacidad)
- Formulario de contacto alternativo a WhatsApp
- Analytics (Google Analytics, Plausible, etc.)
- Error tracking (Sentry)
- CLAUDE.md local en el proyecto
- Tests de cualquier tipo
- CI/CD pipeline
- Backups automáticos del código (git remote)

## QUÉ CONVIENE

- Agregar `defer` al Spline viewer script
- Migrar CSS a archivo externo separado
- Migrar JS a archivo externo separado
- Implementar lazy loading con `loading="lazy"` en imágenes
- Convertir imágenes JPG/PNG a WebP
- Hacer reales los testimoniales o removerlos
- Cerrar correctamente el `<section id="hero">`
- Eliminar reglas CSS duplicadas
- Mover CSS del webchat al `<head>`
- Deshabilitar canvas animation cuando hero no está visible (IntersectionObserver)
- Agregar preload para las imágenes críticas (problem cards, dashboard)

## QUÉ NO CONVIENE

- Migrar a React/Next.js sin justificación — sería sobreingeniería para HTML estático
- Instalar Tailwind solo para reemplazar CSS custom que ya funciona bien
- Agregar más animaciones (ya hay demasiadas)
- Mantener Spline si el modelo 3D no es propio y definitivo
- Mantener WordPress si no tiene uso real

## RIESGOS TÉCNICOS

| Riesgo | Severidad | Detalle |
|--------|-----------|---------|
| Hero section sin cerrar | 🔴 Alto | HTML inválido, comportamiento imprevisible en algunos browsers |
| Spline sin defer | 🔴 Alto | Bloquea render, aumenta LCP significativamente |
| 159 reinicios de roma-webchat | 🔴 Alto | Indica crash loops — puede dejar la landing caída |
| Testimoniales ficticios | ⚠️ Medio | Destruye confianza si alguien verifica |
| Stats inventadas | ⚠️ Medio | Métricas no verificables = pérdida de credibilidad |
| Canvas siempre corriendo | ⚠️ Medio | CPU continuo en todos los usuarios |
| WordPress desactualizado | ⚠️ Medio | Superficie de ataque si no se usa |
| Sin backup de código (git) | ⚠️ Medio | Riesgo de pérdida ante fallo |

## DEUDA TÉCNICA

| Ítem | Impacto | Esfuerzo |
|------|---------|---------|
| CSS/JS separados del HTML | Alto | Bajo |
| Bug hero section | Alto | Bajo |
| CSS duplicados | Medio | Bajo |
| Imágenes WebP | Alto | Medio |
| Lazy loading | Alto | Bajo |
| Structured data | Medio | Medio |
| Documentación interna | Bajo | Bajo |

---

## RECURSO FALTANTE

⚠️ **El archivo `Archivos Para Crear Web Con Claude.zip` mencionado en el MASTER GOD PROMPT no se encontró en el servidor.**

Buscado en:
- `/home/juanpi/Descargas/`
- `/home/juanpi/`
- Todo el filesystem accesible

**Acción requerida:** JuanPi debe subir este archivo antes de la fase de implementación.

---

*Documento creado automáticamente — 2026-05-28*
*Claude Sonnet 4.6 — Fase 0 del MASTER GOD PROMPT*
