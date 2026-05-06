#!/usr/bin/env bash
# ============================================
#  MediConnect – Script de arranque (macOS / Linux)
#  Uso: ./run.sh
# ============================================
set -e
cd "$(dirname "$0")"

echo ""
echo " ============================================"
echo "  MediConnect - Sistema de Gestion Hospitalaria"
echo " ============================================"
echo ""

# -- Verificar Python --
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 no encontrado. Instala Python 3.10+."
    exit 1
fi

# -- Verificar .env --
if [ ! -f "backend/.env" ]; then
    echo "[AVISO] No se encontro backend/.env"
    echo "        Copia backend/.env.example a backend/.env y edita tus credenciales."
    exit 1
fi

# -- Instalar dependencias solo si requirements.txt cambio --
# .deps_ok actua como sentinel: si es mas nuevo que requirements.txt
# las dependencias ya estan instaladas y se salta pip install.
if [ ! -f ".deps_ok" ] || [ "backend/requirements.txt" -nt ".deps_ok" ]; then
    echo "[1/2] Instalando dependencias (solo lo que falte)..."
    pip3 install -r backend/requirements.txt -q --disable-pip-version-check
    touch .deps_ok
    echo "      Dependencias listas."
else
    echo "[1/2] Dependencias ya instaladas (requirements.txt sin cambios)."
fi

echo "[2/2] Arrancando servidor..."
echo ""
echo " Abre tu navegador en: http://127.0.0.1:5000"
echo " Ctrl+C para detener."
echo ""

python3 run.py
