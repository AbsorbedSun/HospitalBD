#!/bin/bash
# ============================================
# Script de inicio - Sistema Hospitalario
# Linux / macOS
# ============================================

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   Sistema de Gestión Hospitalaria        ║"
echo "║   Script de Inicio Automático             ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado"
    echo ""
    echo "Por favor instala Node.js desde: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js encontrado: $(node --version)"
echo ""

# Verificar dependencias del backend
if [ ! -d "backend/node_modules" ]; then
    echo "⚙️  Instalando dependencias del backend..."
    cd backend
    npm install
    cd ..
    echo ""
fi

# Verificar .env
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Advertencia: No se encontró archivo .env"
    echo ""
    echo "Creando .env desde .env.example..."
    cp backend/.env.example backend/.env
    echo ""
    echo "⚠️  IMPORTANTE: Edita backend/.env con tus credenciales de SQL Server"
    echo "    antes de continuar."
    echo ""
    read -p "Presiona Enter para continuar..."
fi

echo ""
echo "════════════════════════════════════════════"
echo "  Iniciando Servicios"
echo "════════════════════════════════════════════"
echo ""

# Función para limpiar procesos al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Iniciar backend
echo "🚀 Iniciando Backend API..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..
sleep 3

# Iniciar frontend
echo "🌐 Iniciando Frontend..."
echo ""

# Detectar servidor disponible
if command -v python3 &> /dev/null; then
    echo "Usando Python3..."
    cd frontend
    python3 -m http.server 5500 &
    FRONTEND_PID=$!
    cd ..
elif command -v python &> /dev/null; then
    echo "Usando Python..."
    cd frontend
    python -m http.server 5500 &
    FRONTEND_PID=$!
    cd ..
elif command -v http-server &> /dev/null; then
    echo "Usando http-server..."
    cd frontend
    http-server -p 5500 &
    FRONTEND_PID=$!
    cd ..
else
    echo "⚠️  No se encontró servidor HTTP"
    echo "Instalando http-server..."
    npm install -g http-server
    cd frontend
    http-server -p 5500 &
    FRONTEND_PID=$!
    cd ..
fi

sleep 2

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Sistema Iniciado"
echo "════════════════════════════════════════════"
echo ""
echo "🌐 Frontend: http://localhost:5500"
echo "🔧 Backend:  http://localhost:3000"
echo "💚 Health:   http://localhost:3000/health"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios"
echo ""

# Mantener el script corriendo
wait
