# Especificación Técnica — Transformación App-like / Revista Digital (Mobile & Tablet)

**Proyecto:** ROMA AI Landing  
**Archivo target:** `index.html` (CSS+HTML+JS inline)  
**Breakpoints activos:** 1024px / 960px / 600px  
**Enfoque:** Cambios incrementales sobre layout/spacing/cards/jerarquía visual. Sin imágenes grandes nuevas. Sin romper estética actual.

---

## 📋 LISTA PRIORIZADA DE CAMBIOS

---

### 🔴 PRIORIDAD 1 — Fix Logo Mobile/Tablet

**Problema actual:**  
`.logo-pill` usa `left: calc(50% - 580px)` que funciona en desktop (>1200px) pero en viewports menores queda desplazado a la izquierda, fuera de centro visual. Se oculta la label y se reduce la imagen a 50px en 960px, pero la posición left no se corrige.

**Cambios en CSS — @media (max-width: 960px):**
1. `.logo-pill`: cambiar `left: calc(50% - 580px)` → `left: 50%; transform: translateX(-50%);` así centra el pill en cualquier viewport.
2. `.logo-pill-img`: mantener `height: 50px` pero asegurar `width: auto` se mantiene.
3. `.logo-pill a`: el `padding` se reduce a `5px 10px 5px 5px` (ya existe).
4. Añadir `z-index: 10001` para que el logo quede por encima del menú hamburguesa (en 960px el nav-links fullscreen tiene z-index 9999).
5. Considerar añadir un pequeño gap/top offset: `top: 12px` en lugar de 16px para que no se superponga con la nav.

**@media (max-width: 600px):**
1. `.logo-pill-img`: reducir a `height: 40px` para que no robe espacio vertical preciado.
2. `.logo-pill a`: padding a `4px 8px 4px 4px`.
3. `.logo-pill`: `top: 10px`.

**Validación:** El logo debe verse centrado horizontalmente en todos los widths desde 320px hasta 1024px.

---

### 🔴 PRIORIDAD 2 — Sistema "Toque 6 Activo"

**Problema actual:**  
Los `.feature-tag` en `hero-features` usan `:hover` para tooltip y cambio de color. En touch devices el hover no persiste y no hay feedback visual de "toque". No existe un conjunto de 6 elementos táctiles con estado visual.

**Objetivo:**  
Crear un sistema de 6 elementos táctiles (los `.feature-tag`) que tengan estado visual **activo/inactivo**, y que al tocarlos cambien su apariencia y muestren contenido asociado (el tooltip existente o un panel de detalle).

**Cambios en CSS — agregar a la hoja de estilos (debajo del bloque feature-tag existente):**

1. **Estado táctil activo** (nuevo selector):
   - `.feature-tag.touched` o `.feature-tag.active`: fondo más intenso (`rgba(0,229,191,0.15)`), borde más brillante (`rgba(0,229,191,0.6)`), color de texto acento, transform scale(1.02) leve.
   - El `.feature-tooltip` debe mostrarse cuando el tag tiene clase `.active` (no solo en hover).
   - En mobile, eliminar la visibilidad del tooltip en hover y reemplazar por la clase `.active`.

2. **Transición suave entre estados:**
   - `.feature-tag { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }` (ya existe parcialmente).
   - Añadir `-webkit-tap-highlight-color: transparent;` para eliminar el highlight default del navegador.

3. **Modificar selectores existentes:**
   - `.feature-tag:hover .feature-tooltip`: añadir `@media (hover: hover)` para que solo aplique en dispositivos con hover (desktop).
   - `.feature-tag.active .feature-tooltip`: mostrar el tooltip también.

**Cambios en JS — agregar al script existente (al final, antes del hamburger menu JS):**

