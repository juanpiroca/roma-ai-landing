# ROMA AI — Auditoría Visual y de UX

## Landing Page · Versión 3.0

**Archivo auditado:** `index.html` (1903 líneas)
**Fecha de auditoría:** 2026-05-28
**Auditor:** UI/UX Review — ROMA AI

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Bug estructural crítico — HTML roto](#2-bug-estructural-crítico--html-roto)
3. [Design System — análisis de variables](#3-design-system--análisis-de-variables)
4. [Sección NAV](#4-sección-nav)
5. [Sección HERO](#5-sección-hero)
6. [Sección PROBLEM](#6-sección-problem)
7. [Sección FEATURES](#7-sección-features)
8. [Sección HOW IT WORKS](#8-sección-how-it-works)
9. [Sección DASHBOARD PREVIEW](#9-sección-dashboard-preview)
10. [Sección TESTIMONIALS](#10-sección-testimonials)
11. [Sección PRICING](#11-sección-pricing)
12. [Sección FAQ](#12-sección-faq)
13. [Sección CTA FINAL](#13-sección-cta-final)
14. [FOOTER](#14-footer)
15. [Sistema de Animaciones y Motion Design](#15-sistema-de-animaciones-y-motion-design)
16. [Responsive y Breakpoints](#16-responsive-y-breakpoints)
17. [Tipografía y Legibilidad](#17-tipografía-y-legibilidad)
18. [Accesibilidad](#18-accesibilidad)
19. [Ritmo Visual y Coherencia](#19-ritmo-visual-y-coherencia)
20. [Comparación con referencias premium](#20-comparación-con-referencias-premium)
21. [Ranking de prioridades de mejora](#21-ranking-de-prioridades-de-mejora)

---

## 1. Resumen ejecutivo

ROMA AI tiene una landing con personalidad visual fuerte: dark mode profundo, gradientes coherentes en azul eléctrico y verde menta, y varias capas de motion design que construyen una sensación de producto "tech de alto nivel". El design system está bien definido en variables CSS y se respeta en la mayoría de las secciones.

Sin embargo, hay un **bug estructural de HTML que rompe el árbol del DOM** y afecta a todo el documento. Además, existen inconsistencias significativas entre secciones (la sección Pricing usa selectores de clase que no existen), el footer está notablemente incompleto, y hay redundancia de código CSS que indica que el archivo creció sin refactoring.

**Fortalezas principales:**

- Design system consistente con variables CSS bien nombradas
- Jerarquía de color bien ejecutada (primary azul, accent verde, purple como tercero)
- Animaciones de scroll reveal con IntersectionObserver bien implementadas
- Canvas de anillos orbitales es un diferenciador visual genuino
- Custom cursor con lag elastic es un detalle de alta calidad
- Responsive básico funcional con tres breakpoints

**Debilidades principales:**

- Bug crítico: `<section id="hero">` nunca se cierra (línea 1199–1606)
- Sección Pricing usa `.section-label` en lugar de `.eyebrow` — clase no definida
- Footer con columnas Recursos (1 link), Empresa (1 link) y Legal (1 link roto)
- Duplicación de reglas CSS: `.hero-buttons`, `.hero-stats`, `.hero-marquee` definidos dos veces
- Iconos de features en PNG (no vectoriales) — escalan mal en Retina / HiDPI
- Spline 3D se carga desde CDN externo como módulo — bloquea render en conexiones lentas
- Falta `aria-label` en casi todos los elementos interactivos
- Contraste de `.text-dim (#64748b)` sobre fondos oscuros está en el límite WCAG

---

## 2. Bug estructural crítico — HTML roto

### Diagnóstico

La etiqueta de apertura `<section id="hero">` está en la línea 1199 y **jamás se cierra**. Las secciones siguientes (Problem, Features, How It Works, Dashboard, Testimonials, Pricing, FAQ, CTA Final) se abren con sus propias etiquetas `<section>` pero están anidadas dentro del hero abierto. El árbol DOM resultante es:

```
section#hero
  canvas#heroCanvas
  div.hero-split
  div.hero-center-band
  section.problem-section    ← ANIDADA ILEGALMENTE DENTRO DE #hero
  section#features           ← ANIDADA ILEGALMENTE DENTRO DE #hero
  section#how                ← ANIDADA ILEGALMENTE DENTRO DE #hero
  section#dashboard          ← ANIDADA ILEGALMENTE DENTRO DE #hero
  section#testimonials       ← ANIDADA ILEGALMENTE DENTRO DE #hero
  section#pricing            ← ANIDADA ILEGALMENTE DENTRO DE #hero
  section#faq                ← ANIDADA ILEGALMENTE DENTRO DE #hero
  section#cta-final          ← ANIDADA ILEGALMENTE DENTRO DE #hero
footer#footer
```

### Impacto

- Los navegadores modernos (Chrome, Firefox, Safari) hacen "error recovery" automático y pueden renderizar visualmente correcto, pero el comportamiento real depende del motor de layout.
- `#hero` tiene `overflow: visible` y `overflow-x: clip`. Con las secciones anidadas, esto puede generar clipping inesperado en algunos viewports.
- Los IntersectionObservers sobre secciones hijas del hero pueden producir resultados incorrectos porque el umbral de intersección se calcula respecto al viewport, no al contenedor padre.
- El `data-bg-color` dinámico en el body puede tener timing incorrecto si el browser agrupa las secciones bajo el hero.
- Los lectores de pantalla (NVDA, JAWS, VoiceOver) pueden confundirse con la jerarquía semántica incorrecta.

### Corrección requerida

Agregar `</section>` antes de la línea 1257 (donde empieza el comentario `<!-- 3. PROBLEM SECTION -->`):

```html
  </div> <!-- cierra hero-center-band -->
</section> <!-- CIERRE CORRECTO DEL HERO -->

<!-- ============================= -->
<!-- 3. PROBLEM SECTION -->
```

**Prioridad: CRÍTICA. Corregir antes de cualquier mejora visual.**

---

## 3. Design System — análisis de variables

### Paleta de colores

El sistema de colores es coherente y bien pensado:

| Variable | Valor | Rol |
| --- | --- | --- |
| `--bg-deep` | `#050816` | Fondo base máximo oscuro |
| `--bg-surface` | `#0a0f26` | Superficies ligeramente levantadas |
| `--bg-card` | `#111836` | Cards y contenedores |
| `--bg-card-hover` | `#161f47` | Estados hover de cards |
| `--primary` | `#4f6ef7` | Azul eléctrico — acción principal |
| `--accent` | `#00e5bf` | Verde menta — diferenciador |
| `--purple` | `#a78bfa` | Violeta — tercer acento |
| `--gold` | `#fbbf24` | Dorado — estrellas y métricas |
| `--text` | `#f1f5f9` | Texto principal |
| `--text-muted` | `#94a3b8` | Texto secundario |
| `--text-dim` | `#64748b` | Texto terciario / labels |

**Problema detectado:** `--text-dim: #64748b` sobre `--bg-card: #111836` tiene una ratio de contraste de aproximadamente 3.8:1, que pasa el mínimo AA para texto normal (4.5:1) solo marginalmente en texto grande. Para texto pequeño (0.78rem, 0.7rem) como los `.stat-label` y `.eyebrow`, este contraste **no pasa WCAG AA**.

**Recomendación:** Elevar `--text-dim` a `#7a8fa8` o usar `--text-muted` en contextos de texto pequeño.

### Radios de borde

La escala de radios es correcta y usada consistentemente:

- `--radius: 20px` — cards principales
- `--radius-sm: 12px` — elementos secundarios
- `--radius-pill: 999px` — botones y badges

El único problema es que `.pricing-badge` usa `border-radius: 6px` hardcodeado (no usa la variable `--radius-sm`), rompiendo la coherencia del sistema.

### Easing

`--easing: cubic-bezier(0.16, 1, 0.3, 1)` es un spring easing con overshooting mínimo. Es elegante y se siente "iOS-like". Bien elegido. Sin embargo, se usa mezclado con `ease`, `ease-out`, y `ease-in-out` en diferentes lugares sin consistencia.

**Recomendación:** Agregar `--easing-out: cubic-bezier(0, 0, 0.2, 1)` y usar el easing custom solo en transiciones con identidad (hover de cards, aparecer de elementos). Todas las transiciones de color y opacidad deberían usar `ease` simple.

---

## 4. Sección NAV

### Estado actual

**Layout:** Fixed, `backdrop-filter: blur(20px) saturate(180%)`, centrado en contenedor `max-width: 1200px`.

**Padding:** `16px 40px` en estado normal → `10px 40px` en estado `.scrolled`. El padding lateral de `40px` es apropiado para desktop.

**Logo:** SVG `footer-logo-negative.svg` usado tanto en el nav como en el footer. Esto es correcto para la identidad visual, pero el `alt` del logo dice "ROMA AI" sin especificar que es el logo de navegación — aceptable pero mejorable.

**Links:** 4 ítems (`Funcionalidades`, `Cómo funciona`, `Casos reales`, `Precios`). Font-size `0.88rem`, color `--text-muted`. El underline animado con `::after` y `scaleX(0 → 1)` es un detalle premium.

**CTA:** `.nav-cta` es un `<a>` con `!important` en `color: #fff` — signo de que hubo conflictos de especificidad que se parchearon.

**Hover hover del nav-cta:** `background: #3d5ce0` hardcodeado, no usa variable CSS. Debería ser calculado como `color-mix(in srgb, var(--primary) 80%, black)` o una variable `--primary-dark`.

### Problemas identificados

1. **Sin hamburger menu para mobile.** En `max-width: 960px`, `.nav-links { display: none; }` — los links desaparecen y no hay menú alternativo. Solo queda el CTA button. El usuario móvil **no puede navegar a secciones internas** (Features, How it Works, etc.) sin hacer scroll manual.

2. **`nav.scrolled` solo reduce padding vertical** de 16px a 10px. El cambio es perceptible pero no hay reducción del logo ni del background blur — ambas opciones agregarían sofisticación.

3. **El logo tiene doble animación `logo-glow`:** La etiqueta `.nav-logo` anima con `logo-glow 3s` y la imagen `.nav-logo-img` anima con `logo-glow 3.2s`. Son dos animaciones en cadena en el mismo elemento visual — el efecto se acumula y produce un glow excesivo.

4. **No hay `aria-label` en el nav** ni `role="navigation"` explícito.

5. **Falta el link "Inicio" / "/" en la navegación** — los usuarios de keyboard o lectores de pantalla no tienen acceso al home desde el nav.

### Recomendaciones

- Implementar un hamburger menu básico para `max-width: 960px`. Con el design system existente, un drawer lateral con `backdrop-filter` y animación slide-in sería coherente con la estética.
- Unificar la animación del logo: aplicar `logo-glow` solo al `<img>`, no al contenedor padre.
- Agregar `aria-label="Navegación principal"` al `<nav>`.
- Crear variable `--primary-dark: #3d5ce0` para el hover del CTA.

---

## 5. Sección HERO

### Estado actual

**Layout:** `min-height: 100vh`, `display: flex`, `flex-direction: column`, `padding: 150px 24px 80px`. Internamente se divide en dos zonas: `hero-split` (izquierda + derecha) y `hero-center-band` (estadísticas + marquee + botones).

**El split izquierdo/derecho:**

- `.hero-left`: `flex: 0 1 640px`, `max-width: 640px`, `text-align: left`
- `.hero-right`: `flex: 0 0 560px`, `max-width: 560px`, `height: 580px`, `position: absolute; right: -30px; top: -30px`

El hero-right tiene `position: absolute` pero el hero-split tiene `display: flex`. Esto crea una ambigüedad: el `absolute` saca al hero-right del flujo, pero el hero-split no tiene `position: relative` explícito (aunque hereda de `#hero` que sí lo tiene). El resultado visual parece funcionar, pero la superposición con `right: -30px` hace que el 3D sobresalga del contenedor — intencional, pero frágil.

**Jerarquía tipográfica:**

- Eyebrow: `0.8rem`, `font-weight: 700`, uppercase, letterspacing 0.06em — correcto
- H1: `clamp(2.6rem, 7vw, 5rem)`, `font-weight: 900`, `line-height: 1.04` — excelente escala fluid
- Párrafo: `1.18rem`, `color: var(--text-muted)`, `line-height: 1.7` — buena legibilidad

**Problema de texto duplicado:** El archivo define `#hero .hero-left p` dos veces:

Primera definición (línea 263-266):

```css
#hero .hero-left p {
  font-size: 1.18rem; color: var(--text-muted);
  max-width: 650px; margin: 0 0 36px; line-height: 1.7; text-align: left;
}
```

Segunda definición (línea 357-360):

```css
#hero .hero-left p {
  font-size: 1.18rem; color: var(--text-muted);
  max-width: 650px; margin: 0 auto 36px; line-height: 1.7; text-align: center;
}
```

La segunda sobreescribe a la primera. El resultado: `text-align: center` y `margin: 0 auto 36px`. Pero `.hero-left` tiene `text-align: left` y `align-items: flex-start`. Hay un conflicto de intención — el párrafo no está centrado porque el contenedor es left-aligned.

**Stats:** `.hero-stats` tiene `gap: 48px` en desktop — generoso pero visualmente balanceado para 4 stats. Los `.stat-number` en `2.4rem` con gradiente `accent → primary` son llamativos y legibles.

**Marquee estático:** La `.marquee-track` tiene `animation: none` — el marquee no se mueve. Existen los `::before` y `::after` con fade lateral (que imitan un marquee animado) pero el contenido está estático. Esto tiene sentido como decision de performance pero los fades de borde crean una expectativa visual de movimiento que no ocurre.

**Scroll indicator:** Bien ejecutado, `position: absolute; bottom: 30px`. El `.scroll-mouse::after` con la animación `scroll-chevron` es un detalle correcto. Sin embargo, el scroll indicator queda visualmente enterrado bajo el `hero-center-band` en pantallas cortas (< 800px de alto) porque el hero tiene mucho contenido vertical.

### Canvas de anillos

El sistema de `Ring` en el canvas es sofisticado:

- 30 rings en desktop, 15 en mobile
- Cada ring tiene orbital particles (8-16 puntos)
- Los rings crecen, se reinician aleatoriamente
- Mouse influence suave con `dx * 0.0001` — muy sutil pero presente
- Los colores alternan entre `79,110,247` (azul) y `0,229,191` (verde)

La opacidad está limitada a `0.05 + Math.random() * 0.1` (máximo 0.15), lo que mantiene el efecto muy sutil. Bien calibrado para no competir con el contenido.

**Problema de performance:** El `setInterval` en la línea 1819 para la mouse drift se ejecuta cada 100ms independientemente de si el mouse se movió. Debería usar una flag para saltear si `mouseCanvas.x === null` o si la posición no cambió.

### Spline 3D

El viewer de Spline se carga como un módulo ES6 desde CDN externo (`unpkg.com`). Esto significa:

1. **Bloqueo de red:** Si unpkg.com es lento o está caído, el 3D nunca aparece.
2. **No hay fallback:** Si `spline-viewer` no carga, el espacio derecho del hero queda vacío con solo los efectos de destello pero sin el robot.
3. **Performance:** El paquete Spline tiene un peso significativo (~500KB+ al cargar la escena).
4. **Privacy:** El viewer hace requests a `prod.spline.design` — no hay notice de terceros.

**El script de hide branding** (líneas 1669-1694) usa `setInterval` de 300ms por hasta 8 segundos para remover elementos del shadow DOM de Spline. Esto es un hack necesario pero frágil — si Spline actualiza su estructura interna, deja de funcionar.

### Problemas de copy

- El H1 dice "Convertí cada conversación en una venta cerrada" — muy bueno, específico y orientado a resultado.
- El párrafo tiene `max-width: 650px` pero el `.hero-left` tiene `max-width: 640px` — el párrafo nunca llegará a 650px. Esta limitación es inofensiva pero indica copy-paste sin revisión.
- El `.eyebrow` del hero usa un estilo diferente al `.eyebrow` global: background `rgba(255,255,255,0.04)` vs `rgba(79,110,247,0.08)`. Dos estilos de eyebrow coexisten — inconsistencia menor pero visible.

### Recomendaciones HERO

1. **Corregir el bug de cierre de `</section>`** (ya cubierto en sección 2).
2. **Agregar fallback para Spline:** Un `<img>` con la imagen del robot (si existe) dentro de un `<noscript>` o mostrable si el viewer no carga en 3 segundos.
3. **Unificar las dos definiciones de `#hero .hero-left p`** en una sola.
4. **Implementar el marquee animado** o eliminar los fades laterales si el marquee va a ser estático.
5. **El H1 debería tener `aria-label`** o al menos no usar solo `span.hero-title-flow` sin contexto para lectores de pantalla — el `background-clip: text` con `color: transparent` es invisible para tecnologías de asistencia que dependen de color.

---

## 6. Sección PROBLEM

### Estado actual

**Background:** `#080d24` con grid de líneas `rgba(79,110,247,0.03)` en patrón de 40x40px. El patrón es muy sutil — casi invisible. En Linear.app, los grids de fondo tienen opacidad 0.05-0.08 y son más perceptibles. Considerar elevar a `0.05`.

**Cards:** Grid de 3 columnas, `gap: 28px`. Cada card tiene imagen editorial + cuerpo de texto.

**Imagen + texto:** El layout magazine es bueno — imagen arriba (aspect-ratio 4/3), texto abajo. El `linear-gradient(to top, var(--bg-card), transparent)` como overlay en la imagen funciona bien para la transición.

**Stats grandes:** `.problem-stat` tiene `font-size: 4rem`, `font-weight: 900`, con gradiente `#ef4444 → #f97316`. El uso del rojo para los stats de problema es semánticamente correcto y crea contraste emocional con el azul/verde de las secciones de solución.

**Problema de alineación:** El `h3` "Semanales que tu equipo pierde en tareas manuales" (tercera card) no empieza con el sujeto — el stat dice "20h" y el H3 dice "Semanales que...". La lectura natural sería "20h semanales que tu equipo pierde..." pero visualmente se lee el stat (20h) y luego el H3 sin sujeto. La primera card ("Tus leads esperan 4 horas tu respuesta") repite el número del stat en el copy — redundante.

**Animaciones de las cards:** Usan `slideInUp 0.7s var(--easing) forwards; opacity: 0` hardcodeado en el CSS, con `animation-delay` por nth-child. Esto significa que las cards se animan al cargar la página, **sin esperar a que el usuario haga scroll**. Si la sección Problem está below the fold (que lo está), las animaciones ya terminaron cuando el usuario llega. El scroll reveal `[data-reveal]` está en el `<section>` pero no en las cards individuales.

**Recomendaciones:**

1. Mover las animaciones de las cards (`slideInUp`) al sistema de IntersectionObserver existente en vez de usar delays CSS fijos.
2. Revisar el copy del H3 en la tercera card — debe tener sujeto propio o reformularse para fluir bien después del stat.
3. Elevar la opacidad del grid de fondo de `0.03` a `0.05`.

---

## 7. Sección FEATURES

### Estado actual

**Background:** `linear-gradient(180deg, #071029 0%, #0a1433 100%)` — buena transición suave desde el problem section.

**Grid:** `repeat(3, 1fr)`, `gap: 24px`. 6 cards en 2 filas de 3.

**Cards:** Padding `40px 32px`, altura determinada por contenido. Las cards tienen mouse tracking para el efecto radial con `--mouse-x` y `--mouse-y` — un detalle premium.

**Iconos:** **PNG de 56x56px.** Este es un problema en displays HiDPI (Retina, OLED 4K). Los PNGs se pixelan. En Linear, Vercel y Stripe todos los iconos son SVG. La inconsistencia visual entre el logo vectorial (SVG) y los iconos de features (PNG) es notable.

Assets afectados:

- `assets/icono-captura.png`
- `assets/icono-automatizacion.png`
- `assets/icono-reportes.png`
- `assets/icono-routing.png`
- `assets/icono-multichannel.png`
- `assets/icono-ia.png`

**Animación de cards:** Mismo problema que en Problem — `slideInUp` CSS sin IntersectionObserver. Las cards se habrán animado antes de que el usuario baje a la sección.

**Hover effect:** El efecto radial con `background: radial-gradient(circle at var(--mouse-x,50%) var(--mouse-y,50%), rgba(79,110,247,0.08) 0%, transparent 60%)` en `::after` es sofisticado. Sin embargo, la intensidad de `0.08` es muy sutil — en pantallas con gamma bajo puede ser invisible. Considerar `0.12`.

**Ausencia de CTA interno:** Las feature cards no tienen ningún link o acción. En Linear y Vercel, las cards de features a veces tienen un "Aprender más →" o llevan a una página de feature individual. Para una landing de producto, puede ser apropiado agregar un link a la sección HOW o directamente al CTA.

**Recomendaciones:**

1. Convertir los 6 iconos PNG a SVG (inline o como archivo). Como mínimo, usar `srcset` con versiones 2x.
2. Conectar las animaciones de cards al IntersectionObserver.
3. Aumentar el radial hover de `0.08` a `0.12`.
4. Considerar un link sutil "Ver cómo funciona" al final de la grid.

---

## 8. Sección HOW IT WORKS

### Estado actual

**Background:** `linear-gradient(180deg, #0a1433 0%, #0c1738 100%)` con dots grid `radial-gradient(rgba(79,110,247,0.04) 1px, transparent 1px)` de 30x30px.

**Gear system:** 3 engranajes SVG en grid de 3 columnas. Cada engranaje tiene:

- SVG externo que gira con `gear-spin` animation (20s linear infinite)
- Número en el centro con `gear-content`
- Información debajo con `gear-info`
- Connection lines animadas entre engranajes

**Los SVGs de los engranajes** están inline en el HTML — son complejos (múltiples `<rect>`, `<circle>`, `<path>`). Esto engorda el HTML pero es correcto para el rendimiento (sin HTTP request adicional).

**Bug visual:** Las `connection-line` tienen su `left` calculado con:

```css
.connection-line.line-1 { left: calc(16.666% + 58px); width: calc(33.333% - 116px); }
.connection-line.line-2 { left: calc(50% + 58px); width: calc(33.333% - 116px); }
```

Esto asume que el `.gear-system` tiene `position: relative`, lo cual es correcto. Sin embargo, el `.gear-system` tiene `align-items: start` y `justify-items: center`, lo que puede hacer que el `top: 58px` de las líneas no se alinee exactamente con el centro del engranaje en todas las resoluciones si la altura de los engranajes varía.

**El flowing animation** en `connection-line::after` (`gear-flow 2.2s linear infinite`) es un buen detalle que muestra "flujo de datos" entre etapas. La luz blanca se mueve de izquierda a derecha, lo que refuerza la narrativa de proceso secuencial.

**Heading con doble gradiente:** `<h2 class="gradient-title">Así de fácil empezás a <em class="gradient-subtitle">capturar más leads</em></h2>`. El `h2` tiene `gradient-title` (blanco → accent → primary → purple) y el `<em>` tiene `gradient-subtitle` (accent → primary → purple). El resultado es que el `<em>` tiene un estilo diferente dentro del título — puede funcionar pero visualmente se ve como un "gradiente dentro de gradiente" que compite con el del H2. Además, el `<em>` dentro de un elemento con `background-clip: text` podría no funcionar en todos los browsers como se espera (el gradiente del H2 ya colorea ese texto; el del em lo sobreescribe).

**Sección de Steps (no usada):** El CSS define `.steps`, `.step`, `.step-number` (líneas 600-622) pero en el HTML no existe ningún elemento con clase `.steps` — solo existe el `.gear-system`. El CSS de steps es código muerto.

**Recomendaciones:**

1. Eliminar las reglas CSS de `.steps`, `.step`, `.step-number` (código muerto — 23 líneas).
2. Revisar la alineación de las `connection-line` en viewports intermedios (1024px-1200px).
3. Simplificar el heading — elegir un solo estilo de gradiente para el H2, sin conflicto en el `<em>`.

---

## 9. Sección DASHBOARD PREVIEW

### Estado actual

**Estructura:** La sección más simple del documento. Un `<section id="dashboard">` con un `<div class="container">`, eyebrow, H2, y un `<div class="dashboard-wrap">` con una `<img>`.

**Dashboard wrap:** `max-width: 1000px`, borde con `var(--border)`, `box-shadow: 0 40px 100px rgba(0,0,0,0.5)`. El efecto de tilt 3D en mousemove está bien implementado (líneas 1851-1862): hasta `±5deg` en X y `±8deg` en Y.

**Problemas:**

1. La imagen `dashboard-mockup.png` no tiene `width` y `height` atributos explícitos — esto causa layout shift (CLS) mientras carga.
2. No hay `loading="lazy"` en la imagen — se carga junto con todo lo demás aunque está below the fold.
3. El H2 dice "Control total en tiempo real" — frase muy genérica. Versiones premium como Linear usan copy más específico que nombra la capacidad exacta.
4. No hay texto descriptivo debajo del H2 — la sección pasa directo de heading a imagen. Una línea de descripción contextualiza qué muestra el dashboard.

**El `dashboard-wrap` tiene `transform-style: preserve-3d; perspective: 1000px`** — pero la perspectiva debería estar en el contenedor padre para funcionar correctamente en 3D transforms. Aplicarla en el mismo elemento es redundante con el `perspective()` que se aplica inline en el JavaScript.

**Recomendaciones:**

1. Agregar `width` y `height` a la `<img>` del dashboard.
2. Agregar `loading="lazy"` a la imagen.
3. Agregar una línea de descripción: "Métricas en vivo, historial de conversaciones y reportes IA en una sola vista."
4. Mover `perspective` al wrapper padre.

---

## 10. Sección TESTIMONIALS

### Estado actual

**Grid:** `repeat(3, 1fr)`, `gap: 24px`. 3 cards en fila.

**Estructura de cada card:** Estrellas → Quote con borde izquierdo → Avatar + nombre + cargo.

**Estrellas:** Usan caracteres Unicode `★★★★★` — simple y funcional. La animación `star-pop` está definida en CSS pero su `animation-delay` no está configurado por estrella individual — se aplica a todas las stars por igual (el selector `.testimonial-stars .star` tiene `animation: star-pop 0.3s var(--easing) backwards`). El efecto es que todas las estrellas aparecen simultáneamente, no una por una como sería más efectivo.

**Quote border-left:** `border-left: 2px solid var(--primary)` con `padding-left: 16px`. Es un detalle clásico y funcional. El color `--primary` (azul) sobre el fondo de card oscuro tiene buen contraste.

**Avatares:** PNG de 48x48px con `border-radius: 50%`. Tamaño apropiado. Sin embargo, no hay `width` y `height` explícitos en los `<img>` — posible layout shift.

**Problema de credibilidad:** Las tres testimoniales tienen exactamente el mismo rating (5 estrellas) y sus cargos son genéricos ("Directora de Ventas, Clínica Premium", "CEO, GrowthTech", "Head of Growth, InnovaCorp"). No hay logos de empresas, no hay links a casos de estudio, no hay fechas. En las referencias premium (Stripe, Linear) los testimoniales incluyen foto real + empresa + logo de empresa.

**La tercera card se oculta en `max-width: 960px`:** `#testimonials .testimonial-card:nth-child(3) { display: none; }`. Esto reduce el social proof disponible en tablet. Considerar un scroll horizontal o carousel en tablet en vez de ocultar.

**Copy de la tercera testimonial:** "Pasamos de perder el 40% de los leads de WhatsApp a capturar el 92%." — Este es el testimonial más poderoso (datos específicos de mejora). Está en la tercera card que se oculta en mobile y tablet. Debería ser la segunda o primera card.

**Recomendaciones:**

1. Reorganizar los testimoniales poniendo el más específico y con datos primero.
2. Agregar logos de empresa (aunque sean genéricos o inventados con coherencia al brand).
3. Implementar animación escalonada en las estrellas (delay de 0.1s por estrella).
4. Agregar `width="48" height="48"` a los avatares.
5. En tablet, usar grid de 2 columnas en lugar de ocultar la tercera card.

---

## 11. Sección PRICING

### Estado actual

**Bug de clase:** La sección usa `<span class="section-label">PLANES</span>` (línea 1508) pero la clase `.section-label` **no está definida en ninguna parte del CSS**. Este span no recibe ningún estilo — se renderiza como texto plano sin el tratamiento visual de eyebrow. Debería ser `<span class="eyebrow">`.

**H2 sin clase de gradiente:** `<h2>Elegí el plan que acompaña tu <em>crecimiento</em></h2>` no tiene `class="gradient-title"` a diferencia de todas las demás secciones. El H2 se renderiza en blanco plano, rompiendo la coherencia visual del documento donde todos los H2 de sección tienen gradiente.

**Grid:** `repeat(auto-fit, minmax(300px, 1fr))` — buena elección responsive. Con 3 cards de mínimo 300px, en un contenedor de 1200px queda un gap apropiado.

**Card Pro (featured):**

- `border-color: rgba(0, 229, 191, 0.5)` — diferenciación con el acento verde
- `background: rgba(0, 229, 191, 0.05)` — tinte muy sutil
- Badge `.pricing-badge` con `border-radius: 6px` (hardcodeado, no usa variables)

**El card Pro no tiene ningún tratamiento adicional** más allá del color del borde y el fondo levemente distinto. En Stripe y Linear, el plan "popular" tiene escala ligeramente mayor, shadow más pronunciada, y a veces una línea de acento superior. La diferenciación actual es sutil — un usuario casual podría no notar que Pro es el plan destacado.

**Precios:**

- Base: $299/mes
- Pro: $599/mes
- Enterprise: $1,499/mes

**La card Enterprise** usa `.btn-secondary` (borde blanco semitransparente) en lugar de `.btn-primary`. Esto es correcto — el botón de Enterprise debe ser menos urgente. Bien pensado.

**Problemas adicionales:**

1. No hay período de trial mencionado en los cards (el hero dice "14 días gratis" pero pricing no lo menciona).
2. No hay billing anual / mensual toggle — en SaaS premium es esperado.
3. Las features de cada plan usan `li::before { content: '✓ '; }` — simple pero efectivo.
4. La card Enterprise oculta en `max-width: 600px` con `#pricing .pricing-card:nth-child(n+2) { display: none; }`. En mobile solo se ve Base. La card Pro (la más vendida) está oculta en mobile.

**Recomendaciones:**

1. **Crítico:** Cambiar `section-label` a `eyebrow`.
2. **Crítico:** Agregar `class="gradient-title"` al H2 de pricing.
3. Mencionar "14 días gratis" en la card Pro.
4. Dar más prominencia visual a la card Pro: `transform: scale(1.03)` en desktop, shadow más visible.
5. En mobile, mostrar la card Pro por default (es la más relevante) y ocultar Base, no Enterprise.
6. Usar `--radius-sm` en `.pricing-badge` en lugar de `6px`.

---

## 12. Sección FAQ

### Estado actual

**Implementación:** `<details>/<summary>` nativo — accesible por default, sin JS necesario. Buena decisión.

**Estilos:** El `summary::after { content: '+' }` que rota 45° al abrir es una solución elegante. El color del `+` cambia de `--text-dim` a `--accent` al abrir — buen feedback visual.

**El FAQ tiene solo 4 preguntas.** Para una landing SaaS típica, 6-8 preguntas es el estándar. Faltan preguntas relevantes como:

- ¿Qué pasa con mis datos de WhatsApp?
- ¿Funciona con WhatsApp Business API o solo con la app?
- ¿Puedo integrar con mi CRM actual?
- ¿Hay setup fee?

**El JS de FAQ** (líneas 1840-1849) cierra automáticamente el accordion anterior al abrir uno nuevo. Está bien implementado pero escucha en `details` dentro de `.faq-item`, cuando `.faq-item` ya es el `<details>` — el selector es `document.querySelectorAll('.faq-item details')` lo que busca un `<details>` dentro de `.faq-item`. Si `.faq-item` es el `<details>`, el selector no encuentra nada. **El accordion automático no funciona.**

El selector correcto sería:

```javascript
document.querySelectorAll('details.faq-item').forEach(detail => {
  detail.addEventListener('toggle', () => {
```

**Sin animación de expand/collapse.** El `<details>` nativo no anima la apertura del contenido. Las referencias premium (Linear, Stripe) animan la altura del `<p>` interior con `max-height` o la Web Animations API.

**Recomendaciones:**

1. **Corregir el selector JS del accordion:** `.faq-item details` → `details.faq-item`.
2. Agregar 4 preguntas más relevantes para el buyer típico de ROMA.
3. Implementar animación de apertura con `@keyframes` o la API de animaciones.

---

## 13. Sección CTA FINAL

### Estado actual

**Duplicación de reglas CSS:** `.cta-section` está definida **dos veces** en el CSS:

Primera definición (líneas 893-944):

```css
.cta-section {
  background: linear-gradient(180deg, #0a0e1a 0%, #050816 100%);
  position: relative; overflow: hidden;
}
```

Segunda definición (líneas 1027-1031):

```css
.cta-section {
  padding: 140px 24px; text-align: center;
  background: linear-gradient(135deg, #0a1030 0%, #051014 100%);
}
```

El padding `140px 24px` viene de la segunda definición y sobreescribe el `padding: 110px 24px` que vendría de `.section`. El fondo también difiere: `180deg` vs `135deg` y colores ligeramente distintos. Solo aplica el segundo por cascade. **Hay reglas de la primera definición que no tienen efecto** (`position: relative; overflow: hidden`) — aunque sí se aplican en la práctica porque no son sobreescritas.

**El urgency indicator:** El `.urgency-pulse` (dot verde pulsante) con "+2,847 empresas ya están automatizando sus ventas" es un buen elemento de social proof y urgencia. La animación `pulse 1.8s infinite` con `box-shadow` expandiéndose imita el latido — efectivo.

**Trust indicators:** Usan emojis (💳 ⚡ 🇦🇷) en lugar de iconos SVG. Los emojis son inconsistentes entre sistemas operativos (look diferente en iOS vs Android vs Windows).

**El botón CTA tiene un emoji 🚀** directamente en el texto del link. Mismo problema de inconsistencia cross-platform.

**Recomendaciones:**

1. Unificar las dos definiciones de `.cta-section` en una sola.
2. Reemplazar emojis en trust indicators y botón por pequeños iconos SVG inline.
3. Agregar `aria-label` al botón principal del CTA.

---

## 14. FOOTER

### Estado actual

**Layout:** 4 columnas en grid `repeat(4, 1fr)`, `gap: 50px`. Brand centrado arriba.

**Problema principal — Contenido incompleto:**

| Columna | Items |
| --- | --- |
| Producto | 4 links (Funcionalidades, Cómo funciona, Precios, Comenzar gratis) |
| Recursos | **1 link** (WhatsApp) |
| Empresa | **1 link** (Contacto) |
| Legal | **1 link** (Términos de servicio) |

Las columnas "Recursos", "Empresa" y "Legal" están prácticamente vacías. En una landing SaaS profesional, estas columnas deberían tener:

- **Recursos:** Blog, Documentación, API Docs, Casos de éxito, Changelog
- **Empresa:** Sobre nosotros, Equipo, Inversores, Careers, Press
- **Legal:** Términos de servicio, Política de privacidad, Cookies, GDPR/CCPA

**El link de Términos de servicio va a "/"** (la página de inicio) en lugar de a una página real. Esto puede ser un problema legal en mercados donde la política de privacidad es obligatoria (Argentina, UE).

**El footer-brand** tiene `text-align: center` con `display: flex; flex-direction: column; align-items: center`. El logo y el párrafo están centrados. Pero las columnas debajo tienen texto alineado a la izquierda. Esta combinación centrado/izquierda es coherente con el patrón estándar de footers SaaS.

**El copyright dice "© 2026 ROMA AI"** — la fecha está actualizada correctamente.

**El `footer-logo` tiene `animation: logo-glow 3.2s`** — el footer no debería tener animaciones continuas de alta visibilidad. Es distractor en una zona que debería ser "quieta".

**`nav-logo` class en el footer brand link:** `<a href="/" class="nav-logo footer-brand-link">` — la clase `.nav-logo` del nav se reutiliza en el footer, lo que aplica `animation: logo-glow 3s` al elemento padre además del logo hijo.

**Recomendaciones:**

1. **Urgente desde perspectiva legal:** Crear páginas reales de Términos y Política de Privacidad.
2. Agregar Política de Privacidad en la columna Legal como mínimo.
3. Completar las columnas Recursos y Empresa con al menos 3 links cada una.
4. Eliminar la animación `logo-glow` del footer — usar un logo estático.
5. Quitar la clase `.nav-logo` del link del footer — crear una clase independiente `.footer-brand-link`.

---

## 15. Sistema de Animaciones y Motion Design

### Inventario completo de animaciones

| Animación | Duración | Uso | Evaluación |
| --- | --- | --- | --- |
| `blurFadeIn` | 0.8s | Hero elements | Excelente |
| `gradient-shift` | 15s | Hero::before | Bien calibrada |
| `pulse-dot` | 2s | Chat status dot | Correcto |
| `marquee-scroll` | definida pero no usada | — | Código muerto |
| `float` | 2s (50% keyframe) | Definida, no usada | Código muerto |
| `gradient-flow` | 6s | Hero title | Vistosa, podría ser más sutil |
| `border-glow-pulse` | definida, no usada | — | Código muerto |
| `star-pop` | 0.3s | Testimonial stars | Bien |
| `scroll-chevron` | 2s | Scroll indicator | Bien |
| `pulse` | 1.8s | Urgency dot | Bien |
| `logo-glow` | 3s / 3.2s | Nav + footer logo | Excesivo en footer |
| `gear-flow` | 2.2s | Connection lines | Excelente |
| `slideInUp` | 0.7s | Cards (CSS-only, sin observer) | Incorrecto (no espera scroll) |
| `scaleInUp` | 0.7s | Pricing cards | Mismo problema |
| `scaleIn` | 0.7s | Definida, usada en .card-enter | Parcialmente usada |
| `gear-spin` | 20s | Engranajes SVG | Bien |
| `destello-pulse` | 4s | Hero right circle | Bien |
| `destello-ring-pulse` | 4s | Hero right ring | Bien |
| `destello-ring-outer` | 4s | Hero right outer ring | Bien |
| `section-enter` | 0.8s | `.section-enter` class | Clase definida, no usada en HTML |

### Problemas sistémicos

**1. Animaciones CSS sin IntersectionObserver:**
Las cards de Problem, Features, y Testimonials tienen `animation: slideInUp` y `opacity: 0` con `animation-delay` hardcodeados. Esto anima inmediatamente al cargar la página. Para contenido below the fold, las animaciones terminan antes de que el usuario llegue, y el usuario ve el estado final (visible) sin haber visto la animación de entrada. El efecto "wow" se pierde completamente.

**Solución:** Reemplazar el enfoque CSS-only por el patrón ya establecido en el documento:

```css
.card-reveal { opacity: 0; transform: translateY(30px); transition: opacity 0.7s var(--easing), transform 0.7s var(--easing); }
.card-reveal.visible { opacity: 1; transform: translateY(0); }
```

Y observar con el IntersectionObserver existente.

**2. Animaciones definidas y no usadas (código muerto):**

- `@keyframes marquee-scroll` — la marquee-track tiene `animation: none`
- `@keyframes float` — no hay ningún elemento con `animation: float`
- `@keyframes border-glow-pulse` — no hay uso en el HTML
- `.section-enter` — la clase existe pero ningún elemento la tiene en el HTML
- `.card-enter` — ídem

Esto suma aproximadamente 40 líneas de CSS que no tienen efecto y confunden al leer el código.

**3. Performance del canvas:**
El `requestAnimationFrame(animateCanvas)` corre indefinidamente aunque el usuario haya hecho scroll fuera del hero. Se puede optimizar con un IntersectionObserver sobre el `<section id="hero">` para pausar el canvas cuando no es visible:

```javascript
const heroSection = document.getElementById('hero');
const visibilityObserver = new IntersectionObserver(([entry]) => {
  isVisible = entry.isIntersecting;
});
visibilityObserver.observe(heroSection);

function animateCanvas() {
  if (isVisible) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rings.forEach(r => { r.update(); r.draw(ctx); });
  }
  requestAnimationFrame(animateCanvas);
}
```

**4. `prefers-reduced-motion`:**
La media query `@media (prefers-reduced-motion: reduce)` existe (líneas 1161-1174) y es comprehensiva — desactiva duración de animaciones a `0.01ms` y oculta el canvas. Bien implementado. Sin embargo, no desactiva el `animateCanvas` JS loop — solo oculta el canvas con CSS. El loop sigue corriendo en background.

---

## 16. Responsive y Breakpoints

### Breakpoints definidos

| Breakpoint | Cambios principales |
| --- | --- |
| `max-width: 1024px` | Hero padding reduce, hero-right reduce a 360px, footer 2 columnas |
| `max-width: 960px` | Nav links ocultos, hero stack vertical, grids a 1 columna, gears a 1 columna |
| `max-width: 600px` | Secciones padding 56px, hero-right oculto, botones full-width, hero-stats a 1 columna |

### Análisis por breakpoint

**1024px (tablet landscape):**
El hero-right pasa de `height: 580px` a `height: 360px` y de `position: absolute` a parte del flex. El Spline 3D en `height: 360px` puede verse recortado. El `top: 0; right: auto` en 1024px cambia la posición — bien.

**960px (tablet portrait / mobile landscape):**

- Los nav-links desaparecen sin hamburger menu — GRAVE en términos de usabilidad.
- El hero-right (`position: relative; max-width: 100%; height: 330px`) queda debajo del texto hero — el orden visual es texto → 3D → botones, lo que rompe el flujo narrativo esperado (texto → botones → proof).
- Los grids pasan a 1 columna — correcto pero las feature cards hacen `display: none` para `nth-child(n+5)`. Se muestran solo 4 features de 6.

**600px (mobile):**

- `hero-right: display: none` — el Spline 3D desaparece completamente. Correcto para performance.
- `section { padding: 56px 16px }` — buena reducción del padding vertical.
- `hero-stats { grid-template-columns: 1fr }` — las 4 stats en columna ocupa mucho espacio vertical.
- Features: se muestran solo 3 de 6 (`nth-child(n+4) { display: none }`).
- Testimoniales: solo 1 de 3.
- Pricing: solo 1 de 3 (Base, que es el menos relevante).

### Problemas críticos de responsive

**1. Sin menú hamburger en mobile:** El nav en 960px muestra solo logo + CTA button. Los usuarios no pueden acceder a "Funcionalidades", "Cómo funciona" o "Precios" desde el nav. Tienen que hacer scroll manual por todo el contenido. En comparación, Linear, Vercel y Stripe tienen menús completos en mobile.

**2. El orden de hero en mobile no es óptimo:** En 960px el hero-right (Spline 3D) aparece entre el texto y los CTAs. En 600px desaparece. El usuario mobile ve: texto → (sin 3D) → botones. El texto del hero-left tiene `align-items: center` en mobile, lo que centra todo correctamente.

**3. Card culling agresivo en mobile:** Ocultar 3 de 6 features, 2 de 3 testimoniales, y 2 de 3 pricing cards en mobile reduce significativamente el contenido disponible. Considerar:

- Features: tabs o scroll horizontal para ver todas
- Testimoniales: carousel
- Pricing: toggle de plan o scroll

**4. Gap de breakpoints:** No hay breakpoint entre 960px y 600px para screens de 768px (iPad mini portrait). A 768px se aplican las reglas de 960px, lo que puede dejar layouts demasiado comprimidos.

**5. El `.hero-center-band` en mobile:** Con `margin: 18px auto 0` en 960px y `14px auto 0` en 600px, el band queda muy pegado al hero-right (o al texto cuando el right se oculta). El `.hero-buttons` a `flex-direction: column` y `width: 100%` en 600px hace los botones full-width — correcto.

---

## 17. Tipografía y Legibilidad

### Font stack

`'Inter', system-ui, -apple-system, sans-serif` — excelente elección. Inter es la fuente estándar de la industria para dashboards y productos tech. `-webkit-font-smoothing: antialiased` en el body es correcto para dark mode.

Se cargan pesos: 400, 500, 600, 700, 800, 900. Esto suma 6 variantes de Inter desde Google Fonts. El `display=swap` garantiza que el texto se muestre con el fallback mientras carga.

### Escala tipográfica

| Elemento | Tamaño | Peso | Uso |
| --- | --- | --- | --- |
| H1 hero | `clamp(2.6rem, 7vw, 5rem)` | 900 | Correcto — impacto máximo |
| H2 secciones | `clamp(2rem, 5vw, 3.2rem)` | 800 | Bien |
| H3 cards | `1.1rem - 1.2rem` | 700 | Bien |
| Body | `1rem` (implícito) | 400 | Bien |
| Body hero | `1.18rem` | 400 | Ligeramente grande — 1.05rem sería suficiente |
| Card body | `0.88rem - 0.95rem` | 400 | Correcto |
| Eyebrow | `0.78rem` | 700 | Funcional |
| Labels | `0.7rem - 0.78rem` | 700 | En el límite del legible |
| Nav links | `0.88rem` | 500 | Correcto |
| Footer links | `0.88rem` | 400 | Correcto |
| FAQ summary | `1rem` | 600 | Correcto |

### Problemas de legibilidad

**1. Line heights inconsistentes:**

- Hero párrafo: `line-height: 1.7`
- Feature cards: `line-height: 1.7`
- Problem cards: `line-height: 1.75`
- FAQ: `line-height: 1.8`
- CTA section: `line-height: 1.7`

Los valores 1.7, 1.75, 1.8 son prácticamente iguales visualmente pero señalan que el CSS creció sin sistema. Unificar a `1.7` para body y `1.6` para texto grande.

**2. `.problem-stat` en `4rem`:** El stat grande en las problem cards se ve bien en desktop pero en mobile (columna única) ocupa mucho espacio. Considerar `clamp(3rem, 8vw, 4rem)`.

**3. Gradient text y accesibilidad:** Los elementos con `background-clip: text; -webkit-text-fill-color: transparent` son invisibles para algunas tecnologías de asistencia. Todos los H1, H2, y stats con gradiente deberían tener `color` como fallback visible, que ya está definido (`color: transparent`) — pero esto solo funciona si el browser soporta `background-clip`. Para lectores de pantalla, el texto aún es leído porque es texto real en el DOM, solo el color visual cambia.

---

## 18. Accesibilidad

### Contraste de colores (estimaciones WCAG 2.1)

| Combinación | Ratio estimado | Requisito | Estado |
| --- | --- | --- | --- |
| `--text (#f1f5f9)` sobre `--bg-deep (#050816)` | ~18:1 | AA: 4.5:1 | Pasa |
| `--text-muted (#94a3b8)` sobre `--bg-card (#111836)` | ~7.5:1 | AA: 4.5:1 | Pasa |
| `--text-dim (#64748b)` sobre `--bg-card (#111836)` | ~3.8:1 | AA: 4.5:1 | Falla en texto normal |
| `--text-dim (#64748b)` sobre `--bg-deep (#050816)` | ~3.2:1 | AA: 4.5:1 | Falla |
| `--primary (#4f6ef7)` sobre `--bg-card (#111836)` | ~4.6:1 | AA: 4.5:1 | Pasa (por poco) |
| `--accent (#00e5bf)` sobre `--bg-deep (#050816)` | ~8.5:1 | AA: 4.5:1 | Pasa |
| Texto eyebrow `var(--primary)` sobre `rgba(79,110,247,0.08)` sobre `--bg-card` | ~4.5:1 | AA: 4.5:1 | Límite |

**El `--text-dim` es el problema principal.** Se usa en: `.stat-label`, `.scroll-indicator`, `.footer-col a`, `.footer-bottom`, `.testimonial-author span`. Todos estos contextos tienen texto pequeño (0.7rem-0.88rem) donde se exige AA+.

### Aria y semántica

**Problemas encontrados:**

1. `<nav id="nav">` — falta `aria-label="Navegación principal"`.
2. `<section id="hero">` — falta `aria-labelledby` apuntando al H1.
3. Los `<section>` con solo `id` sin `aria-label` no son completamente accesibles para screen readers.
4. El canvas `<canvas id="heroCanvas">` no tiene `aria-hidden="true"` ni `role="presentation"` — los screen readers lo leerán como contenido vacío.
5. Los iconos PNG de features no tienen alt text descriptivo — tienen `alt="Captura Inteligente"` etc., que es aceptable, pero debería ser más descriptivo.
6. El custom cursor no tiene impacto en accesibilidad por sí mismo, pero la clase que lo oculta en mobile con `display: none` en `960px` es correcta.
7. `<spline-viewer>` no tiene `aria-hidden="true"` — es decorativo y debería ocultarse de los screen readers.
8. Los `<details>/<summary>` del FAQ son accesibles por native — bien.
9. El `.urgency-pulse` (div vacío decorativo) no tiene `aria-hidden="true"`.
10. Los emojis en los trust indicators y en el botón CTA deberían tener `aria-hidden="true"` para evitar que los lectores de pantalla lean "cohete" en el botón principal.

### Focus management

No hay estilos de `:focus-visible` definidos para ningún elemento interactivo. El foco por defecto del browser puede ser invisible sobre fondos oscuros. Esto es un problema serio para usuarios de keyboard.

**Corrección mínima:**

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
}
```

---

## 19. Ritmo Visual y Coherencia

### Padding de secciones

El padding estándar de `.section` es `110px 24px`. Sin embargo:

- `.cta-section` tiene `padding: 140px 24px` (segunda definición)
- El hero tiene `padding: 150px 24px 80px`
- El footer tiene `padding: 70px 24px 40px`

El ritmo de 110px entre secciones es generoso y crea buena respiración. El salto a 140px en CTA final es coherente (sección climática). El footer con 70px top es correcto (zona de cierre, menos espacio es apropiado).

### Eyebrow consistency

Todas las secciones tienen eyebrows correctamente aplicados excepto Pricing (`section-label` que no existe). Los eyebrows usan dos estilos:

- **Hero eyebrow:** `background: rgba(255,255,255,0.04); border: rgba(255,255,255,0.08)` — blanco translúcido
- **Sección eyebrow:** `background: rgba(79,110,247,0.08); border: rgba(79,110,247,0.15); color: var(--primary)` — azul

Esta diferencia es intencional (el hero tiene su propio contexto visual sobre el gradient background) y se puede justificar.

### H2 de secciones

- Problem: `gradient-title` — bien
- Features: `gradient-title` — bien
- How: `gradient-title` con `em.gradient-subtitle` — cuestionable (doble gradiente)
- Dashboard: `gradient-title` — bien
- Testimonials: `gradient-title` — bien
- Pricing: **sin clase** — roto
- FAQ: `gradient-title` — bien
- CTA Final: `gradient-title` — bien

### Separación visual entre secciones

Las secciones tienen backgrounds ligeramente distintos que crean una separación implícita. El sistema de `data-bg-color` en el body crea transiciones de color suaves al hacer scroll — bien pensado. Sin embargo, la variación de colores es tan sutil que en algunos monitores no se distingue el cambio entre secciones:

- `#080d24` (Problem) → `#050816` (Features según data-bg-color) — apenas perceptible
- `#141b32` (How) → `#0d1233` (Dashboard) — prácticamente igual

---

## 20. Comparación con referencias premium

### Linear (linear.app)

**Lo que Linear hace mejor:**

- Cada feature tiene su propia página — más depth que una card
- Los testimoniales tienen empresa, cargo Y foto real verificable
- La tipografía usa system font stack en algunos contextos para máxima performance
- No hay animaciones CSS sin scroll observer — todo usa IntersectionObserver
- El pricing es más claro: toggle mensual/anual con descuento visible
- El footer está completamente poblado con social media, documentación, changelog
- Focus styles explícitos y visibles
- Sin content ocultado en mobile — todo se adapta, nada desaparece

**Lo que ROMA hace mejor:**

- El canvas de anillos es más único que los gradients estáticos de Linear
- El Spline 3D agrega valor diferencial visual
- El color scheme es más llamativo (el azul de Linear es más conservador)

### Vercel (vercel.com)

**Lo que Vercel hace mejor:**

- Hero con demo interactivo inline — el usuario puede probar el producto sin registrarse
- Logos de clientes reales como social proof
- Uso de SVG absolutamente en todos los iconos
- Grid pattern en backgrounds más visible y con propósito decorativo claro
- Todas las cards tienen CTAs individuales
- Navegación en mobile completamente funcional

**Lo que ROMA hace mejor:**

- El problema/solución está más claro narrativamente (Problem → Features → How → Proof)
- Los stats en el hero son más específicos y memorables

### Stripe (stripe.com)

**Lo que Stripe hace mejor:**

- Gradients con much más profundidad y múltiples capas de luz
- Testimoniales con logos de empresa y case studies enlazados
- Pricing con tabla de comparación detallada
- Documentación accesible desde el nav en todo momento
- Motion design orquestado donde cada elemento tiene su momento — no hay "ruido visual" simultáneo

**Lo que ROMA hace mejor:**

- Copy más directo y orientado a conversión (Stripe es más técnico/general)
- El chat widget de ROMA es una demo del producto en sí mismo — excelente

---

## 21. Ranking de prioridades de mejora

### P0 — Bugs críticos (corregir antes de lanzar)

1. **Cerrar `</section>` del hero** antes del Problem section (línea ~1256)
2. **Cambiar `.section-label` a `.eyebrow`** en Pricing (línea 1508)
3. **Agregar `class="gradient-title"`** al H2 de Pricing (línea 1509)
4. **Corregir el selector JS del FAQ:** `'.faq-item details'` → `'details.faq-item'`
5. **Corregir el link de Términos** que apunta a "/" — crear página real o placeholder

### P1 — Problemas de usabilidad alta (primera semana)

1. **Implementar hamburger menu** para mobile (<960px) — los usuarios no pueden navegar
2. **Conectar animaciones de cards al IntersectionObserver** — problema, features, testimonials, pricing
3. **Agregar `aria-hidden="true"` al canvas y al spline-viewer**
4. **Agregar `:focus-visible` styles** para keyboard navigation
5. **Elevar `--text-dim` a `#7a8fa8`** para pasar contraste WCAG AA

### P2 — Mejoras de calidad visual (primera quincena)

1. **Convertir iconos de features PNG a SVG**
2. **Completar el footer** con política de privacidad, redes sociales, y más links
3. **Dar más prominencia a la card Pro** en pricing (scale, shadow, glow)
4. **Eliminar la doble animación logo-glow** del nav (unificar en el img, no el wrapper)
5. **Eliminar animación logo-glow del footer**
6. **Agregar `width` y `height` a todas las `<img>`** (dashboard, avatares) para evitar CLS
7. **Agregar `loading="lazy"` al dashboard image** y avatares
8. **Eliminar CSS muerto:** `@keyframes marquee-scroll`, `float`, `border-glow-pulse`, `.steps`, `.section-enter`, `.card-enter`, `.star-pop` sin uso

### P3 — Mejoras de conversión y contenido (primer mes)

1. **Agregar fallback al Spline 3D** — imagen estática si el CDN no carga
2. **Reorganizar testimoniales** — el más poderoso (datos específicos) debe ser primero
3. **Agregar más preguntas al FAQ** (6-8 en lugar de 4)
4. **Mencionar "14 días gratis" en las pricing cards**
5. **Implementar animación de apertura en FAQ** con max-height transition
6. **Reemplazar emojis en trust indicators** por iconos SVG
7. **Agregar descripción al Dashboard section** (texto bajo el H2)
8. **Optimizar canvas:** Pausar animación cuando el hero no es visible
9. **Agregar toggle anual/mensual a Pricing** con descuento visible

---

*Auditoría completada sobre el archivo `index.html` de 1903 líneas. Total de issues identificados: 27 items clasificados en P0/P1/P2/P3.*
