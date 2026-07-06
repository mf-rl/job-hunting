#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# bootstrap.sh — Install forge-dashboard.service as a systemd
# user service, or fall back to the dashboard.sh wrapper.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

DASHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="${DASHBOARD_DIR}/forge-dashboard.service"

# Make scripts executable
chmod +x "${DASHBOARD_DIR}/backup.sh" "${DASHBOARD_DIR}/dashboard.sh"

# Try systemd --user
if systemctl --user list-units --all 2>/dev/null | grep -q .; then
    mkdir -p "${HOME}/.config/systemd/user/"
    cp "${SERVICE_FILE}" "${HOME}/.config/systemd/user/forge-dashboard.service"
    systemctl --user daemon-reload
    systemctl --user enable forge-dashboard.service
    systemctl --user start forge-dashboard.service
    echo "forge-dashboard: installed as systemd user service"
else
    echo "forge-dashboard: systemd not available — using dashboard.sh wrapper"
    "${DASHBOARD_DIR}/dashboard.sh" start
fi