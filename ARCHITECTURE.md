# Roma AI — Arquitectura

## Componentes

### 1. Telegram Bot (`src/telegram-bot/bot.js`)
- Bot de Telegram autónomo (NO es Luka/Hermes)
- Usa `node-telegram-bot-api`
- Funciona con OpenAI API para respuestas y transcripción de audio
- **Estado:** Funcional. 653 líneas.

### 2. WhatsApp Bot (`src/whatsapp-bot/bot.js`)
- Bot de WhatsApp autónomo
- Usa OpenAI API para transcripción de audio (whisper) y TTS
- **Estado:** Código presente, no está conectado al gateway de Hermes (WhatsApp not paired)

### 3. Web Chat Landing (`trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/`)
- Landing page con chat web en puerto 3000
- Usa `ai-client.js` como provider de IA
- Configurado con DeepSeek via `ecosystem.config.js`
- **Estado:** Funcional.

### 4. Módulos Compartidos (`src/shared/`)
| Archivo | Función | Estado |
|---------|---------|--------|
| `claude.js` | Cliente OpenAI para chat/respuestas | Funcional |
| `security.js` | Validación de formato de env vars | Funcional |
| `load-env.js` | Carga de .env | Funcional |

## Providers de IA

Cada componente maneja su propio provider. No hay un módulo unificado:

| Componente | Provider default | Modelo |
|------------|-----------------|--------|
| telegram-bot/bot.js | OpenAI API | gpt-4o-mini |
| whatsapp-bot/bot.js | OpenAI API (audio) | whisper + tts-1 |
| ai-client.js (landing) | DeepSeek (configurable via `ROMA_AI_PROVIDER`) | deepseek-chat |
| claude.js (shared) | OpenAI API | gpt-4o-mini |

## Conexión con Hermes/Luka

- **Independiente.** Roma NO depende de Hermes para funcionar
- Hermes corre como gateway aparte (systemd service)
- Luka es el bot de Telegram de Hermes, diferente del telegram-bot de Roma
- El dashboard de Hermes (puerto 5051) es independiente de la landing page de Roma (puerto 3000)

## Archivos obsoletos (archivados)

```
~/Roma/archive/
├── logo-roma-full.png.bak
├── logo-roma-symbol.png.bak
└── login.html.bak

~/Roma/src/telegram-bot/archive/
├── bot.js.bak              (copia idéntica de bot.js)
├── bot.js.bak2             (versión alternativa 283 líneas)
└── bot.js.broken-20260526_2320  (intento fallido)
```
