@echo off
REM ============================================
REM Script de inicio - Sistema Hospitalario
REM Windows
REM ============================================

echo.
echo ╔════════════════════════════════════════════╗
echo ║   Sistema de Gestión Hospitalaria        ║
echo ║   Script de Inicio Automático             ║
echo ╚════════════════════════════════════════════╝
echo.

REM Verificar si Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error: Node.js no está instalado
    echo.
    echo Por favor instala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js encontrado
node --version
echo.

REM Verificar si las dependencias del backend están instaladas
if not exist "backend\node_modules" (
    echo ⚙️  Instalando dependencias del backend...
    cd backend
    call npm install
    cd ..
    echo.
)

REM Verificar si existe .env
if not exist "backend\.env" (
    echo ⚠️  Advertencia: No se encontró archivo .env
    echo.
    echo Creando .env desde .env.example...
    copy backend\.env.example backend\.env >nul
    echo.
    echo ⚠️  IMPORTANTE: Edita backend\.env con tus credenciales de SQL Server
    echo    antes de continuar.
    echo.
    pause
)

echo.
echo ════════════════════════════════════════════
echo   Iniciando Servicios
echo ════════════════════════════════════════════
echo.

REM Iniciar backend en una nueva ventana
echo 🚀 Iniciando Backend API...
start "Hospital Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul

REM Iniciar frontend
echo 🌐 Iniciando Frontend...
echo.
echo Opciones de servidor frontend:
echo   1. Python (recomendado)
echo   2. Node.js (http-server)
echo   3. Solo abrir archivo HTML
echo.
choice /c 123 /n /m "Selecciona una opción: "

if errorlevel 3 goto opcion3
if errorlevel 2 goto opcion2
if errorlevel 1 goto opcion1

:opcion1
REM Verificar Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Iniciando con Python...
    cd frontend
    start "Hospital Frontend" cmd /k "python -m http.server 5500"
    cd ..
) else (
    echo ❌ Python no encontrado. Prueba otra opción.
    pause
    exit /b 1
)
goto final

:opcion2
REM Verificar http-server
where http-server >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Iniciando con http-server...
    cd frontend
    start "Hospital Frontend" cmd /k "http-server -p 5500"
    cd ..
) else (
    echo Instalando http-server...
    call npm install -g http-server
    cd frontend
    start "Hospital Frontend" cmd /k "http-server -p 5500"
    cd ..
)
goto final

:opcion3
echo Abriendo index.html en navegador...
cd frontend
start index.html
cd ..
goto final

:final
timeout /t 2 /nobreak >nul
echo.
echo ════════════════════════════════════════════
echo   ✅ Sistema Iniciado
echo ════════════════════════════════════════════
echo.
echo 🌐 Frontend: http://localhost:5500
echo 🔧 Backend:  http://localhost:3000
echo 💚 Health:   http://localhost:3000/health
echo.
echo Presiona Ctrl+C en cada ventana para detener los servicios
echo.
pause
