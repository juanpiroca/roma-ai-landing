# ROMA AI — IMPLEMENTATION MASTER PLAN

## Plan de Implementación Maestro

**Fecha:** 2026-05-28
**Estado:** PENDIENTE APROBACIÓN DE JUANPI
**Versión:** 1.0 — Fase de Planificación

---

> ⚠️ **ESTE DOCUMENTO REQUIERE APROBACIÓN ANTES DE CUALQUIER MODIFICACIÓN DE CÓDIGO**
> Ver "Preguntas para JuanPi" al final del documento.

---

## RESUMEN EJECUTIVO

La landing de ROMA AI tiene una base sólida: buen sistema de diseño con custom properties CSS, animaciones coherentes, y una propuesta de valor clara. Sin embargo, presenta **5 problemas críticos** que impactan directamente en performance, confianza y conversión:

1. **HTML inválido**: el hero section nunca se cierra — todas las secciones están anidadas dentro del hero
2. **Spline 3D sin defer**: bloquea el render, destroza el LCP
3. **Contenido no verificado**: testimoniales y métricas parecen ficticios
4. **CSS duplicado y conflictivo**: dos definiciones de `.hero-left p` y `.marquee-track`
5. **159 reinicios de PM2**: el proceso roma-webchat es inestable

Los quick wins son de bajo riesgo y alto impacto. Las fases posteriores requieren decisiones de JuanPi.

---

## FASE 0 — PRERREQUISITOS (ANTES DE TOCAR CÓDIGO)

| Prerrequisito | Estado | Responsable |
| --------------- | -------- | ------------- |
| Subir ZIP "Archivos Para Crear Web Con Claude.zip" | ❌ FALTANTE | JuanPi |
| Confirmar si testimoniales son reales o ficticios | ❓ Pendiente | JuanPi |
| Confirmar si stats son reales o ficticios | ❓ Pendiente | JuanPi |
| Confirmar arquitectura: HTML vanilla vs React | ❓ Pendiente | JuanPi |
| Confirmar si Spline 3D es asset propio | ❓ Pendiente | JuanPi |
| Backup del código actual en git remoto | ❌ FALTANTE | JuanPi + Claude |
| Verificar por qué roma-webchat tiene 159 reinicios | ❌ FALTANTE | Claude |

---

## QUICK WINS — 1 DÍA (SIN RIESGO)

Estos cambios son reversibles, no rompen nada, y tienen impacto inmediato.

### QW-1: Cerrar correctamente el hero section

**Impacto:** CRÍTICO — HTML inválido puede causar comportamientos raros en algunos browsers
**Archivo:** `index.html` línea ~1255
**Cambio:** Agregar `</section>` antes de la section del problema
**Tiempo:** 5 minutos
**Riesgo:** Ninguno

### QW-2: Agregar `defer` al Spline Viewer

**Impacto:** ALTO — mejora LCP y tiempo de carga inicial
**Archivo:** `index.html` línea ~20
**Cambio:**

```html
<!-- Antes -->
<script type="module" src="https://unpkg.com/@splinetool/viewer@1.9.82/build/spline-viewer.js"></script>

<!-- Después -->
<script type="module" src="https://unpkg.com/@splinetool/viewer@1.9.82/build/spline-viewer.js" defer></script>
```

**Tiempo:** 2 minutos
**Riesgo:** Bajo (el Spline puede aparecer con delay visual, verificar en staging)

### QW-3: Eliminar CSS duplicados y conflictivos

**Impacto:** MEDIO — elimina conflictos de texto-align y animación marquee
**Archivo:** `index.html` líneas 263-267 y 357-360 (`.hero-left p`)
**Tiempo:** 15 minutos
**Riesgo:** Bajo

### QW-4: Lazy loading en imágenes no-críticas

**Impacto:** ALTO — reduce tiempo de carga percibido
**Archivo:** `index.html` — todas las `<img>` excepto las del hero
**Cambio:** Agregar `loading="lazy"` a imágenes de problem cards, features, dashboard, testimonials
**Tiempo:** 10 minutos
**Riesgo:** Ninguno

### QW-5: Mover webchat CSS al `<head>`

**Impacto:** BAJO — evita posible FOUC del widget
**Archivo:** `index.html` línea 1900
**Cambio:** Mover `<link rel="stylesheet" href="/roma-webchat/webchat.css">` al head
**Tiempo:** 2 minutos
**Riesgo:** Ninguno

