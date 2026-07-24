FROM node:20-alpine

# bcrypt compila un addon nativo al instalar (necesita toolchain de C)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY services/backend-api/package.json services/backend-api/package.json
COPY services/gateway-ble/package.json services/gateway-ble/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

WORKDIR /app/services/backend-api

EXPOSE 8000

CMD ["npm", "run", "dev"]
