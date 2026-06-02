module.exports = {
  apps: [
    {
      name: 'roma-webchat',
      script: 'server.js',
      cwd: '/home/juanpi/Roma/trabajo/ROMA_AI_3_0/02-web-roma-ai-landing',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DEEPSEEK_API_KEY: 'sk-b61eefddb03943009fc514d090345b43',
        DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
        ROMA_AI_PROVIDER: 'deepseek',
        ROMA_AI_MODEL: 'deepseek-chat',
        WHATSAPP_US_NUMBER: '12019696812',
      },
    },
  ],
};
