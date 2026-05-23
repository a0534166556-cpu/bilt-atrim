FROM node:20-alpine AS build
WORKDIR /app

COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install --prefix server && npm install --prefix client

COPY server ./server
COPY client ./client

RUN npm run build --prefix client

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

RUN npm install --prefix server --omit=dev

EXPOSE 3001

CMD ["node", "server/index.js"]
