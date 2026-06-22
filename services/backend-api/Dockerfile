# Stage 1: Instalar dependencias de producción
FROM node:20-alpine AS deps
WORKDIR /app

# Copiamos los package.json del monorepo
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services/backend-api/package.json ./services/backend-api/

# Usamos npm install en vez de ci porque puede que no exista el package-lock.json.
# Al usar --workspace, npm resolverá correctamente la dependencia @safeplace/shared local.
RUN npm install --workspace=services/backend-api --omit=dev

# Stage 2: Construir imagen final
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Usar un usuario no root por seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copiamos los node_modules desde la raíz (ya que es un monorepo)
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/packages ./packages

# Copiamos el código del backend
COPY --chown=nodejs:nodejs services/backend-api ./services/backend-api

USER nodejs
EXPOSE 3000

# Nos movemos a la carpeta del backend para ejecutar el script
WORKDIR /app/services/backend-api
CMD ["node", "src/app.js"]