### QW-6: Deshabilitar custom cursor en mobile

**Impacto:** MEDIO — elimina código JS innecesario en mobile
**Archivo:** `index.html` — JS del cursor
**Cambio:** Wrappear en `if (window.matchMedia('(pointer: fine)').matches) { /* cursor code */ }`
**Tiempo:** 5 minutos
**Riesgo:** Ninguno

### QW-7: Pausar canvas cuando hero no está visible

**Impacto:** MEDIO — reduce CPU en usuarios que scrollearon
**Archivo:** `index.html` — función `animateCanvas()`
**Cambio:** Usar IntersectionObserver para pausar/reanudar el requestAnimationFrame del canvas
**Tiempo:** 20 minutos
**Riesgo:** Bajo

### QW-8: Agregar `<link rel="preload">` para imágenes críticas

**Impacto:** MEDIO — mejora LCP para problem cards y dashboard
**Archivo:** `index.html` head
**Tiempo:** 10 minutos
**Riesgo:** Ninguno

---

## FASE 1 — VISUAL (REQUIERE APROBACIÓN DISEÑO)

> ⚠️ Esta fase requiere confirmación de dirección visual de JuanPi.
> Ver opciones en ROMA_WEB_BRAINSTORM_EXPANDED.md

### 1.1 Sistema de Contenedores — Consistencia

**Problema actual:** Padding y containers inconsistentes entre secciones.

- Hero: `padding: 150px 24px 80px`
- Secciones: `padding: 110px 24px`
- Mobile: `padding: 56px 16px`
- Container: `max-width: 1200px`

**Propuesta:**
Unificar a un spacing scale basado en 8px:

```css
:root {
  --space-section: 120px;  /* desktop */
  --space-section-md: 80px; /* tablet */
  --space-section-sm: 56px; /* mobile */
  --container-max: 1200px;
  --container-pad: 40px;
}
```

**Archivos a modificar:** `index.html` (CSS sections)
**Tiempo estimado:** 2-3 horas
**Riesgo:** Medio — afecta todas las secciones

### 1.2 Hero Section — Decisión de Spline

**Tres opciones (requiere respuesta de JuanPi):**

**Opción A — Mantener Spline (con optimización)**

- Agregar defer al script
- Lazy load la escena
- Añadir fallback estático (imagen del robot)
- Detectar conexión lenta y cargar fallback

**Opción B — Reemplazar Spline con video loop**

- Video WebM/MP4 del robot o animación
- ~3-5MB vs posibles 20MB+ de Spline
- Mejor control de la experiencia

**Opción C — Hero sin 3D (minimalista tipo Linear)**

- Eliminar Spline completamente
- Canvas rings más sofisticado como único elemento visual
- Tipografía grande con gradient animation
- Mayor velocidad y coherencia premium

### 1.3 Gradients — Unificación

El sistema actual tiene gradients inconsistentes:

- `gradient-title`: 135deg, #fff → #00e5bf → #4f6ef7 → #a78bfa
- `gradient-subtitle`: 135deg, #00e5bf → #4f6ef7 → #a78bfa
- `hero-title-flow`: 90deg, 250% size, animated
- `hero-destello`: radial-gradient circular

**Propuesta:** Definir 3 gradients semánticos en custom properties:

```css
:root {
  --grad-brand: linear-gradient(135deg, #00e5bf, #4f6ef7, #a78bfa);
  --grad-hero: linear-gradient(90deg, #fff 0%, #00e5bf 20%, #4f6ef7 40%, #a78bfa 60%, #00e5bf 80%, #fff 100%);
  --grad-subtle: linear-gradient(135deg, rgba(79,110,247,0.1), rgba(0,229,191,0.05));
}
```

### 1.4 Cards — Elevación y Consistencia

**Feature cards:** Actualmente no tienen border visible, solo hover. Proponer border sutil siempre visible.
**Pricing cards:** La card "Pro" tiene badge pero no tiene diferenciación visual suficiente (border glow).
**Testimonial cards:** Sin imágenes reales = falla de confianza masiva.
**Problem cards:** Estructura sólida — mantener.

### 1.5 Pricing — Rediseño Visual

**Problema:** La section de pricing NO tiene data-reveal (única sin reveal) y visualmente es la más plana.
**Propuesta:**

