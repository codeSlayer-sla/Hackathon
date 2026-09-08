FROM node:22-slim AS build
WORKDIR /srv
COPY shared-ts /shared-ts
COPY services/frontend/package.json services/frontend/package-lock.json* /srv/
RUN npm install
COPY services/frontend /srv
ARG VITE_ROUTER_URL=http://localhost:8001
ARG VITE_INSTALLED_BASE_URL=http://localhost:8005
ENV VITE_ROUTER_URL=$VITE_ROUTER_URL
ENV VITE_INSTALLED_BASE_URL=$VITE_INSTALLED_BASE_URL
RUN npm run build

FROM node:22-slim
WORKDIR /srv
COPY --from=build /srv/dist /srv/dist
RUN npm install -g serve
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
