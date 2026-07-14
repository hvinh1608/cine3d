FROM node:20-alpine AS build

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY prisma ./prisma/

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 5000

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate
COPY --from=build /app/dist ./dist

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && node dist/index.js"]