- Agregar data-reveal
- Añadir glow en el card Pro
- Pricing cards con tabla visual de features
- Añadir "más usado por startups / empresas medianas" context labels

### 1.6 Footer — Completar Contenido

**Problema:** Footer está casi vacío:

- "Recursos" → solo WhatsApp
- "Legal" → Términos que linkean a "/"
- Sin redes sociales
- Sin badge de seguridad/confianza

**Propuesta:**

- Agregar links a: Blog/casos de éxito, LinkedIn, Instagram
- Crear páginas de Términos y Privacidad reales
- Añadir badge de seguridad (SSL, datos protegidos)

---

## FASE 2 — BRANDING (REQUIERE APROBACIÓN)

### 2.1 Logo

**Situación actual:**

- `footer-logo-negative.svg` — usado en nav y footer
- `navbar-logo.svg` — existe pero no se usa en nav (se usa footer-logo)
- `hero-logo-lockup.svg` — existe pero no visible en la landing actual
- `logo-roma.png` — rasterizado, menor calidad

**Propuesta:**

- Auditar cuál es el logo definitivo
- Usar SVG consistentemente en todos los usos
- Crear variantes: horizontal, símbolo solo, dark, light

### 2.2 Favicon

**Situación actual:** `favicon.svg` + `favicon-roma.svg` (dos versiones)
**Propuesta:**

- Definir el favicon definitivo
- Agregar `<link rel="apple-touch-icon">` para iOS
- Agregar favicon PNG 32x32 como fallback
- Agregar `<link rel="icon" sizes="192x192">` para Android

### 2.3 Iconos de Features

**Problema:** Los 6 iconos de features son PNG (`icono-*.png`).
**Propuesta:** Reemplazar por SVG (Lucide icons o custom) para mejor calidad y menor peso.

### 2.4 Imágenes de Problemas

**Situación:** `problem-tiempo.jpg`, `problem-perdidos.jpg`, `problem-horas.jpg` — imágenes genéricas con fallback a placeholder.
**Propuesta:**

- Reemplazar con imágenes más representativas del negocio
- O eliminar y hacer el card más minimalista (solo data/stat)
- Convertir a WebP

---

## FASE 3 — CRO (CONVERSIÓN)

### 3.1 Testimoniales — DECISIÓN CRÍTICA

**Situación actual:** 3 testimoniales con nombres genéricos (Laura Méndez, Carlos Rivera, Ana Parra) y empresas genéricas (Clínica Premium, GrowthTech, InnovaCorp). Avatares generados.

**Si son ficticios (URGENTE):**

- OPCIÓN A: Reemplazar por casos de uso reales aunque sean anónimos ("Empresa de servicios financieros, CABA")
- OPCIÓN B: Cambiar testimoniales por logos de clientes reales (más efectivo que testimoniales de texto)
- OPCIÓN C: Reemplazar sección con métricas verificables en lugar de testimoniales

**Si son reales:** Obtener fotos reales de los clientes y usar nombres/empresas completas verificables.

### 3.2 Métricas en Hero

**Situación actual:**

```
10K+ leads capturados | 92% tasa de respuesta | 2 min tiempo promedio | 20h ahorro semanal
```

**Si son ficticias:** Reemplazar con métricas de comportamiento del producto ("ROMA responde en <2 min / disponible 24/7 / 0 leads perdidos")
**Si son reales:** Agregar fuente o contexto ("promedio de nuestros clientes en los últimos 6 meses")

### 3.3 Urgency Indicator — "2,847 empresas"

**Situación actual:** `+2,847 empresas ya están automatizando sus ventas`
**Problema:** Número arbitrario que parece inventado.
**Propuesta:**

- Reemplazar por algo verificable ("Ya confiaron en ROMA más de 50 empresas")
- O eliminar si el número no es real
- Usar urgency real: "Últimos 3 spots disponibles para onboarding esta semana"

### 3.4 CTA Primary

**Situación actual:** Todo va a WhatsApp. Un solo punto de contacto.
**Propuesta (requiere decisión de JuanPi):**

- Mantener solo WhatsApp (simple, funciona)
- Agregar un formulario alternativo (Email + teléfono)
- Agregar Calendly para demo scheduling
- La recomendación es al menos 2 opciones de conversión

### 3.5 Copy del Hero

**Situación actual:** "Convertí cada conversación en una venta cerrada"
**Análisis:** Bueno pero genérico. Podría ser más específico a ROMA AI.
**Alternativas a evaluar:**

