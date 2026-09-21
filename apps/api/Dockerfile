FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm install

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

RUN npm run build --workspace=@ehr/shared
RUN npm run build --workspace=@ehr/api

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 5000
CMD ["node", "apps/api/dist/server.js"]