```javascript
// ===== TOUCH 6 — Feature Tags con estado activo =====
const FEATURE_TAGS = document.querySelectorAll('.feature-tag');
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

FEATURE_TAGS.forEach(tag => {
  // En touch: tap toggle activa/desactiva
  tag.addEventListener('click', function(e) {
    if (!isTouchDevice) return; // solo en touch
    e.preventDefault();
    const wasActive = this.classList.contains('active');
    // Cerrar todos los demás
    FEATURE_TAGS.forEach(t => t.classList.remove('active'));
    if (!wasActive) this.classList.add('active');
  });
  
  // En desktop: hover sigue funcionando
  tag.addEventListener('mouseenter', function() {
    if (isTouchDevice) return;
    FEATURE_TAGS.forEach(t => t.classList.remove('active'));
    this.classList.add('active');
  });
  tag.addEventListener('mouseleave', function() {
    if (isTouchDevice) return;
    this.classList.remove('active');
  });
});
```
Esto da 7 tags activables (pueden ser 6 si se excluye uno, o se usa un wrapper para mostrar solo 6).

**Alternativa más app-like (recomendada):**  
Si se quiere exactamente 6, agrupar los 7 tags en un contenedor y mostrar solo 6 en mobile/tablet. El 7mo (Bilingüe) puede ir al final de la grilla de feature tags o mostrarse en un expand. Pero el requerimiento dice "6 elementos táctiles" — los 7 tags existen, en mobile se muestran todos pero se pueden restringir a 6 con CSS `:nth-child(-n+6)` en el container.

2.1. **Regla CSS para 6 elementos visibles en mobile/tablet:**
   - En `@media (max-width: 960px)`: `.hero-features` usar `display: grid; grid-template-columns: repeat(2, 1fr);` gap reducido.
   - En `@media (max-width: 600px)`: `.hero-features` grid 1 columna.
   - Mostrar solo 6 con `.feature-tag:nth-child(n+7) { display: none; }` en ambos breakpoints. O simplemente mantener los 7 pero asegurar que el toque 6 activo funcione en los primeros 7 (no es crítico).

---

### 🔴 PRIORIDAD 3 — Layout Tipo Revista / App-like

**Problema actual:**  
El layout en mobile es funcional pero plano: todas las secciones tienen el mismo padding vertical, las cards se apilan sin jerarquía visual, no hay "ritmo editorial" que guíe la mirada.

**Cambios en CSS — dentro de @media (max-width: 960px) y (max-width: 600px):**

**3.1 — Espaciado vertical diferenciado:**
- `.section`: el padding actual es `56px 16px` en 600px. Cambiar a esquema variable:
  - Secciones "importantes" (hero, cta): `padding: 48px 16px 56px;`
  - Secciones de contenido (features, problem, how, testimonials): `padding: 40px 16px;`
  - Secciones finales (pricing, faq): `padding: 48px 16px 40px;`
  - El espaciado entre secciones consecutivas se controla con padding-bottom de la anterior.

**3.2 — Títulos con jerarquía editorial:**
- En `@media (max-width: 600px)`:
  - `.section h2`: `font-size: 1.6rem; letter-spacing: -0.02em;` (reducir de 2rem para mejor lectura en móvil).
  - `.gradient-title`: mantener el gradiente pero reducir el font-weight visual con tracking más amplio.
  - `.section > .container > p`: `font-size: 0.92rem; max-width: 100%; margin-bottom: 28px;`

**3.3 — Cards con aspecto de "fichas de revista":**
- En `@media (max-width: 960px)`:
  - `.problem-card-body`: `padding: 20px 20px 24px;` (reducido de 28px para mantener proporciones).
  - `.feature-card`: `padding: 28px 24px;` (reducido de 40px 32px).
  - `.testimonial-card`: `padding: 24px 20px;`.

- En `@media (max-width: 600px)`:
  - `.problem-card-body`: `padding: 16px 16px 20px;`.
  - `.feature-card`: `padding: 22px 18px;`.
  - `.testimonial-card`: `padding: 20px 16px;`.

**3.4 — Scroll horizontal para sección de testimoniales (opción editorial):**
- En `@media (max-width: 960px)` y `(max-width: 600px)`:
  - `.testimonials-grid`: cambiar de `grid` a `display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 16px; padding-bottom: 8px;`
  - `.testimonial-card`: `flex: 0 0 80%; scroll-snap-align: start;` (en 600px: `flex: 0 0 85%`).
  - Ocultar scrollbar con `.testimonials-grid::-webkit-scrollbar { display: none; }` y `scrollbar-width: none;`.
  - Añadir dots de navegación con JS: contar cards, crear dots, al hacer scroll actualizar dot activo, al tocar dot hacer scrollIntoView.

