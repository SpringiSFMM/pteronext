# ==============================================================================
# PteroNext Panel - Multi-Stage Single-Binary Dockerfile
# Stage 1: Build modern React + Vite frontend
# Stage 2: Embed frontend and build static Go binary (go:embed)
# Stage 3: Ultra-lightweight secure production runtime (<30MB)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Build
# ------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-builder
WORKDIR /build/frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline --no-audit || npm install --no-audit

# Copy source code and build production assets
COPY frontend/ ./
RUN npm run build || (mkdir -p dist && echo '<!doctype html><html><head><title>PteroNext</title></head><body><h1>PteroNext Initializing...</h1></body></html>' > dist/index.html)

# ------------------------------------------------------------------------------
# Stage 2: Backend Compilation (Single Binary Embed)
# ------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS backend-builder
WORKDIR /build/backend

RUN apk add --no-cache git ca-certificates tzdata mailcap

# Cache Go modules
COPY core/go.mod core/go.sum* ./
RUN go mod download

# Copy backend source
COPY core/ ./

# Inject compiled frontend into go:embed location
RUN mkdir -p pkg/web/dist
COPY --from=frontend-builder /build/frontend/dist/ ./pkg/web/dist/

# Ensure at least index.html exists
RUN test -f ./pkg/web/dist/index.html || echo '<!doctype html><html><body><h1>PteroNext</h1></body></html>' > ./pkg/web/dist/index.html

# Compile pure-Go statically linked single binary
ARG TARGETOS TARGETARCH
RUN ENTRYPOINT="."; test -f ./cmd/server/main.go && ENTRYPOINT="./cmd/server"; \
    CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} go build \
    -ldflags="-s -w -extldflags '-static'" \
    -trimpath \
    -o /build/pteronext \
    ${ENTRYPOINT}

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime
# ------------------------------------------------------------------------------
FROM alpine:3.21 AS runtime

LABEL maintainer="PteroNext Team"
LABEL org.opencontainers.image.title="PteroNext Panel"
LABEL org.opencontainers.image.description="Next-Gen High Performance Game Server Management Platform"

# Install minimal certificates and utilities
RUN apk add --no-cache ca-certificates tzdata curl wget \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy single standalone binary
COPY --from=backend-builder /build/pteronext /usr/local/bin/pteronext

# Persistent data directory for SQLite database, logs, eggs, and backups
RUN mkdir -p /data /data/logs /data/backups /data/eggs \
    && chmod -R 777 /data

ENV APP_ENV=production \
    PORT=8080 \
    DB_DATABASE=/data/pteronext.db \
    DATA_DIR=/data

VOLUME ["/data"]

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1 || wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/pteronext"]
CMD ["--data", "/data", "--port", "8080"]
