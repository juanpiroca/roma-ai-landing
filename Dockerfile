FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000 3001 3010

CMD ["node", "src/telegram-bot/bot.js"]
