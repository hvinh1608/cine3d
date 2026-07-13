FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY prisma ./prisma/

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && node dist/index.js"]