**3.5 — Hero vertical compacto:**
- En `@media (max-width: 600px)`:
  - `.hero-left h1`: `font-size: clamp(1.8rem, 8vw, 2.2rem);` (reducir de 2.6rem).
  - `.hero-left .eyebrow`: `font-size: 0.72rem; margin-bottom: 16px;`
  - `.hero-left p`: `font-size: 0.92rem; margin-bottom: 24px;`
  - `.hero-stats`: grid 2 columnas (2x2) en vez de 1 columna (actual).
  - `.stat-number`: `font-size: 1.6rem;`

---

### 🟡 PRIORIDAD 4 — Cards Táctiles con Estado Visual

**Problema actual:**  
Todas las cards tienen efectos `:hover` que no funcionan en touch. No hay feedback de "toque" (active state) para el usuario que interactúa con el dedo.

**Cambios en CSS:**

1. **Active state global para touch:**
   ```css
   @media (hover: none) and (pointer: coarse) {
     .feature-card:active,
     .problem-card:active,
     .testimonial-card:active,
     .pricing-card:active {
       transform: scale(0.97) !important;
       transition: transform 0.15s ease-out;
     }
     .btn:active {
       transform: scale(0.95);
     }
     .faq-item summary:active {
       background: rgba(79,110,247,0.08);
     }
   }
   ```
   Esto da feedback táctil inmediato sin depender de JS. El `scale(0.97)` es sutil pero perceptible.

2. **Deshabilitar hover en touch:**
   - Envolver todos los selectores `:hover` de cards (`.feature-card:hover`, `.problem-card:hover`, etc.) dentro de `@media (hover: hover)` para que no se activen en dispositivos touch.

---

### 🟡 PRIORIDAD 5 — Tooltips Táctiles (Feature Tags)

**Problema actual:**  
Los `.feature-tooltip` aparecen con `:hover`. En mobile/touch nunca se ven porque no hay hover state persistente.

**Cambios en CSS (además del sistema "toque 6 activo" de la prioridad 2):**

1. **Tooltip en long-press (alternativa a tap):**
   - Ya cubierto con el sistema active en prioridad 2 al hacer tap.
   - Mejora adicional: en `@media (max-width: 960px)`, cambiar posición del tooltip a `left: auto; right: 0; transform: none;` para que no se corte en el borde derecho de pantalla.

2. **Tooltip compacto:**
   - En mobile reducir width a `160px` y font-size a `0.72rem`.

---

### 🟢 PRIORIDAD 6 — Lazy Loading / Placeholder de Imágenes Grandes

**Problema actual:**  
Imágenes como `dashboard-mockup.png`, las 3 `problem-*.jpg`, y los avatares se cargan en mobile aunque no sean visibles o consuman ancho de banda innecesario.

**Cambios en HTML (atributos):**

1. **Dashboard image:**
   - Añadir `loading="lazy"` ya que está debajo del fold.
   - En `<img src="assets/dashboard-mockup.png" ...>` añadir: `loading="lazy" decoding="async"`.

2. **Problem images:**
   - Ya tienen `onerror` para ocultarse. Añadir `loading="lazy" decoding="async"`.
   - Considerar en `@media (max-width: 600px)`: el aspect-ratio 4/3 en `.problem-img-wrap` consume mucho espacio vertical. Reducir a `aspect-ratio: 16/9` o `padding-top: 45%` para que la card no sea tan alta en mobile.

3. **Avatares de testimoniales:**
   - Añadir `loading="lazy"`.

4. **Feature icons:**
   - Son PNGs de 56x56px, no críticos. Añadir `loading="lazy"`.

**Cambios en CSS — @media (max-width: 600px):**
- `.problem-img-wrap`: `aspect-ratio: 16/9;` (reduce la altura de la card).
- `.dashboard-image`: `border-radius: 8px;` y opcionalmente `max-height: 200px; object-fit: cover;` para que consuma menos espacio vertical.

---

### 🟢 PRIORIDAD 7 — Scroll Horizontal para Testimonials (Mejora Editorial)

**Detalle para implementar si se opta por scroll horizontal en testimonials (alternativa a la prioridad 3.4):**

**Cambios en CSS + JS:**