- "Tu equipo de ventas trabaja. ROMA AI cierra mientras dormís."
- "WhatsApp automático que califica y cierra. 24/7."
- "ROMA AI: el vendedor que nunca duerme."

### 3.6 WhatsApp Funnel

**Número actual:** `+1 201-969-6812` (número USA)
**Análisis:** Si el mercado principal es Argentina/LATAM, un número USA puede generar fricción.
**Propuesta:** Verificar si hay número local de Argentina disponible o explicar por qué es USA.

---

## FASE 4 — HERRAMIENTAS A EVALUAR (SIN INSTALAR AÚN)

### shadcn/ui

- **URL:** <https://ui.shadcn.com/>
- **Compatibilidad:** Requiere React — NO compatible con HTML vanilla actual
- **Veredicto:** ❌ No aplicable sin migrar a React
- **Si se migra a React:** Muy recomendable para pricing cards, FAQ, y modales

### Tailwind CSS

- **URL:** <https://tailwindcss.com/>
- **Compatibilidad:** Puede usarse con HTML vanilla via CDN o build
- **Veredicto:** ⚠️ Útil solo si se separa el CSS en archivos. Con el HTML monolítico actual, agregaría complejidad sin beneficio real.
- **Si se refactoriza el CSS:** Sí recomendable

### Framer Motion / Motion

- **URL:** <https://www.framer.com/motion/>
- **Compatibilidad:** Requiere React
- **Veredicto:** ❌ No compatible con HTML vanilla. Para animaciones actuales, el CSS y requestAnimationFrame son suficientes.

### Lucide Icons

- **URL:** <https://lucide.dev/>
- **Compatibilidad:** Funciona con HTML vanilla (SVG sprites o individuales)
- **Veredicto:** ✅ Recomendado para reemplazar los PNG de features. Bajo peso, escalable, consistente.

### React Bits

- **URL:** <https://www.reactbits.dev/>
- **Compatibilidad:** Requiere React
- **Veredicto:** ❌ No compatible con HTML vanilla

### Aceternity UI

- **URL:** <https://ui.aceternity.com/>
- **Compatibilidad:** Requiere React + Tailwind
- **Veredicto:** ❌ No compatible con HTML vanilla. Inspiración visual útil pero no instalable.

### RECOMENDACIÓN DE ARQUITECTURA

**Mantener HTML vanilla si:**

- El contenido es estático y no cambia frecuentemente
- No hay interacción compleja más allá de animaciones y formularios
- Se prioriza velocidad de entrega sobre escalabilidad

**Migrar a Astro (recomendado) si:**

- Se quiere velocidad de HTML vanilla + componentes modulares
- Se quiere poder usar React/Preact para partes interactivas (pricing calculator, etc.)
- Se quiere MDX para blog/casos de éxito

**Migrar a Next.js si:**

- Se van a agregar páginas dinámicas (dashboard, blog con CMS)
- Se necesita SSR para SEO de páginas internas
- El equipo ya conoce React

---

## FASE 5 — SKILLS Y AGENTES (ARQUITECTURA)

### Skills Recomendadas

| Skill | Descripción | Prioridad |
| ------- | ------------- | ----------- |
| `frontend-design` | Genera interfaces premium, evita estética genérica | Alta |
| `performance-audit` | Mide y optimiza Core Web Vitals | Alta |
| `cro-copywriter` | Optimiza copy para conversión | Alta |
| `logo-brand-review` | Audita y propone sistema de branding | Media |
| `responsive-layout-audit` | Verifica mobile-first | Media |
| `motion-control` | Define sistema de animaciones equilibrado | Media |
| `cinematic-gradient-system` | Crea sistema de gradients coherente | Baja |
| `premium-spacing-system` | Define escala de spacing consistente | Baja |

### Agentes Recomendados

| Agente | Rol | Fase |
| -------- | ----- | ------ |
| `frontend-architect` | Estructura HTML/CSS/JS limpia | Quick Wins + Fase 1 |
| `ui-ux-director` | Decisiones de diseño visual | Fase 1-2 |
| `wordpress-engineer` | Gestión del WP (si se mantiene) | Fase 1 |
| `brand-director` | Logo, favicon, system | Fase 2 |
| `performance-auditor` | LCP, CLS, Core Web Vitals | Fase 3 |
| `cro-copywriter` | Copy y conversion | Fase 3 |
| `qa-reviewer` | Testing visual y funcional | Todas |

