#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# ---------------------------------------------------------------------------
# backup_db.sh — Full Superset backup: metadata DB, assets export, and volume.
#
# Usage:
#   ./docker/backup_db.sh [output_dir]
#
#   output_dir  Directory to write all backup files into (default: ./backups)
#
# What gets backed up:
#   1. Metadata DB   — plain SQL dump via pg_dump
#   2. Assets ZIPs   — dashboards (export-dashboards) + datasources (export-datasources)
#   3. Volume TAR    — raw Docker volume snapshot (superset_db_home)
#
# Override via environment variables or docker/.env-local:
#   DB_CONTAINER      (default: superset_db)
#   APP_CONTAINER     (default: superset_app)
#   DB_VOLUME         (default: superset_db_home)
#   POSTGRES_USER     (default: superset)
#   POSTGRES_PASSWORD (default: superset)
#   POSTGRES_DB       (default: superset)
#   SKIP_ASSETS       set to 1 to skip the assets export step
#   SKIP_VOLUME       set to 1 to skip the volume backup step
# ---------------------------------------------------------------------------

set -euo pipefail

# ── Helpers ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
section() { echo ""; echo -e "${GREEN}━━━ $* ━━━${NC}"; }

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
ENV_LOCAL_FILE="${SCRIPT_DIR}/.env-local"

# shellcheck disable=SC1090
[ -f "${ENV_FILE}" ]       && set -a && source "${ENV_FILE}"       && set +a
# shellcheck disable=SC1090
[ -f "${ENV_LOCAL_FILE}" ] && set -a && source "${ENV_LOCAL_FILE}" && set +a

DB_CONTAINER="${DB_CONTAINER:-superset_db}"
APP_CONTAINER="${APP_CONTAINER:-superset_app}"
DB_VOLUME="${DB_VOLUME:-superset_db_home}"
POSTGRES_USER="${POSTGRES_USER:-superset}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-superset}"
POSTGRES_DB="${POSTGRES_DB:-superset}"
SKIP_ASSETS="${SKIP_ASSETS:-0}"
SKIP_VOLUME="${SKIP_VOLUME:-0}"

OUTPUT_DIR="${1:-${SCRIPT_DIR}/../backups}"
OUTPUT_DIR="$(realpath "${OUTPUT_DIR}")"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${OUTPUT_DIR}/${TIMESTAMP}"

mkdir -p "${BACKUP_DIR}"

echo ""
echo "=================================================="
echo "  SUPERSET FULL BACKUP"
echo "=================================================="
info "Timestamp  : ${TIMESTAMP}"
info "Output dir : ${BACKUP_DIR}"
echo ""

ERRORS=0

# ── Step 1: Metadata DB dump ──────────────────────────────────────────────────
section "Step 1: Metadata Database (pg_dump)"

DB_BACKUP_FILE="${BACKUP_DIR}/superset_metadata_${TIMESTAMP}.sql"

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  error "Container '${DB_CONTAINER}' is not running — skipping DB backup."
  ERRORS=$((ERRORS + 1))
else
  info "Dumping '${POSTGRES_DB}' from container '${DB_CONTAINER}'..."
  docker exec \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    "${DB_CONTAINER}" \
    pg_dump \
      --username="${POSTGRES_USER}" \
      --dbname="${POSTGRES_DB}" \
      --format=plain \
      --no-password \
    > "${DB_BACKUP_FILE}"

  DB_SIZE="$(du -sh "${DB_BACKUP_FILE}" | cut -f1)"
  info "Done. File: ${DB_BACKUP_FILE} (${DB_SIZE})"
fi

# ── Step 2: Assets export (dashboards + datasources) ─────────────────────────
section "Step 2: Assets Export (dashboards + datasources)"

DASHBOARDS_BACKUP_FILE="${BACKUP_DIR}/superset_dashboards_${TIMESTAMP}.zip"
DATASOURCES_BACKUP_FILE="${BACKUP_DIR}/superset_datasources_${TIMESTAMP}.zip"

if [ "${SKIP_ASSETS}" = "1" ]; then
  warn "SKIP_ASSETS=1 — skipping assets export."
elif ! docker ps --format '{{.Names}}' | grep -q "^${APP_CONTAINER}$"; then
  warn "Container '${APP_CONTAINER}' is not running — skipping assets export."
  warn "  Set APP_CONTAINER if your app container has a different name."
  ERRORS=$((ERRORS + 1))
else
  REMOTE_DASHBOARDS="/tmp/superset_dashboards_${TIMESTAMP}.zip"
  REMOTE_DATASOURCES="/tmp/superset_datasources_${TIMESTAMP}.zip"

  info "Exporting dashboards from container '${APP_CONTAINER}'..."
  docker exec "${APP_CONTAINER}" \
    superset export-dashboards -f "${REMOTE_DASHBOARDS}"
  docker cp "${APP_CONTAINER}:${REMOTE_DASHBOARDS}" "${DASHBOARDS_BACKUP_FILE}"
  docker exec "${APP_CONTAINER}" rm -f "${REMOTE_DASHBOARDS}"
  DASH_SIZE="$(du -sh "${DASHBOARDS_BACKUP_FILE}" | cut -f1)"
  info "Done. File: ${DASHBOARDS_BACKUP_FILE} (${DASH_SIZE})"

  info "Exporting datasources from container '${APP_CONTAINER}'..."
  docker exec "${APP_CONTAINER}" \
    superset export-datasources -f "${REMOTE_DATASOURCES}"
  docker cp "${APP_CONTAINER}:${REMOTE_DATASOURCES}" "${DATASOURCES_BACKUP_FILE}"
  docker exec "${APP_CONTAINER}" rm -f "${REMOTE_DATASOURCES}"
  DS_SIZE="$(du -sh "${DATASOURCES_BACKUP_FILE}" | cut -f1)"
  info "Done. File: ${DATASOURCES_BACKUP_FILE} (${DS_SIZE})"
fi

# ── Step 3: Docker volume snapshot ────────────────────────────────────────────
section "Step 3: Docker Volume Snapshot (${DB_VOLUME})"

VOLUME_BACKUP_FILE="${BACKUP_DIR}/superset_volume_${TIMESTAMP}.tar.gz"

if [ "${SKIP_VOLUME}" = "1" ]; then
  warn "SKIP_VOLUME=1 — skipping volume backup."
elif ! docker volume ls --format '{{.Name}}' | grep -q "^${DB_VOLUME}$"; then
  warn "Volume '${DB_VOLUME}' not found — skipping volume backup."
  warn "  Set DB_VOLUME if your volume has a different name."
  ERRORS=$((ERRORS + 1))
else
  info "Snapshotting volume '${DB_VOLUME}'..."
  docker run --rm \
    -v "${DB_VOLUME}:/volume" \
    -v "${BACKUP_DIR}:/backup" \
    alpine \
    tar -czf "/backup/$(basename "${VOLUME_BACKUP_FILE}")" -C /volume .

  VOL_SIZE="$(du -sh "${VOLUME_BACKUP_FILE}" | cut -f1)"
  info "Done. File: ${VOLUME_BACKUP_FILE} (${VOL_SIZE})"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo "  BACKUP SUMMARY"
echo "=================================================="
info "All files written to: ${BACKUP_DIR}"
echo ""
ls -lh "${BACKUP_DIR}"
echo ""

if [ "${ERRORS}" -gt 0 ]; then
  warn "${ERRORS} step(s) had warnings or errors — review output above."
  exit 1
fi

info "Full backup complete."