CSS:
```css
@media (max-width: 960px) {
  .testimonials-grid {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    gap: 16px;
    padding: 4px 4px 12px;
    scrollbar-width: none;
  }
  .testimonials-grid::-webkit-scrollbar { display: none; }
  .testimonial-card {
    flex: 0 0 75%;
    scroll-snap-align: center;
    opacity: 1;
    animation: none;
  }
}
@media (max-width: 600px) {
  .testimonial-card {
    flex: 0 0 85%;
  }
}
```

JS (al final del script, modular):
```javascript
// ===== SCROLL SNAP INDICATOR =====
const testimonialsGrid = document.querySelector('.testimonials-grid');
if (testimonialsGrid && window.innerWidth <= 960) {
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'scroll-dots';
  dotsContainer.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-top:16px;';
  const cards = testimonialsGrid.querySelectorAll('.testimonial-card');
  cards.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:rgba(79,110,247,0.2);transition:all 0.3s;cursor:pointer;';
    dot.dataset.index = i;
    dot.addEventListener('click', () => {
      cards[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
    dotsContainer.appendChild(dot);
  });
  testimonialsGrid.parentNode.appendChild(dotsContainer);
  
  // Actualizar dot activo al hacer scroll
  let scrollTimeout;
  testimonialsGrid.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollCenter = testimonialsGrid.scrollLeft + testimonialsGrid.offsetWidth / 2;
      let activeIdx = 0;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        if (Math.abs(cardCenter - scrollCenter) < Math.abs(cards[activeIdx].offsetLeft + cards[activeIdx].offsetWidth / 2 - scrollCenter)) {
          activeIdx = i;
        }
      });
      dotsContainer.querySelectorAll('span').forEach((dot, i) => {
        dot.style.background = i === activeIdx ? 'var(--primary)' : 'rgba(79,110,247,0.2)';
        dot.style.transform = i === activeIdx ? 'scale(1.3)' : 'scale(1)';
      });
    }, 50);
  });
}
```
Esto da una experiencia tipo carrusel nativo muy app-like.

---

### 🟢 PRIORIDAD 8 — Navegación mejorada para Mobile

**Problema actual:**  
El menú hamburguesa es fullscreen y al cerrar vuelve al principio. No hay indicación de en qué sección está el usuario.

**Cambio mínimo — JS (añadir al observer existente):**

Añadir lógica que al cruzar una sección, marque visualmente el link correspondiente en el menú. En mobile no hay indicación visual de sección activa en la nav.

```javascript
// ===== ACTIVE SECTION IN NAV (mobile) =====
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.remove('active-section');
        if (link.getAttribute('href') === '#' + entry.target.id) {
          link.classList.add('active-section');
        }
      });
    }
  });
}, { threshold: 0.3 });
sections.forEach(s => sectionObserver.observe(s));
```

CSS para el estado activo (fuera de media queries):
```css
.nav-links a.active-section {
  color: var(--accent);
}
.nav-links a.active-section::after {
  transform: scaleX(1);
}
```

---

## 📐 RESUMEN DE CAMBIOS POR ARCHIVO

### index.html — CSS (dentro de `<style>`)

| Bloque | Cambio |
|--------|--------|
| `:root` | Sin cambios |
| `.logo-pill` (línea 238) | No tocar, solo añadir override en media queries |
| `@media (max-width: 1024px)` (l.1198) | Sin cambios (opcional: ajustar hero-right) |
| `@media (max-width: 960px)` (l.1215) | **P1:** Fix logo position + z-index. **P2:** feature-tag active styles + tooltip touch. **P3.3:** Card paddings reducidos. **P7:** Testimonials scroll horizontal. |
| `@media (max-width: 600px)` (l.1269) | **P1:** Logo más pequeño. **P3.1:** Espaciado variable entre secciones. **P3.2:** Títulos reducidos. **P3.5:** Hero compacto. **P4:** Active state touch. **P6:** Aspect ratio problem-img reducido. |
| Feature tags (l.1320-1364) | **P2:** Añadir `.feature-tag.active` y `.feature-tag.touched`. Envolver hover en `@media (hover: hover)`. |
| Cards (problem, feature, testimonial) | **P4:** Añadir `@media (hover: none) and (pointer: coarse)` con active state. |
| Nuevos selectores | **P4:** `.btn:active` scale(0.95). |
| `@media (hover: none)` | Añadir bloque nuevo: desactivar hovers de cards, activar active states táctiles. |