---

## FASE 6 — PERFORMANCE

### Optimizaciones de Performance (orden de impacto)

| Optimización | Impacto LCP | Esfuerzo | Prioridad |
| --- | --- | --- | --- |
| defer en Spline viewer | 🔴 Muy Alto | Mínimo | P0 |
| WebP para todas las imágenes | Alto | Medio | P1 |
| Lazy loading en imágenes | Alto | Bajo | P1 |
| Preload hero images | Medio | Bajo | P2 |
| Pausar canvas off-screen | Medio | Medio | P2 |
| CSS separado y minificado | Medio | Medio | P3 |
| JS separado y minificado | Medio | Medio | P3 |
| Eliminar Spline (si se reemplaza) | Muy Alto | Alto | P1 (si aplica) |
| Font subsetting (solo caracteres usados) | Bajo | Medio | P4 |
| Service Worker básico | Bajo | Alto | P5 |

### Conversión de Imágenes a WebP

```bash
# Para cada imagen JPG/PNG
cwebp -q 85 assets/problem-tiempo.jpg -o assets/problem-tiempo.webp
cwebp -q 85 assets/dashboard-mockup.png -o assets/dashboard-mockup.webp
# etc.
```

### Preload de imágenes críticas

```html
<link rel="preload" as="image" href="assets/dashboard-mockup.webp">
```

---

## RIESGOS — COMPLETO

### Riesgos Visuales

| Riesgo | Descripción | Mitigación |
| -------- | ------------- | ------------ |
| Pérdida de identidad visual | Cambios de design pueden perder la atmósfera actual | Implementar por secciones, comparar antes/después |
| Sobrediseño | Agregar demasiados efectos encima de los existentes | Regla: si agregas un efecto, quita otro |
| Inconsistencia entre secciones | La hero es mucho más rica que las demás | Elevar o simplificar todo a un mismo nivel |

### Riesgos Técnicos

| Riesgo | Descripción | Mitigación |
| -------- | ------------- | ------------ |
| Romper el hero al cerrar el section | El bug de HTML anidado podría tener efectos CSS dependientes | Testear en staging antes de producción |
| Spline sin defer — dependencia | Partes del JS pueden depender del orden de carga | Verificar que el spline-viewer se inicializa correctamente con defer |
| 159 reinicios de PM2 | Proceso inestable puede caer en producción | Investigar logs antes de tocar nada |
| Modificar CSS monolítico | 1903 líneas en un archivo = alta probabilidad de regresiones | Siempre testear todas las secciones después de cada cambio |

### Riesgos Comerciales

| Riesgo | Descripción | Mitigación |
| -------- | ------------- | ------------ |
| Testimoniales ficticios | Si un prospecto los verifica y son fake = destrucción de confianza | Reemplazar o eliminar ANTES de cualquier campaña |
| Métricas inventadas | Mismo efecto que testimoniales falsos | Reemplazar con datos reales o eliminar |
| Funnel solo WhatsApp | Un solo punto de contacto = alta fricción para algunos segmentos | Evaluar agregar formulario alternativo |

### Riesgos de Performance

| Riesgo | Descripción | Mitigación |
| -------- | ------------- | ------------ |
| Spline 3D | Puede ser 20-50MB de assets | Medir tamaño exacto, evaluar alternativa |
| Canvas siempre activo | CPU continuo = batería / calor en mobile | Pausar cuando fuera del viewport |
| Google Fonts | Puede causar render blocking | Usar font-display: swap + preconnect |

### Riesgos de Sobreingeniería

| Riesgo | Descripción | Mitigación |
| -------- | ------------- | ------------ |
| Migrar a React sin necesidad | Semanas de trabajo por un HTML que ya funciona | Evaluar si el beneficio justifica el costo |
| Instalar Tailwind encima del CSS actual | Duplicación de sistema de diseño | Solo si se refactoriza el CSS completamente |
| Agregar más animaciones | Ya hay demasiadas | Regla: quitar antes de agregar |

---

## ROLLBACK PLAN

**Antes de cualquier modificación:**

```bash
# Backup del archivo actual
cp index.html index.html.bak_$(date +%Y%m%d)

# Git snapshot
git add -A && git commit -m "backup: pre-optimization snapshot $(date)"
```

**Para revertir:**

