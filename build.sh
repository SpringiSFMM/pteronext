#!/usr/bin/env bash
# ==============================================================================
# PteroNext Panel - Single-Binary Build Script
# Compiles modern frontend + Go backend with go:embed into a standalone binary
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
CORE_DIR="${SCRIPT_DIR}/core"
DIST_DIR="${FRONTEND_DIR}/dist"
EMBED_DIR="${CORE_DIR}/pkg/web/dist"
OUTPUT_DIR="${SCRIPT_DIR}/bin"
BINARY_NAME="pteronext"

# ANSI Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

print_banner() {
    echo -e "${PURPLE}${BOLD}"
    echo "  ╔═══════════════════════════════════════════════════════╗"
    echo "  ║        PteroNext - Single-Binary Compiler Tool       ║"
    echo "  ║      Next-Gen Cloud-Native Game Server Platform       ║"
    echo "  ╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --docker          Build single-binary production Docker image"
    echo "  --cross-platform  Cross-compile static binaries for Linux (amd64, arm64) & macOS"
    echo "  --skip-frontend   Skip frontend build and embed current dist/placeholder"
    echo "  --clean           Clean previous build artifacts and exit"
    echo "  --help            Show this help message"
    echo ""
}

clean_build() {
    log_info "Cleaning build artifacts..."
    rm -rf "${OUTPUT_DIR}"
    rm -rf "${DIST_DIR}"
    log_success "Clean completed."
}

# Parse command line flags
BUILD_DOCKER=false
CROSS_PLATFORM=false
SKIP_FRONTEND=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --docker)
            BUILD_DOCKER=true
            shift
            ;;
        --cross-platform)
            CROSS_PLATFORM=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --clean)
            clean_build
            exit 0
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

print_banner

# Docker build pathway
if [ "${BUILD_DOCKER}" = true ]; then
    log_info "Building production Single-Binary Docker image 'pteronext/panel:latest'..."
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed or not in PATH."
        exit 1
    fi
    docker build -t pteronext/panel:latest -f "${SCRIPT_DIR}/Dockerfile" "${SCRIPT_DIR}"
    log_success "Docker image pteronext/panel:latest successfully created!"
    exit 0
fi

# Step 1: Frontend compilation
mkdir -p "${EMBED_DIR}"

if [ "${SKIP_FRONTEND}" = false ]; then
    log_info "Step 1/3: Compiling modern Vite + React frontend..."
    if ! command -v npm >/dev/null 2>&1; then
        log_warn "npm not found. Using fallback embedded static assets."
    else
        if [ -d "${FRONTEND_DIR}" ]; then
            cd "${FRONTEND_DIR}"
            if [ ! -d "node_modules" ]; then
                log_info "Installing frontend dependencies..."
                npm install --silent
            fi
            log_info "Building production frontend bundle..."
            if npm run build; then
                log_success "Frontend compilation successful."
                log_info "Copying compiled distribution to Go embed path: ${EMBED_DIR}"
                rm -rf "${EMBED_DIR:?}"/*
                cp -R "${DIST_DIR}"/* "${EMBED_DIR}/"
            else
                log_warn "Frontend build encountered errors. Using existing assets in ${EMBED_DIR}"
            fi
        else
            log_warn "Frontend directory not found at ${FRONTEND_DIR}. Skipping frontend build."
        fi
    fi
else
    log_info "Step 1/3: Skipping frontend build (--skip-frontend)."
fi

# Ensure embed directory has at least an index.html so go:embed doesn't fail
if [ ! -f "${EMBED_DIR}/index.html" ]; then
    log_info "Creating default embedded index.html fallback..."
    cat << 'EOF' > "${EMBED_DIR}/index.html"
<!doctype html>
<html>
<head><title>PteroNext Panel</title></head>
<body style="background:#0b0f19;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
  <div style="text-align:center;">
    <h1 style="color:#38bdf8;">PteroNext Panel</h1>
    <p style="color:#94a3b8;">Embedded Single-Binary Server is running.</p>
  </div>
</body>
</html>
EOF
fi

# Step 2: Go Backend Compilation
log_info "Step 2/3: Compiling statically-linked Go binary with embedded assets..."
if ! command -v go >/dev/null 2>&1; then
    log_error "Go compiler (golang) is not installed. Please install Go 1.22+ or use --docker."
    exit 1
fi

mkdir -p "${OUTPUT_DIR}"
cd "${CORE_DIR}"

VERSION=$(git describe --tags --always 2>/dev/null || echo "v2.0.0-nextgen")
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LDFLAGS="-s -w -X 'main.Version=${VERSION}' -X 'main.BuildTime=${BUILD_TIME}'"

# Determine Go target entrypoint
ENTRYPOINT="."
if [ -f "${CORE_DIR}/cmd/server/main.go" ]; then
    ENTRYPOINT="./cmd/server"
elif [ -f "${CORE_DIR}/main.go" ]; then
    ENTRYPOINT="."
fi

if [ "${CROSS_PLATFORM}" = true ]; then
    log_info "Building multi-platform static binaries..."

    log_info "Compiling Linux (amd64)..."
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="${LDFLAGS} -extldflags '-static'" -trimpath -o "${OUTPUT_DIR}/${BINARY_NAME}-linux-amd64" ${ENTRYPOINT}

    log_info "Compiling Linux (arm64)..."
    CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="${LDFLAGS} -extldflags '-static'" -trimpath -o "${OUTPUT_DIR}/${BINARY_NAME}-linux-arm64" ${ENTRYPOINT}

    log_info "Compiling macOS (darwin arm64)..."
    CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="${LDFLAGS}" -trimpath -o "${OUTPUT_DIR}/${BINARY_NAME}-darwin-arm64" ${ENTRYPOINT}

    log_info "Compiling macOS (darwin amd64)..."
    CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="${LDFLAGS}" -trimpath -o "${OUTPUT_DIR}/${BINARY_NAME}-darwin-amd64" ${ENTRYPOINT}

    log_success "All cross-platform binaries compiled in ${OUTPUT_DIR}/:"
    ls -lh "${OUTPUT_DIR}"
else
    TARGET_FILE="${OUTPUT_DIR}/${BINARY_NAME}"
    log_info "Compiling native binary: ${TARGET_FILE}"
    CGO_ENABLED=0 go build -ldflags="${LDFLAGS} -extldflags '-static'" -trimpath -o "${TARGET_FILE}" ${ENTRYPOINT}
    chmod +x "${TARGET_FILE}"

    FILE_SIZE=$(ls -lh "${TARGET_FILE}" | awk '{print $5}')
    log_success "Step 3/3: Standalone Single-Binary successfully produced!"
    echo ""
    echo -e "  ${GREEN}✔ Binary Location:${NC} ${TARGET_FILE}"
    echo -e "  ${GREEN}✔ Binary Size:${NC}     ${FILE_SIZE}"
    echo -e "  ${GREEN}✔ Architecture:${NC}    $(uname -s)/$(uname -m)"
    echo -e "  ${GREEN}✔ Features:${NC}        Embedded Web UI, Pure-Go SQLite WAL, Wings Client API, JWT Auth"
    echo ""
    echo "To test run locally:"
    echo "  ${TARGET_FILE} --help"
fi
