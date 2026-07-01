# Frontend (Vite/React) — build estático servido por nginx. Parte do docker compose (Entrega 5).
# Multi-stage: compila a SPA no Node e serve o dist/ com nginx (imagem final pequena).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
