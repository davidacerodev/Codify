# ---- Etapa 1: Dependencias ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci \
  && sha256sum package.json package-lock.json | sha256sum | cut -d ' ' -f 1 > node_modules/.codify-dependency-lock

# ---- Etapa 2: Desarrollo ----
FROM node:22-alpine AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY docker/dev-entrypoint.sh /usr/local/bin/codify-dev-entrypoint
RUN chmod +x /usr/local/bin/codify-dev-entrypoint
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["/usr/local/bin/codify-dev-entrypoint"]

# Herramientas aisladas por perfil: la app web no necesita acceso al daemon Docker.
FROM development AS supabase-cli
RUN apk add --no-cache docker-cli

FROM development AS ui-test
RUN apk add --no-cache chromium docker-cli
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium

# ---- Etapa 3: Builder (producción) ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Etapa 4: Producción ----
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