```bash
# Restaurar desde backup
cp index.html.bak_YYYYMMDD index.html
pm2 restart roma-webchat
```

**Backup completo del servidor:**

```bash
# Ya existe en /home/juanpi/Roma/backups/
# Crear nuevo antes de empezar
tar -czf /home/juanpi/Roma/backups/roma-landing-pre-redesign-$(date +%Y%m%d).tar.gz \
  /home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/
```

---

## ARCHIVOS A MODIFICAR (POR FASE)

### Quick Wins

```
/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html
  - Línea 1255: cerrar </section> del hero
  - Línea 20: agregar defer al Spline script
  - Líneas 263-267: eliminar primer .hero-left p duplicado
  - Líneas 357-360: ajustar segundo .hero-left p
  - Líneas 313-322 y 372-393: unificar .marquee-track
  - Todas las <img>: agregar loading="lazy" excepto hero
  - Línea 1900: mover webchat CSS al head
  - JS del cursor: wrappear en pointer: fine check
```

### Fase Visual

```
/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html
  - CSS: spacing scale
  - CSS: gradient unification
  - CSS: pricing card glow
  - HTML: pricing data-reveal
  - HTML: footer links completar
```

### Fase Branding

```
/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/assets/
  - Reemplazar icono-*.png por SVGs
  - Confirmar logo definitivo
  - Agregar favicon PNG como fallback

/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html
  - head: favicon PNG fallback
  - head: apple-touch-icon
```

### Fase CRO

```
/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html
  - Sección #testimonials: actualizar contenido
  - Hero stats: actualizar métricas
  - Urgency indicator: actualizar número
  - CTA copy: optimizar
```

### Fase Performance

```
/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/assets/
  - Crear versiones .webp de todas las JPG/PNG

/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/index.html
  - Cambiar src de imágenes a .webp con fallback
  - Agregar preload para imágenes críticas
  - Modificar animateCanvas para pausar off-screen
```

---

## PREGUNTAS PARA APROBACIÓN DE JUANPI

Las siguientes preguntas deben responderse ANTES de iniciar la implementación:

**🔴 CRÍTICAS (bloquean el plan):**

1. **Testimoniales**: ¿Son reales Laura Méndez, Carlos Rivera y Ana Parra? Si no → ¿qué hacemos con la sección?

2. **Métricas del hero**: ¿Son datos reales? (10K+ leads, 92%, 2 min, 20h)

3. **Spline 3D**: ¿Es asset propio? ¿Querés mantenerlo, reemplazarlo, o quitarlo?

4. **ZIP faltante**: ¿Cuándo sube el archivo "Archivos Para Crear Web Con Claude.zip"?

**🟡 IMPORTANTES (definen la dirección):**

1. **Arquitectura**: ¿Mantener HTML vanilla o migrar a Astro/Next.js?

2. **CTA**: ¿Solo WhatsApp o agregar canal alternativo de conversión?

3. **Precios**: ¿$299/$599/$1,499 son reales? ¿El trial de 14 días es real?

4. **WordPress**: ¿Se usa para algo? ¿O lo apagamos?

5. **Público objetivo**: ¿Cuál es el segmento principal que querés capturar?

**🟢 OPCIONALES (afectan ejecución pero no el plan base):**

1. **Nivel de efecto visual**: ¿Mantener el nivel actual de animaciones o ir a algo más clean tipo Linear?

2. **Logo definitivo**: ¿Cuál de los múltiples SVGs de logo es el correcto?

3. **Cursor custom**: ¿Mantenerlo en desktop o eliminarlo?

---

## CRONOGRAMA ESTIMADO

| Fase | Tiempo estimado | Bloqueador |
| ------ | ---------------- | ------------ |
| Prerrequisitos | 1-2 días | JuanPi |
| Quick Wins | 1 día | Ninguno |
| Fase Visual | 3-5 días | Decisión visual de JuanPi |
| Fase Branding | 2-3 días | Logo definitivo |
| Fase CRO | 2-3 días | Testimoniales reales |
| Fase Performance | 1-2 días | Ninguno |
| QA + Testing | 1 día | Todo lo anterior |
| **Total** | **~2 semanas** | |

---

*Documento creado automáticamente — 2026-05-28*
*Claude Sonnet 4.6 — Fase 6 del MASTER GOD PROMPT*
*Estado: PENDIENTE APROBACIÓN*
