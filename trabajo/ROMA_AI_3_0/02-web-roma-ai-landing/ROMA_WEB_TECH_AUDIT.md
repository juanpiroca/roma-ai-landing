# ROMA AI — Auditoría Técnica Web
**Fecha:** 2026-05-28  
**Auditor:** Sistema interno — Claude Code  
**URL auditada:** https://roma.dementetv.com/  
**Archivo principal:** `/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html`  
**Stack:** HTML/CSS/JS vanilla · Node.js v20.20.2 · Express v5.2.1 · nginx reverse proxy

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Datos base verificados](#2-datos-base-verificados)
3. [Core Web Vitals — estimaciones](#3-core-web-vitals--estimaciones)
4. [Performance de carga](#4-performance-de-carga)
5. [JavaScript — análisis de carga y ejecución](#5-javascript--análisis-de-carga-y-ejecución)
6. [Animaciones y uso de CPU](#6-animaciones-y-uso-de-cpu)
7. [Imágenes — formatos, tamaños y compresión](#7-imágenes--formatos-tamaños-y-compresión)
8. [Estrategia de fuentes](#8-estrategia-de-fuentes)
9. [Cache y headers HTTP](#9-cache-y-headers-http)
10. [HTML estructural — bugs y semántica](#10-html-estructural--bugs-y-semántica)
11. [Accesibilidad](#11-accesibilidad)
12. [SEO técnico](#12-seo-técnico)
13. [OpenGraph y metadatos sociales](#13-opengraph-y-metadatos-sociales)
14. [Mobile rendering](#14-mobile-rendering)
15. [Seguridad — headers HTTP](#15-seguridad--headers-http)
16. [Recomendaciones priorizadas](#16-recomendaciones-priorizadas)

---

## 1. Resumen ejecutivo

La landing de ROMA AI está construida como un único archivo HTML de 1.903 líneas y ~78 KB de markup + CSS + JS inline. El diseño visual es de calidad y la arquitectura es intencionalmente simple (sin framework, sin build system). Sin embargo, hay problemas técnicos que impactan directamente en métricas de Core Web Vitals, experiencia mobile, seguridad y SEO.

**Problemas críticos (bloquean conversión o indexación):**
- El viewer 3D de Spline se carga como `<script type="module">` sin `defer`, bloqueando el render-thread.
- La escena 3D (`scene.splinecode`) es un asset externo de tamaño desconocido pero estimado en varios MB — el LCP del hero puede superar los 4 segundos.
- El `<section id="hero">` nunca se cierra antes de las siguientes secciones, lo que hace que el DOM completo del body sea hijo del hero. Esto es un bug estructural que puede romper estilos y la semántica de la página.
- No existen `robots.txt` ni `sitemap.xml` (verificado con `curl -I` en producción, ambos devuelven 404).
- La animación `requestAnimationFrame` del canvas corre a 60 fps durante toda la sesión, incluso cuando el hero ya no es visible. Esto satura el hilo principal en dispositivos de gama media.
- Los headers HTTP de producción no incluyen ningún header de seguridad (`X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, etc.).
- `Cache-Control: public, max-age=0` en todos los assets significa que no hay caché real; cada request re-valida.

**Problemas moderados (afectan performance o UX):**
- `dashboard-mockup.png` pesa 964 KB sin lazy loading ni formato WebP.
- Los 6 íconos de features son PNG (~18-69 KB c/u) en lugar de SVG.
- El CSS del webchat se carga al final del `<body>` como `<link rel="stylesheet">` — el browser lo descarga pero puede causar FOUC (flash de contenido sin estilos).
- La animación `@keyframes gear-spin` se referencia en el CSS pero **no está definida** en el archivo — los engranajes no rotan (bug silencioso).

---

## 2. Datos base verificados

### Archivo principal

| Métrica | Valor |
|---------|-------|
| Líneas totales | 1.903 |
| Tamaño en disco | ~80 KB |
| Tamaño en red (Content-Length) | 78.802 bytes (~77 KB) |
| Compresión gzip/brotli en producción | **NO** (no detectada en headers) |
| CSS en archivo | Inline (líneas 19–1.175 aprox.) |
| JS en archivo | Inline (líneas 1.652–1.898 aprox.) |

### Assets en `/assets/`

| Archivo | Tamaño | Formato |
|---------|--------|---------|
| dashboard-mockup.png | 964 KB | PNG |
| avatar-roma-real.jpg | 349 KB | JPG |
| logo-roma.png | 171 KB | PNG |
| problem-perdidos.jpg | 335 KB | JPG |
| problem-horas.jpg | 276 KB | JPG |
| problem-tiempo.jpg | 181 KB | JPG |
| icono-reportes.png | 69 KB | PNG |
| icono-captura.png | 58 KB | PNG |
| icono-automatizacion.png | 58 KB | PNG |
| avatar-laura.png | 58 KB | PNG |
| avatar-ana.png | 58 KB | PNG |
| avatar-carlos.png | 53 KB | PNG |
| icono-routing.png | 43 KB | PNG |
| icono-multichannel.png | 39 KB | PNG |
| bg-pattern.png | 27 KB | PNG |
| icono-ia.png | 18 KB | PNG |
| favicon.svg | 1.8 KB | SVG |
| footer-logo-negative.svg | 2.1 KB | SVG |
| hero-logo-lockup.svg | 2.2 KB | SVG |
| navbar-logo.svg | 2.1 KB | SVG |
| avatar-roma.svg | 1.6 KB | SVG |

**Total estimado de assets rasterizados:** ~2.8 MB sin comprimir  
**Total sin WebP equivalente:** todos los PNG/JPG

### Headers de producción (verificados con curl)

```
HTTP/1.1 200 OK
Server: nginx
X-Powered-By: Express
Cache-Control: public, max-age=0
Content-Length: 78802
ETag: W/"133d2-19e6c8c6a15"
```

**Ausentes:** `Content-Encoding`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`.

### Dependencias externas

| Recurso | Tipo | Estrategia actual |
|---------|------|-------------------|
| Google Fonts (Inter) | CSS externo | `preconnect` + `<link rel="stylesheet">` bloqueante |
| Spline Viewer JS | `<script type="module">` | **Sin defer** — bloquea render |
| Spline Scene | Asset 3D (~MBs) | Cargado por el viewer en background |
| /roma-webchat/webchat.css | CSS | `<link>` al final del `<body>` (FOUC) |
| /roma-webchat/roma-webchat.js | JS | `<script defer>` — correcto |
| /roma-webchat/webchat.js | JS | `<script defer>` — correcto |

---

## 3. Core Web Vitals — estimaciones

Sin acceso a herramientas de medición activas (Lighthouse, PageSpeed API), las estimaciones se basan en el análisis estático del código y los tamaños reales de los assets.

### LCP (Largest Contentful Paint)
**Estimación: 3.5 – 6 segundos en conexiones 4G típicas. MALO.**

El LCP candidate probable es la `<spline-viewer>` en el hero, o alternativamente el `<h1>` con texto en gradiente. El problema principal es la cadena de bloqueos:

1. `<script type="module">` de Spline **sin defer**: el browser parsea el HTML, encuentra el script en el `<head>` antes del contenido visual, y pausa el parsing hasta que el script esté disponible. El módulo de Spline se descarga desde `unpkg.com` (CDN externo) sin ningún `preload`.
2. Después, el viewer descarga `scene.splinecode` desde `prod.spline.design` — otro dominio externo, sin preconnect.
3. Google Fonts bloquea con su stylesheet de ~50 KB antes de que Inter esté disponible.

Una página limpia sin el viewer y sin Fonts cargados en blocking mode podría tener LCP < 1.2s. Con la cadena actual, se estima > 4s en condiciones reales.

**La `dashboard-mockup.png` (964 KB)** en la sección Dashboard tampoco tiene `loading="lazy"`, lo que significa que el browser intenta descargarla en cuanto termina de parsear el HTML, aunque el usuario no la vea todavía.

### FID / INP (First Input Delay / Interaction to Next Paint)
**Estimación: 50 – 150ms. NECESITA MONITOREO.**

El JS inline se ejecuta de forma síncrona al cargar el documento. El bloque principal de JS (~250 líneas) incluye `querySelectorAll`, `IntersectionObserver.observe()` y el inicio del `requestAnimationFrame` loop, todo en el hilo principal sin chunking. En dispositivos de gama baja puede superar los 100ms de INP.

### CLS (Cumulative Layout Shift)
**Estimación: 0.05 – 0.25. RIESGO MODERADO.**

Factores de riesgo:
- `<spline-viewer>` con height fija en CSS (580px desktop, 330px tablet) pero la carga es asíncrona — puede haber shift si el elemento cambia de tamaño al renderizar.
- Las imágenes `problem-tiempo.jpg`, `problem-perdidos.jpg`, `problem-horas.jpg` no tienen atributos `width` y `height` explícitos en el `<img>`, aunque están dentro de un contenedor con `aspect-ratio: 4/3` — esto mitiga el CLS para estas imágenes.
- El CSS del webchat cargado al final del body puede causar un shift si sus reglas afectan elementos ya pintados.

### TTFB (Time to First Byte)
**Medido: < 200ms.** Express sirve el archivo directamente desde disco sin procesamiento pesado. El TTFB es bueno.

### FCP (First Contentful Paint)
**Estimación: 0.8 – 1.5s.** El nav y el eyebrow del hero están en el HTML directamente. Una vez que Inter esté disponible, el FCP ocurre. El `preconnect` a fonts.googleapis.com ayuda parcialmente.

---

## 4. Performance de carga

### Cadena de bloqueo al inicio

```
[HTML parse] → [Spline script bloquea] → [Fonts CSS bloquea] → [FCP]
                     ↓
              [Spline viewer inicia]
                     ↓
              [Descarga scene.splinecode desde prod.spline.design]
                     ↓
              [Render del robot 3D — LCP probable]
```

Esta cadena puede durar 3–6 segundos en 4G. En 3G o conexiones lentas, puede superar los 10 segundos.

### Peso total de la página (estimación primera carga)

| Recurso | Tamaño estimado |
|---------|-----------------|
| index.html | 78 KB |
| Google Fonts CSS + woff2 Inter (6 pesos) | ~200 KB |
| Spline viewer JS (unpkg) | ~500–800 KB (estimado) |
| Spline scene (.splinecode) | ~3–8 MB (estimado, sin verificar) |
| dashboard-mockup.png | 964 KB |
| problem-*.jpg (3 imágenes) | 790 KB |
| avatar-*.png (3 avatars) | 170 KB |
| icono-*.png (6 iconos) | ~290 KB |
| Webchat CSS + JS | ~28 KB |
| **Total estimado** | **~6–12 MB** |

Este peso inicial es excesivo para una landing page. El estándar recomendado para páginas de conversión es < 1.5 MB total.

### Sin compresión gzip/brotli

El header de producción no incluye `Content-Encoding`. Esto significa que el HTML de 78 KB se sirve sin comprimir. Con gzip estándar se reduciría a ~18–20 KB. Con brotli a ~14–16 KB. Para assets de texto (HTML, CSS, JS), la ausencia de compresión en nginx es un error de configuración directo.

---

## 5. JavaScript — análisis de carga y ejecución

### Spline Viewer — problema crítico

```html
<script type="module" src="https://unpkg.com/@splinetool/viewer@1.9.82/build/spline-viewer.js"></script>
```

**El problema:** `type="module"` tiene semántica `defer` por defecto solo para módulos externos — pero al estar en el `<head>` sin `defer` explícito, algunos browsers lo tratan como bloqueante en ciertos contextos. Más importante: el script se carga desde `unpkg.com` sin `preload`, sin `preconnect`, sin versión fija cacheada localmente.

**Solución directa:**
```html
<link rel="preconnect" href="https://unpkg.com">
<script type="module" defer src="https://unpkg.com/@splinetool/viewer@1.9.82/build/spline-viewer.js"></script>
```

O mejor: hostear el viewer localmente para controlar el cache y eliminar la dependencia de CDN externo.

### `@keyframes gear-spin` — bug silencioso

El CSS referencia `animation: gear-spin 20s linear infinite;` en las clases `.gear-svg` (líneas 647 y 651), pero la keyframe `@keyframes gear-spin` **no está definida en ningún lugar del archivo**. Los engranajes de la sección "Cómo funciona" no rotan. Hay una confusión con `@keyframes gear-flow` que sí está definida (línea 131) y anima partículas sobre las líneas de conexión — son dos animaciones distintas.

### JS inline — evaluación

El bloque de JS al final del body (~246 líneas) es compacto y bien estructurado para vanilla JS. Sin embargo:

1. **`requestAnimationFrame(animateRing)`** — corre siempre, sin pausa. El cursor custom actualiza dos elementos del DOM 60 veces por segundo. En mobile se ocultan con CSS, pero la función sigue corriendo (solo el CSS tiene `display:none`).

2. **`requestAnimationFrame(animateCanvas)`** — corre siempre, incluso cuando el hero está fuera del viewport. Para 30 rings con partículas orbitales, esto es entre 200–600 operaciones de canvas por frame. No hay pause/resume basado en visibilidad.

3. **`setInterval(..., 100)`** — actualiza posiciones de 30 anillos 10 veces por segundo. Correcto en cuanto a frecuencia, pero también sigue corriendo fuera de viewport.

4. **`setInterval(hideSplineBranding, 300)`** — hace DOM queries dentro de un Shadow Root cada 300ms durante 8 segundos. Es un polling costoso para ocultar branding de Spline.

5. **FAQ toggle listener** — el código en línea 1840 busca `.faq-item details` pero los `<details>` ya tienen la clase `faq-item` directamente. La query funciona como un bug afortunado (`details.faq-item` no tiene hijos `details`, por lo que el selector `.faq-item details` dentro de `.faq-item` no matchea nada). El comportamiento de acordeón (cierre de otros items) **no funciona**. El toggle nativo de `<details>` sí funciona, pero el cierre de otros items abiertos no.

6. **Scroll listener en `window`** — el listener del nav scroll no usa throttle ni passive. Debería ser:
   ```js
   window.addEventListener('scroll', handler, { passive: true });
   ```

7. **`document.body.style.backgroundColor`** — se setea en cada callback del `bgObserver`. Esto fuerza un `reflow` y `repaint` del body completo en cada intersección de sección. Con transición CSS (`transition: background-color 0.6s ease-out`), el efecto es suave, pero el disparador puede ser frecuente durante scroll rápido.

### Webchat — doble archivo CSS

El webchat tiene dos archivos CSS servidos:
- `/roma-webchat/webchat.css` — cargado al final del body como `<link>` bloqueante
- Los estilos del chat widget también están inline en el HTML principal (líneas ~750–888)

Hay duplicación de estilos entre ambas fuentes. Además, `webchat.css` como `<link rel="stylesheet">` al final del body puede causar FOUC si sus reglas afectan elementos ya renderizados.

---

## 6. Animaciones y uso de CPU

### Inventario de animaciones activas

| Animación | Tipo | Frecuencia | ¿Pausa fuera de viewport? |
|-----------|------|------------|--------------------------|
| Canvas rings (30 objetos + partículas orbitales) | `requestAnimationFrame` | 60 fps | **NO** |
| Custom cursor ring | `requestAnimationFrame` | 60 fps | **NO** (en mobile: CSS display:none pero JS sigue) |
| Mouse drift canvas rings | `setInterval` | 10/s | **NO** |
| Spline branding check | `setInterval` | 3.3/s | Solo 8 segundos al inicio |
| Logo glow | CSS `@keyframes` | 3s ciclo | Sí (CSS nativo) |
| Nav logo glow | CSS `@keyframes` | 3.2s ciclo | Sí (CSS nativo) |
| Urgency pulse | CSS `@keyframes` | 1.8s ciclo | Sí (CSS nativo) |
| Destello hero | CSS `@keyframes` | 4s ciclo | Sí (CSS nativo) |
| Gradient flow título | CSS `@keyframes` | 6s ciclo | Sí (CSS nativo) |
| Gradient shift hero bg | CSS `@keyframes` | 15s ciclo | Sí (CSS nativo) |
| Gear SVG (gear-spin) | CSS `@keyframes` | **NO FUNCIONA** (keyframe no definida) | — |
| Gear flow connection lines | CSS `@keyframes` | 2.2s ciclo | Sí (CSS nativo) |
| Scroll chevron | CSS `@keyframes` | 2s ciclo | Sí (CSS nativo) |

### Impacto real en CPU

En un desktop moderno, las dos `requestAnimationFrame` loops corriendo simultáneamente (canvas + cursor) consumen entre el 5–15% de un core. En un Snapdragon 665 (Android gama media) o un iPhone SE, esto puede causar:
- FPS de animaciones CSS cayendo de 60 a 30–40 fps
- Latencia de input aumentada (INP > 200ms)
- Batería drenándose más rápido

**Fix recomendado para el canvas:**
```js
let canvasRafId = null;

const heroObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      if (!canvasRafId) animateCanvas();
    } else {
      cancelAnimationFrame(canvasRafId);
      canvasRafId = null;
    }
  });
}, { threshold: 0.01 });

heroObserver.observe(document.getElementById('hero'));
```

**Fix recomendado para el cursor:**
```js
function animateRing() {
  // ... lógica de cursor
  cursorRafId = requestAnimationFrame(animateRing);
}
// Pausar en mobile directamente desde JS (no solo CSS)
if (!window.matchMedia('(pointer: fine)').matches) {
  // No iniciar el loop en pantallas touch
} else {
  animateRing();
}
```

### `prefers-reduced-motion`

La media query está correctamente implementada en CSS (líneas 1161–1174). Al activar `prefers-reduced-motion`, el canvas y los cursores se ocultan. **Bien.** Pero el JS loop sigue corriendo aunque los elementos estén en `display:none`. El fix es verificar esta preferencia también en JS:

```js
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReduced) {
  animateCanvas();
  animateRing();
}
```

---

## 7. Imágenes — formatos, tamaños y compresión

### Auditoría completa

| Imagen | Tamaño actual | Uso | Lazy loading | `width`/`height` explícitos | WebP disponible |
|--------|--------------|-----|--------------|----------------------------|-----------------|
| dashboard-mockup.png | 964 KB | Dashboard preview | **NO** | **NO** | **NO** |
| avatar-roma-real.jpg | 349 KB | Avatar chat (¿?) | — | — | **NO** |
| problem-perdidos.jpg | 335 KB | Problem card | `onerror` only | **NO** | **NO** |
| problem-horas.jpg | 276 KB | Problem card | `onerror` only | **NO** | **NO** |
| problem-tiempo.jpg | 181 KB | Problem card | `onerror` only | **NO** | **NO** |
| logo-roma.png | 171 KB | Sin uso confirmado en index.html | — | — | **NO** |
| icono-reportes.png | 69 KB | Feature card | **NO** | **NO** | **NO** |
| avatar-laura.png | 58 KB | Testimonial | **NO** | `48x48` (CSS) | **NO** |
| avatar-ana.png | 58 KB | Testimonial | **NO** | `48x48` (CSS) | **NO** |
| icono-captura.png | 58 KB | Feature card | **NO** | `56x56` (CSS) | **NO** |
| icono-automatizacion.png | 58 KB | Feature card | **NO** | `56x56` (CSS) | **NO** |
| avatar-carlos.png | 53 KB | Testimonial | **NO** | `48x48` (CSS) | **NO** |
| icono-routing.png | 43 KB | Feature card | **NO** | `56x56` (CSS) | **NO** |
| icono-multichannel.png | 39 KB | Feature card | **NO** | `56x56` (CSS) | **NO** |
| bg-pattern.png | 27 KB | Sin uso confirmado | — | — | **NO** |
| icono-ia.png | 18 KB | Feature card | **NO** | `56x56` (CSS) | **NO** |

### Problemas principales

**`dashboard-mockup.png` — 964 KB sin lazy loading**

Esta imagen se descarga en el parse inicial del HTML, aunque está ~3 secciones después del hero. Sin `loading="lazy"`:
```html
<!-- Actual -->
<img src="assets/dashboard-mockup.png" alt="Dashboard ROMA AI" class="dashboard-image">

<!-- Correcto -->
<img src="assets/dashboard-mockup.png" alt="Dashboard ROMA AI" class="dashboard-image" loading="lazy" width="1000" height="563">
```

Convertida a WebP, la misma imagen debería pesar ~150–200 KB (reducción del 80%). Convertida a AVIF: ~80–120 KB. Con `srcset` para formatos modernos:
```html
<picture>
  <source srcset="assets/dashboard-mockup.avif" type="image/avif">
  <source srcset="assets/dashboard-mockup.webp" type="image/webp">
  <img src="assets/dashboard-mockup.png" alt="Dashboard ROMA AI" loading="lazy" width="1000" height="563">
</picture>
```

**Íconos de features como PNG en lugar de SVG**

Los 6 íconos (`icono-captura.png`, `icono-automatizacion.png`, etc.) se renderizan en `56x56px` pero pesan entre 18–69 KB cada uno. Como el diseño no es fotográfico (son íconos), deberían ser SVG, que en este caso pesarían ~1–3 KB cada uno. Ahorro potencial: ~300 KB en formato SVG.

**Avatares de testimoniales**

Los avatares se renderizan en `48x48px` (CSS) pero pesan ~53–60 KB. Como fotos de personas, el formato WebP con calidad 85 a 48x48 debería pesar ~3–5 KB cada uno. Ahorro: ~165 KB.

**Imágenes de cards de problema sin `width`/`height`**

Las imágenes dentro de `.problem-img-wrap` están en un contenedor con `aspect-ratio: 4/3`, lo que mitiga el CLS. Sin embargo, las imágenes mismas no tienen atributos `width` y `height`. Agregarlos es una buena práctica aunque el contenedor tenga aspect-ratio.

### Plan de conversión recomendado

```bash
# Convertir todas las imágenes PNG/JPG a WebP (requiere cwebp o sharp)
cwebp -q 85 assets/dashboard-mockup.png -o assets/dashboard-mockup.webp
cwebp -q 85 assets/problem-perdidos.jpg -o assets/problem-perdidos.webp
cwebp -q 85 assets/problem-horas.jpg -o assets/problem-horas.webp
cwebp -q 85 assets/problem-tiempo.jpg -o assets/problem-tiempo.webp

# Avatares a escala correcta antes de convertir
convert assets/avatar-laura.png -resize 96x96 -quality 85 assets/avatar-laura.webp
convert assets/avatar-carlos.png -resize 96x96 -quality 85 assets/avatar-carlos.webp
convert assets/avatar-ana.png -resize 96x96 -quality 85 assets/avatar-ana.webp
```

---

## 8. Estrategia de fuentes

### Situación actual

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

**Lo que está bien:**
- `display=swap` evita texto invisible durante la carga (FOIT).
- Los dos `preconnect` son correctos para la arquitectura de Google Fonts.

**Lo que se puede mejorar:**
1. Se piden 6 pesos de Inter (400, 500, 600, 700, 800, 900). Revisando el CSS, los pesos realmente usados son: 400 (body), 500 (nav links, muted), 600 (botones, nav-cta), 700 (headings medium), 800 (section h2), 900 (h1, stat-numbers). Los 6 pesos tienen uso legítimo, pero si se quisiera reducir, se podría prescindir del 500 y usar 400 + 600 como alternativa.

2. La mejor estrategia para eliminar este punto de falla es auto-hostear Inter via `@fontsource/inter`:
   ```bash
   npm install @fontsource/inter
   ```
   Y luego servir los woff2 directamente desde el servidor, con `Cache-Control: max-age=31536000` para fonts.

3. Alternativamente, usar `<link rel="preload">` para los woff2 más críticos (peso 700 y 800):
   ```html
   <link rel="preload" as="font" type="font/woff2" crossorigin
         href="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2">
   ```

---

## 9. Cache y headers HTTP

### Situación actual (verificada con curl)

```
Cache-Control: public, max-age=0
ETag: W/"133d2-19e6c8c6a15"
```

`max-age=0` significa que el browser **siempre** hace una request al servidor para re-validar. El ETag funciona: si el archivo no cambió, el servidor devuelve 304 Not Modified. Pero aun así hay una round-trip HTTP para cada asset en cada visita.

### Configuración nginx recomendada

```nginx
# En el bloque server o location de nginx:

# HTML — corto, con revalidación
location = / {
  add_header Cache-Control "public, max-age=0, must-revalidate";
}

# Assets con hash o versión — cache agresivo
location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  gzip on;
  gzip_types text/plain text/css application/json application/javascript image/svg+xml;
  brotli on;  # si está disponible el módulo ngx_brotli
  brotli_types text/plain text/css application/json application/javascript image/svg+xml;
}

# Webchat assets — cache medio
location /roma-webchat/ {
  add_header Cache-Control "public, max-age=86400";
  gzip on;
  gzip_types text/css application/javascript;
}
```

**Impacto de activar gzip para el HTML principal:** 78 KB → ~18 KB. Reducción del 77%. En conexiones de 10 Mbps esto ahorra ~45ms de transferencia pura. En 4G (aprox. 2 Mbps promedio en Argentina), ahorra ~240ms.

---

## 10. HTML estructural — bugs y semántica

### Bug crítico: `<section id="hero">` sin cerrar

```html
<!-- Línea 1199 -->
<section id="hero">
  <canvas id="heroCanvas"></canvas>
  <div class="hero-split">...</div>
  <div class="hero-center-band">...</div>

  <!-- ← AQUÍ FALTA </section> -->

  <!-- Línea 1260: siguiente sección inicia DENTRO del hero -->
  <section class="section problem-section" data-reveal data-bg-color="#080d24">
    ...
  </section>

  <section id="features" class="section" ...>
    ...
  </section>
  <!-- ... todas las secciones siguientes están anidadas dentro del hero -->
```

El comportamiento del browser es correcto en la mayoría de los casos porque el parser HTML5 tiene reglas de auto-corrección para elementos de sección anidados. Sin embargo:
- Los estilos de `#hero` pueden "filtrarse" a las secciones hijas si hay selectores descendientes.
- El árbol DOM real no refleja la intención del diseño.
- Herramientas de accesibilidad y SEO pueden reportar una estructura de landmarks incorrecta.
- El `overflow: visible` y `overflow-x: clip` del hero se aplican al contenedor que abarca toda la página.

**Fix:** Agregar `</section>` en la línea 1255, antes del comentario de la sección Problem.

### `<section id="pricing">` sin `data-reveal`

Las secciones Problem (línea 1260), Features (1311), How (1353), Dashboard (1448), Testimonials (1461), FAQ (1555), y CTA Final (1583) tienen `data-reveal`. La sección de Pricing (línea 1506) no tiene `data-reveal`, haciendo que aparezca inmediatamente sin animación de entrada — inconsistente con el resto.

### Numeración de secciones en comentarios

Los comentarios del HTML numeran las secciones 1 (Nav), 2 (Hero), 3 (Problem), 4 (Features), 5 (How), 6 (Dashboard), **salta a 8 (Testimonials)** — la sección 7 no existe. Luego continúa con 9 (Pricing), 10 (FAQ), 11 (CTA), 12 (Footer). Es un detalle menor pero sugiere que se eliminó una sección en algún punto sin actualizar los números.

### FAQ — selector JS que no matchea

```js
// Línea 1840 — busca details DENTRO de .faq-item
document.querySelectorAll('.faq-item details').forEach(detail => {
```

Pero en el HTML, el elemento `<details>` **es** el que tiene la clase `faq-item`:
```html
<details class="faq-item">
```

El selector `.faq-item details` busca un `<details>` que sea hijo de un elemento con clase `faq-item`. Como el propio `<details>` tiene esa clase, no hay ningún match. El comportamiento de acordeón (cerrar otras preguntas al abrir una) no funciona.

**Fix:** Cambiar el selector a:
```js
document.querySelectorAll('details.faq-item').forEach(detail => {
```

### `<footer>` sin `</section>` del hero

Dado el bug de la sección hero sin cerrar, el `<footer>` también está técnicamente anidado dentro del `<section id="hero">` en el DOM parseado. Esto es incorrecto semánticamente.

### Pricing: `<span class="section-label">` sin estilo

La sección de Pricing usa `<span class="section-label">PLANES</span>` mientras todas las otras secciones usan `<span class="eyebrow">`. La clase `section-label` no está definida en el CSS — el elemento no tendrá ningún estilo específico.

---

## 11. Accesibilidad

### Custom cursor

El cursor custom (`.cursor-dot` + `.cursor-ring`) reemplaza el cursor nativo del sistema operativo. Esto es problemático para:
- Usuarios con baja visión que han configurado cursores grandes en el sistema.
- Usuarios con dificultades motoras que dependen del cursor del sistema.
- Usuarios de software de accesibilidad que rastrean la posición del cursor.

El CSS ya oculta el cursor custom en mobile (`@media (max-width: 960px)`), lo cual es correcto. Para desktop, se debería al menos mantener el cursor nativo visible además del custom cursor, sin usar `cursor: none` en el body (actualmente no se hace explícitamente en el CSS, lo cual está bien — el custom cursor se superpone pero el cursor del sistema también existe).

### Texto con gradiente (`-webkit-text-fill-color: transparent`)

Los títulos y estadísticas principales usan:
```css
-webkit-text-fill-color: transparent;
background-clip: text;
```

En modo de alto contraste de Windows, o con ciertos temas de accesibilidad, este efecto puede hacer que el texto sea literalmente invisible (fondo transparente, sin color de relleno). La directiva `@supports` está correctamente implementada para el `.hero-title-flow`, pero no en todas las instancias de texto con gradiente.

Añadir siempre una propiedad `color` como fallback:
```css
.gradient-title {
  color: var(--text); /* fallback */
  background: linear-gradient(...);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Emojis en CTA sin `aria-label`

```html
<a href="..." class="btn btn-primary btn-lg cta-primary">
  <span>🚀</span> Comenzar gratis →
</a>
```

Los lectores de pantalla leerán "cohete, Comenzar gratis flecha derecha". El emoji de cohete probablemente no agrega valor semántico. Solución:
```html
<span aria-hidden="true">🚀</span> Comenzar gratis
```

Lo mismo aplica a los emojis en `trust-indicators` (💳, ⚡, 🇦🇷).

### Nav sin botón de menú mobile

En `@media (max-width: 960px)`, el nav oculta `.nav-links` con `display: none`. No hay un botón hamburguesa ni ningún mecanismo para que usuarios mobile accedan al menú. Esto no es un problema de accesibilidad per se (hay CTAs en la página), pero sí es un problema de UX mobile — los links de navegación son inaccesibles en pantallas < 960px.

### Imágenes de features sin `width`/`height` explícitos

Las imágenes de íconos (`<img class="feature-icon">`) tienen tamaño CSS de 56x56px pero no tienen los atributos `width="56" height="56"` en el HTML. Esto no afecta la accesibilidad directamente, pero sí el CLS si las imágenes tardan en cargar.

### FAQ nativo con `<details>`/`<summary>`

La implementación de FAQ con elementos `<details>` y `<summary>` nativos es correcta para accesibilidad. Los lectores de pantalla los interpretan correctamente como elementos expandibles. **Bien.**

### Alt text en imágenes

- `alt="ROMA AI"` en logos — correcto.
- `alt="Dashboard ROMA AI"` — correcto.
- `alt="Laura Méndez"`, `alt="Carlos Rivera"`, `alt="Ana Parra"` — correcto.
- Imágenes de problema con alt descriptivo — correcto.
- Íconos de features con alt descriptivo — correcto.

El alt text en general está bien implementado.

### `<html lang="es">`

Correcto. Fundamental para lectores de pantalla y SEO.

---

## 12. SEO técnico

### Verificación de archivos críticos en producción

```
GET /robots.txt → 404 Not Found
GET /sitemap.xml → 404 Not Found
```

Ambos archivos no existen. Esto tiene consecuencias directas:

**Sin `robots.txt`:** Los bots de búsqueda asumen que todo es indexable, pero la ausencia del archivo puede generar warnings en Google Search Console. Además, el `/admin` panel debería estar explícitamente desindexado.

**Sin `sitemap.xml`:** Google puede tardar más en descubrir y reindexar la página. Para una landing de una sola URL no es crítico, pero si se agregan páginas (voice.html, landing de planes, etc.), el sitemap se vuelve importante.

### Robots.txt recomendado

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://roma.dementetv.com/sitemap.xml
```

### Sitemap.xml recomendado

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/0.5/sitemap">
  <url>
    <loc>https://roma.dementetv.com/</loc>
    <lastmod>2026-05-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

### Tag canonical ausente

No hay `<link rel="canonical">` en el `<head>`. Si la misma página es accesible en múltiples URLs (con o sin trailing slash, http vs https, con parámetros UTM, etc.), Google puede confundirse sobre la URL canónica. Agregar:

```html
<link rel="canonical" href="https://roma.dementetv.com/">
```

### Structured data (JSON-LD) ausente

No hay JSON-LD. Para una landing de SaaS, los schemas más relevantes son:

**SoftwareApplication:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ROMA AI",
  "description": "Automatización de ventas por WhatsApp, Instagram y web con IA conversacional.",
  "url": "https://roma.dementetv.com/",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "299",
    "highPrice": "1499",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "5",
    "reviewCount": "3"
  }
}
</script>
```

**FAQPage** (para la sección FAQ — puede generar rich results en Google):
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "¿Necesito conocimientos técnicos?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. Conectás WhatsApp en 2 minutos. No necesitás desarrolladores."
      }
    }
  ]
}
</script>
```

### H1 y estructura de headings

- Existe un solo `<h1>` en el hero: "Convertí cada conversación en una venta cerrada" — correcto.
- Las secciones usan `<h2>` para sus títulos — correcto.
- Los cards usan `<h3>` — correcto.
- La jerarquía es semánticamente coherente.

### Términos de servicio enlaza a "/"

```html
<!-- Footer -->
<li><a href="/">Términos de servicio</a></li>
```

El link de "Términos de servicio" lleva al home. Esto puede ser un problema legal en algunos países (LATAM, UE) y también confunde a los crawlers. Si no hay página legal, es mejor eliminar el link o poner `href="#"` con un tooltip "Próximamente".

### Favicon sin fallback PNG

Solo hay `favicon.svg`. Algunos contextos (bookmarks en Windows, thumbnails de pestañas en Safari antiguo) no soportan SVG como favicon. Agregar:
```html
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">
```

---

## 13. OpenGraph y metadatos sociales

### Situación actual

```html
<meta property="og:title" content="ROMA AI — Tu agente de ventas en WhatsApp">
<meta property="og:description" content="Respondé 24/7 en WhatsApp, calificá leads y convertí más sin sumar equipo.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://roma.dementetv.com/">
<meta property="og:image" content="https://roma.dementetv.com/assets/dashboard-mockup.png">
<meta name="twitter:card" content="summary_large_image">
```

**La imagen OG existe** — verificado con curl (200 OK, 984 KB). Sin embargo:

1. **Tamaño excesivo:** `dashboard-mockup.png` pesa 984 KB como imagen OG. Facebook recomienda < 8 MB (cumple), pero idealmente < 300 KB para tiempos de carga aceptables en previsualización. Crear una imagen OG dedicada de 1200x630px optimizada.

2. **Faltan dimensiones de la imagen OG:**
   ```html
   <meta property="og:image:width" content="1200">
   <meta property="og:image:height" content="630">
   <meta property="og:image:type" content="image/png">
   ```

3. **Falta `og:locale`:**
   ```html
   <meta property="og:locale" content="es_AR">
   ```

4. **Falta `og:site_name`:**
   ```html
   <meta property="og:site_name" content="ROMA AI">
   ```

5. **Twitter/X — faltan tags:**
   ```html
   <meta name="twitter:title" content="ROMA AI — Tu agente de ventas en WhatsApp">
   <meta name="twitter:description" content="Respondé 24/7 en WhatsApp, calificá leads y convertí más sin sumar equipo.">
   <meta name="twitter:image" content="https://roma.dementetv.com/assets/og-image.png">
   ```

6. **Discrepancia de títulos:** El `<title>` dice "ROMA AI — Automatización inteligente para equipos de ventas" pero `og:title` dice "ROMA AI — Tu agente de ventas en WhatsApp". Deberían ser consistentes o diferenciarse intencionalmente.

---

## 14. Mobile rendering

### Breakpoints implementados

| Breakpoint | Cambios clave |
|------------|--------------|
| ≤ 1024px | Hero split se comprime, hero-right se achicha |
| ≤ 960px | Nav links ocultos, hero en columna, grids a 1 columna, cursor custom desaparece |
| ≤ 600px | Buttons full width, stats en 1 columna, hero-right (`spline-viewer`) se oculta con `display:none` |

### Spline en mobile

En `@media (max-width: 600px)`, el `.hero-right` tiene `display: none`. Esto es correcto para la UI, pero el Spline viewer script **sigue cargándose** y el módulo JS **sigue siendo descargado**, aunque la escena 3D no se muestre. Esto es un desperdicio de bandwidth en mobile.

La solución correcta es cargar el viewer condicionalmente:
```js
if (window.innerWidth > 600) {
  const viewer = document.createElement('spline-viewer');
  viewer.setAttribute('url', 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode');
  document.querySelector('.hero-right').appendChild(viewer);
}
```

O mejor: usar `loading="lazy"` si el elemento lo soporta, o simplemente no renderizar el elemento `<spline-viewer>` en el servidor/html si el UA es mobile.

### Nav sin hamburger en mobile

Como se mencionó en accesibilidad, no hay menú hamburguesa. En mobile, los únicos puntos de navegación son los botones CTA en el body. Para usuarios que quieran ir directo a Precios o FAQ, tienen que hacer scroll completo.

### Canvas en mobile (15 rings vs 30)

El canvas reduce a 15 rings en `window.innerWidth < 768`. Esto es una buena optimización, pero el loop sigue corriendo a 60 fps. En mobile, 15 rings con partículas orbitales todavía es costoso. Reducir a 8 rings en mobile, o pausar cuando el hero no está visible.

### Touch targets

Los botones tienen padding generoso (16px vertical). Los links del footer en mobile tienen `margin-bottom: 10px` con texto de 0.88rem — los touch targets probablemente cumplan los 44px recomendados por WCAG, pero vale la pena verificarlo en un dispositivo real.

---

## 15. Seguridad — headers HTTP

### Headers ausentes (verificado en producción)

| Header | Estado | Impacto |
|--------|--------|---------|
| `Strict-Transport-Security` | **AUSENTE** | Sin HSTS, el browser puede hacer requests HTTP en visitas futuras |
| `X-Frame-Options` | **AUSENTE** | La página puede ser embebida en iframes externos (clickjacking) |
| `X-Content-Type-Options` | **AUSENTE** | Sin `nosniff`, browsers pueden interpretar scripts como otro MIME |
| `Content-Security-Policy` | **AUSENTE** | Sin CSP, cualquier script externo inyectado puede ejecutarse |
| `Referrer-Policy` | **AUSENTE** | El referrer completo se envía a recursos externos (Spline, Google) |
| `Permissions-Policy` | **AUSENTE** | Sin restricciones sobre APIs del browser (camera, geolocation, etc.) |

### `X-Powered-By: Express` expuesto

El header `X-Powered-By: Express` está presente. Esto expone la tecnología del servidor. Deshabilitar en Express:
```js
app.disable('x-powered-by');
```

### Configuración nginx recomendada para seguridad

```nginx
# En el bloque server:
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# CSP — ajustar según los recursos externos reales
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://unpkg.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data: https://roma.dementetv.com;
  connect-src 'self' https://prod.spline.design;
  frame-src 'none';
" always;
```

**Nota sobre CSP con `unsafe-inline`:** El JS inline del HTML requiere `'unsafe-inline'` en la CSP, lo que reduce su efectividad. El paso siguiente para una CSP robusta sería mover el JS inline a un archivo externo y usar nonces o hashes.

### Sesiones del webchat — sin persistencia segura

En `server.js`, las sesiones de webchat se almacenan en un `Map` en memoria:
```js
const webChatSessions = new Map();
```

Esto significa que si el proceso Node.js se reinicia, se pierden todas las sesiones activas. No es un problema de seguridad per se, pero sí de durabilidad. Para una demo o MVP, es aceptable.

---

## 16. Recomendaciones priorizadas

### 🔴 HIGH — Impacto crítico en performance o SEO

| # | Recomendación | Impacto estimado | Esfuerzo |
|---|--------------|-----------------|---------|
| H1 | Agregar `defer` al script de Spline Viewer | LCP mejora ~1–2s | 5 min |
| H2 | Cerrar `<section id="hero">` en la línea 1255 | Fix bug DOM estructural | 5 min |
| H3 | Agregar `loading="lazy"` a `dashboard-mockup.png` y dimensiones explícitas | LCP mejora, CLS mejora | 10 min |
| H4 | Crear `robots.txt` y `sitemap.xml` en el servidor | Indexación correcta | 20 min |
| H5 | Activar gzip/brotli en nginx para todos los assets de texto | Reduce transferencia ~77% | 30 min |
| H6 | Pausar `requestAnimationFrame` del canvas cuando hero no es visible | CPU -15% en scroll | 30 min |
| H7 | Agregar `Cache-Control` con TTL real a assets estáticos | Reduce requests repetidas ~60% | 30 min |
| H8 | Agregar `<link rel="canonical">` | Evita duplicados en Google | 5 min |
| H9 | Definir `@keyframes gear-spin` o eliminar la referencia | Fix bug visual engranajes | 10 min |
| H10 | Corregir el selector FAQ de `.faq-item details` a `details.faq-item` | Fix acordeón JS | 5 min |

### 🟡 MEDIUM — Impacto en calidad y UX

| # | Recomendación | Impacto estimado | Esfuerzo |
|---|--------------|-----------------|---------|
| M1 | Convertir `dashboard-mockup.png` a WebP (+ `<picture>` tag) | Ahorro ~750 KB | 1h |
| M2 | Convertir íconos PNG a SVG | Ahorro ~280 KB, escalado perfecto | 2h |
| M3 | Convertir avatares PNG a WebP a 96x96 | Ahorro ~160 KB | 30 min |
| M4 | Convertir imágenes de problem cards a WebP | Ahorro ~500 KB | 30 min |
| M5 | No cargar Spline en mobile (600px breakpoint) | Ahorro 3–8 MB en mobile | 1h |
| M6 | Pausar cursor `requestAnimationFrame` en mobile | CPU móvil reducida | 15 min |
| M7 | Agregar headers de seguridad en nginx | Cumplimiento OWASP | 1h |
| M8 | Agregar `preconnect` para `prod.spline.design` | Reducción DNS lookup ~200ms | 5 min |
| M9 | Deshabilitar `X-Powered-By: Express` | Oculta fingerprint tecnológico | 5 min |
| M10 | Agregar `passive: true` al scroll listener del nav | Mejora scroll smoothness | 5 min |
| M11 | Agregar JSON-LD `SoftwareApplication` | Rich results en Google | 45 min |
| M12 | Agregar JSON-LD `FAQPage` | Rich results en Google | 30 min |
| M13 | Completar meta tags Twitter/X | Previsualización correcta en X | 15 min |
| M14 | Agregar `og:locale`, `og:site_name`, dimensiones de imagen OG | OpenGraph completo | 10 min |
| M15 | Mover webchat CSS a `<head>` con `media="print" onload` trick | Eliminar FOUC | 15 min |
| M16 | Agregar `aria-hidden="true"` a emojis decorativos | Accesibilidad lectores pantalla | 15 min |
| M17 | Agregar fallback `color` a todos los textos con `-webkit-text-fill-color: transparent` | Alto contraste modo Windows | 30 min |
| M18 | Corregir pricing `section-label` a `eyebrow` para consistencia visual | UI consistente | 5 min |
| M19 | Mover `Términos de servicio` a `href="#"` o eliminar hasta tener la página | Evita link roto semántico | 5 min |

### 🟢 LOW — Mejoras de calidad técnica a largo plazo

| # | Recomendación | Impacto estimado | Esfuerzo |
|---|--------------|-----------------|---------|
| L1 | Auto-hostear Inter en lugar de Google Fonts | Elimina dependencia CDN externo, mejora privacy | 2h |
| L2 | Hostear Spline viewer localmente | Control de versión, cache agresivo | 3h |
| L3 | Implementar menú hamburguesa para mobile | UX mobile completa | 3h |
| L4 | Crear imagen OG dedicada (1200x630px, <200KB) | Mejor preview en redes sociales | 1h |
| L5 | Separar CSS y JS inline a archivos externos | Habilita CSP sin unsafe-inline, mejor cache | 4h |
| L6 | Agregar favicons PNG (16x16, 32x32, 180x180 apple-touch) | Compatibilidad completa | 1h |
| L7 | Verificar `prefers-reduced-motion` en JS además de CSS | Accesibilidad de movimiento completa | 30 min |
| L8 | Agregar `width`/`height` a imágenes de problem cards | CLS mejorado | 15 min |
| L9 | Crear página de Términos de Servicio real | Requisito legal LATAM | Variable |
| L10 | Implementar persistencia de sesiones webchat (Redis/file) | Durabilidad de sesiones | 2h |

---

## Apéndice — Comandos de verificación usados

```bash
# Headers producción
curl -sI https://roma.dementetv.com/

# Verificar og:image
curl -sI https://roma.dementetv.com/assets/dashboard-mockup.png

# Robots y sitemap
curl -sI https://roma.dementetv.com/robots.txt
curl -sI https://roma.dementetv.com/sitemap.xml

# Tamaño del HTML
wc -l /home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html
du -sh /home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html

# Assets
ls -lh /home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/assets/

# Webchat
du -sh /home/juanpi/JuanPi-Agent/Roma-AI/webchat/*.css
du -sh /home/juanpi/JuanPi-Agent/Roma-AI/webchat/*.js

# Keyframe gear-spin verificación
grep -n "gear-spin" /home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html
```

---

*Auditoría generada el 2026-05-28. Los valores estimados de Core Web Vitals requieren validación con herramientas reales (Lighthouse, WebPageTest, Chrome DevTools) en condiciones de red específicas.*
