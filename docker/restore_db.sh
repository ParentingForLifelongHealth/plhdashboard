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
# restore_db.sh — Restore the Superset PostgreSQL database into the running
#                 superset_db container from a backup produced by backup_db.sh.
#
# Usage:
#   ./docker/restore_db.sh <backup_file>
#
#   backup_file   Path to a .dump file created by backup_db.sh (required).
#
# ⚠  WARNING: This DROPS and RECREATES the target database. All existing data
#             will be permanently lost. The script asks for confirmation before
#             proceeding unless FORCE=1 is set.
#
# Override database credentials via environment variables or docker/.env-local:
#   POSTGRES_USER     (default: superset)
#   POSTGRES_PASSWORD (default: superset)
#   POSTGRES_DB       (default: superset)
#   DB_CONTAINER      (default: superset_db)
# ---------------------------------------------------------------------------

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
ENV_LOCAL_FILE="${SCRIPT_DIR}/.env-local"

# shellcheck disable=SC1090
[ -f "${ENV_FILE}" ] && set -a && source "${ENV_FILE}" && set +a
# shellcheck disable=SC1090
[ -f "${ENV_LOCAL_FILE}" ] && set -a && source "${ENV_LOCAL_FILE}" && set +a

DB_CONTAINER="${DB_CONTAINER:-superset_db}"
POSTGRES_USER="${POSTGRES_USER:-superset}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-superset}"
POSTGRES_DB="${POSTGRES_DB:-superset}"
FORCE="${FORCE:-0}"

# ── Argument validation ───────────────────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file>" >&2
  echo "  backup_file  Path to a .sql file created by backup_db.sh" >&2
  exit 1
fi

BACKUP_FILE="$(realpath "$1")"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "ERROR: Container '${DB_CONTAINER}' is not running." >&2
  exit 1
fi

# ── Confirmation prompt ───────────────────────────────────────────────────────
echo "=========================================================="
echo " SUPERSET DATABASE RESTORE"
echo "=========================================================="
echo "  Container : ${DB_CONTAINER}"
echo "  Database  : ${POSTGRES_DB}"
echo "  Backup    : ${BACKUP_FILE}"
echo "=========================================================="
echo "⚠  WARNING: This will DROP and RECREATE '${POSTGRES_DB}'."
echo "   All existing data will be permanently lost."
echo ""

if [ "${FORCE}" != "1" ]; then
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# ── Drop and recreate the database ───────────────────────────────────────────
echo "Dropping existing database '${POSTGRES_DB}'..."
docker exec \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  "${DB_CONTAINER}" \
  psql \
    --username="${POSTGRES_USER}" \
    --dbname="postgres" \
    --no-password \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" \
    -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";" \
    -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"

# ── Restore ───────────────────────────────────────────────────────────────────
echo "Restoring '${POSTGRES_DB}' from backup..."
docker exec -i \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  "${DB_CONTAINER}" \
  psql \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --no-password \
  < "${BACKUP_FILE}"

echo ""
echo "Restore complete."
echo "  Restart the superset_app and superset_worker containers if they are running:"
echo "    docker restart superset_app superset_worker"
