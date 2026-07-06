#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# dashboard.sh — Manage the Forge Dashboard process.
# Usage: dashboard.sh {start|stop|restart|status}
# ──────────────────────────────────────────────────────────────
set -euo pipefail

DASHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="/home/mfrl/.hermes/hermes-agent/venv/bin/python"
APP="${DASHBOARD_DIR}/app.py"
PIDFILE="/tmp/forge-dashboard.pid"
LOGFILE="${DASHBOARD_DIR}/dashboard.log"
PORT=51764

start() {
    if [[ -f "${PIDFILE}" ]] && kill -0 "$(cat "${PIDFILE}")" 2>/dev/null; then
        echo "forge-dashboard already running (PID $(cat "${PIDFILE}"))"
        exit 0
    fi
    nohup "${VENV_PYTHON}" "${APP}" >> "${LOGFILE}" 2>&1 &
    echo $! > "${PIDFILE}"
    sleep 2
    if kill -0 "$(cat "${PIDFILE}")" 2>/dev/null; then
        echo "forge-dashboard started (PID $(cat "${PIDFILE}")) on 127.0.0.1:${PORT}"
    else
        echo "forge-dashboard failed to start — check ${LOGFILE}"
        rm -f "${PIDFILE}"
        exit 1
    fi
}

stop() {
    if [[ ! -f "${PIDFILE}" ]]; then
        echo "forge-dashboard not running (no PID file)"
        return 0
    fi
    PID="$(cat "${PIDFILE}")"
    kill "${PID}" 2>/dev/null || true
    # Wait up to 5s for graceful shutdown
    for i in $(seq 1 5); do
        if ! kill -0 "${PID}" 2>/dev/null; then
            break
        fi
        sleep 1
    done
    kill -9 "${PID}" 2>/dev/null || true
    rm -f "${PIDFILE}"
    echo "forge-dashboard stopped"
}

status() {
    if [[ -f "${PIDFILE}" ]] && kill -0 "$(cat "${PIDFILE}")" 2>/dev/null; then
        PID="$(cat "${PIDFILE}")"
        echo "forge-dashboard RUNNING (PID ${PID})"
        curl -sf http://127.0.0.1:${PORT}/api/health 2>/dev/null && echo "  health: OK" || echo "  health: UNREACHABLE"
    else
        echo "forge-dashboard STOPPED"
        return 1
    fi
}

restart() {
    stop
    sleep 1
    start
}

case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    status)  status ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac