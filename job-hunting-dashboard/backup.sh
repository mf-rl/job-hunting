#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# backup.sh — Snapshot the dashboard folder before edits.
# Creates a timestamped tarball in the parent directory.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

DASHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${DASHBOARD_DIR}/../_backups"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/job-hunting-dashboard-${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

# Exclude existing backups and __pycache__
tar czf "${BACKUP_FILE}" \
  --exclude="_backups" \
  --exclude="__pycache__" \
  --exclude="*.pyc" \
  -C "$(dirname "${DASHBOARD_DIR}")" \
  "$(basename "${DASHBOARD_DIR}")"

echo "OK  backup=${BACKUP_FILE}  size=$(du -h "${BACKUP_FILE}" | cut -f1)"