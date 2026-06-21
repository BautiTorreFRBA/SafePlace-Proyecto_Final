# Stage 1: Instalar dependencias de producción
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Stage 2: Construir imagen final
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Usar un usuario no root por seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

# Render inyecta PORT dinámicamente o usa el 3000 por defecto
EXPOSE 3000

CMD ["node", "src/app.js"]