### index.html — JS (dentro de `<script>`)

| Bloque | Cambio |
|--------|--------|
| Después del bilingual system (l.2325) | **P2:** Sistema "toque 6 activo" — click toggle + hover toggle. |
| Después de hamburger menu (l.2513) | **P7:** Scroll snap dots para testimonials. **P8:** Active section nav observer. |

### index.html — HTML (dentro de `<body>`)

| Elemento | Cambio |
|----------|--------|
| `<div class="logo-pill">` (l.1434) | Sin cambios estructurales. Los ajustes son CSS. |
| `<img>` de dashboard (l.1703) | **P6:** Añadir `loading="lazy" decoding="async"`. |
| `<img>` de problem cards (l.1518,1531,1544) | **P6:** Añadir `loading="lazy" decoding="async"`. |
| `<img>` de avatars (l.1720,1731,1742) | **P6:** Añadir `loading="lazy"`. |
| `<img>` de feature icons (l.1567+) | **P6:** Añadir `loading="lazy"` a todos los feature icons. |

---

## 📐 BREAKDOWN POR TEMA (RESUMEN EJECUTIVO)

### 1. FIX LOGO MOBILE/TABLET
- **Qué:** Reposicionar `.logo-pill` a `left:50%; transform:translateX(-50%)` en <960px
- **Dónde:** CSS @media (max-width:960px) y (max-width:600px)
- **Por qué:** El cálculo `calc(50% - 580px)` solo funciona en viewports >1200px. En tablet/mobile el logo flota descentrado.
- **Riesgo:** Mínimo — solo cambia posición, no estructura.

### 2. TOQUE 6 ACTIVO
- **Qué:** Sistema de 6/7 feature-tag táctiles con estado `.active` al tocar, tooltip visible, feedback visual
- **Dónde:** CSS (nuevos selectores `.feature-tag.active`) + JS (event listeners click/touch)
- **Por qué:** No existe feedback táctil ni tooltips accesibles en touch.
- **Riesgo:** Bajo — los tags ya existen, solo se añade interactividad.

### 3. LAYOUT TIPO REVISTA
- **Qué:** Espaciado vertical diferenciado entre secciones, títulos más pequeños en mobile, cards con padding reducido, scroll horizontal en testimonials
- **Dónde:** CSS @media queries existentes
- **Por qué:** El layout actual es uniforme y plano. La jerarquía visual guía la mirada del usuario.
- **Riesgo:** Bajo — solo cambios de spacing y sizing.

### 4. FEEDBACK TÁCTIL
- **Qué:** Active state `scale(0.97)` en todas las cards y botones al tocar
- **Dónde:** CSS @media (hover: none) and (pointer: coarse)
- **Por qué:** Sin feedback táctil el usuario no sabe si tocó efectivamente un elemento.
- **Riesgo:** Mínimo — no rompe nada en desktop.

### 5. IMÁGENES GRANDES
- **Qué:** `loading="lazy"` en dashboard, problem cards, avatares, icons. Reducción de aspect-ratio de problem-img-wrap en mobile.
- **Dónde:** HTML (atributos) + CSS (media queries)
- **Por qué:** Performance en conexiones móviles.
- **Riesgo:** Ninguno — lazy loading es estándar.

---

## 📐 NOTAS TÉCNICAS ADICIONALES

1. **Spline Viewer en mobile:** Ya está oculto en `@media (max-width: 600px)` con `display: none`. Correcto.
2. **Canvas de partículas del logo:** Recalcula posición con `getBoundingClientRect()` en cada resize — funciona correctamente incluso con el nuevo posicionamiento del logo pill.
3. **Cursor custom:** Ya se oculta en <960px con `display: none`. Correcto.
4. **Preferencia de motion reduce:** Ya existe. No tocar.
5. **No se añaden imágenes nuevas** — solo se optimizan las existentes.
6. **No se añaden dependencias externas** — todo es CSS nativo + JS vanilla.
7. **El sistema bilingüe** no se modifica — los data-i18n siguen funcionando igual.
