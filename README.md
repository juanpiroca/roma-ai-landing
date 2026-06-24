<!-- markdownlint-disable MD013 MD029 MD034 MD026 MD022 MD032 -->
# Roma AI

Roma AI is an autonomous AI marketing system designed specifically for Latin American businesses. It provides a multi-channel AI assistant capability (Telegram, WhatsApp, Web Chat) to engage with customers, handle inquiries, and automate workflows.

## Features

- **Multi-channel Support:**
  - **Telegram Bot**: Autonomous Telegram assistant using OpenAI.
  - **WhatsApp Bot**: Autonomous WhatsApp assistant with whisper transcription and TTS.
  - **Web Chat**: A landing page with an integrated web chat (DeepSeek powered).
- **Audio Processing:** Transcribes audio messages via Whisper.
- **Independent Architecture:** Each bot runs autonomously.

## Components

The system is composed of several key modules:

1. **Telegram Bot** (`src/telegram-bot/bot.js`): Handles Telegram interactions using OpenAI API.
2. **WhatsApp Bot** (`src/whatsapp-bot/bot.js`): Handles WhatsApp interactions, including audio processing.
3. **Web Chat Landing** (`trabajo/ROMA_AI_3_0/02-web-roma-ai-landing/`): A web-based chat interface.
4. **Shared Modules** (`src/shared/`): Common utilities for security, environment loading, and AI integrations (Claude, OpenAI).

## How to Run

### Prerequisites

- Node.js (v18+ recommended)
- Docker & Docker Compose (for containerized execution)
- API Keys (OpenAI, DeepSeek, Anthropic, etc.) depending on the module you want to run.

### Setup

1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in the required API keys and configuration parameters:

   ```bash
   cp .env.example .env
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

### Running Locally (Docker)

You can run the various components using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- `telegram-bot`
- `voice-bridge`
- `dashboard`

### Running the Web Chat Landing

Navigate to the web chat directory and start the server:

```bash
cd trabajo/ROMA_AI_3_0/02-web-roma-ai-landing
npm install
npm start
```

Alternatively, you can use PM2 with the provided `ecosystem.config.js`.

## Architecture Details

For more details on the architecture, please see `ARCHITECTURE.md`.
