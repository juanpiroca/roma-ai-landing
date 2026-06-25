# 🔐 Integración de Clerk en Roma AI

Guía para integrar autenticación Clerk en el proyecto Roma AI.

## Paso 1: Crear cuenta y aplicación en Clerk

1. Ve a <https://clerk.com/>
2. Click "Sign up" → crea cuenta gratuita
3. Crea una nueva "Application"
4. Elige "Email + Password" como método de autenticación (o agrega Google/GitHub si quieres)

## Paso 2: Obtener API Keys

1. En el Dashboard de Clerk → Settings → API Keys
2. Copia:
   - `CLERK_PUBLISHABLE_KEY` (empieza con `pk_test_` o `pk_live_`)
   - `CLERK_SECRET_KEY` (empieza con `sk_test_` o `sk_live_`)

## Paso 3: Configurar URLs permitidas

1. Settings → General → Allowed Redirect URLs
2. Agrega:
   - `https://roma.dementetv.com`
   - `https://roma.dementetv.com/callback`
   - `http://localhost:3000` (para desarrollo local)

## Paso 4: Actualizar .env

```bash
# Edita el archivo .env del proyecto
nano .env
```

Reemplaza las variables vacías:

```
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
CLERK_REDIRECT_URL=https://roma.dementetv.com
```

## Paso 5: Integrar Clerk en server.js

En `server.js`, después de las imports:

```javascript
const { clerkAuthMiddleware } = require('./clerk-middleware');

// ... otros middlewares ...

// Agregar antes de las rutas
app.use(clerkAuthMiddleware);

// Ruta para obtener usuario actual
app.get('/api/user', (req, res) => {
  res.json(req.user || { authenticated: false });
});

// Ruta para logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('__session');
  res.json({ success: true });
});
```

## Paso 6: Actualizar index.html

Agregar script de Clerk antes del `</body>`:

```html
<script
  async
  crossOrigin="anonymous"
  data-clerk-publishable-key="YOUR_PUBLISHABLE_KEY"
  src="https://cdn.clerk.com/clerk.js"
></script>
```

Y agregar componentes de Clerk en la navbar:

```html
<!-- Reemplaza el botón "Iniciar sesión" -->
<div id="user-button"></div>

<script>
  window.addEventListener('load', () => {
    // Si el usuario está autenticado, mostrar su nombre
    Clerk.load().then(() => {
      if (Clerk.user) {
        document.getElementById('user-button').innerHTML = 
          `<span>${Clerk.user.firstName}</span>`;
      } else {
        // Mostrar botón de login
        const btn = document.createElement('button');
        btn.textContent = 'Iniciar sesión';
        btn.onclick = () => Clerk.openSignIn();
        document.getElementById('user-button').appendChild(btn);
      }
    });
  });
</script>
```

## Paso 7: Usar el nuevo chatbot mejorado

1. Reemplaza el webchat actual en `index.html` con `webchat-improved.html`
2. O integra el formulario de captura en el widget actual

## Paso 8: Probar

```bash
# Reinicia el servidor
pm2 restart roma-webchat

# Visita
https://roma.dementetv.com

# Prueba el login y el chatbot
```

## Archivos creados

- `clerk-middleware.js` — Middleware de autenticación para Express
- `webchat-improved.html` — Chat mejorado con captura de leads
- `.env` — Variables de Clerk (completa con tus keys)

## ¿Necesitas ayuda?

Si tienes problemas:

1. Verifica que las keys están correctas en `.env`
2. Revisa la consola de Chrome (F12) para errores de Clerk
3. Abre <https://dashboard.clerk.com> para ver logs

---

**Estado:** ⏳ Pendiente credenciales de Clerk
**Próximo paso:** Pega las API keys y ejecuta Paso 4-5
