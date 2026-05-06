@echo off
chcp 65001 >nul
title MediConnect

echo.
echo  ============================================
echo   MediConnect - Sistema de Gestion Hospitalaria
echo  ============================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado. Instala Python 3.10+ y agrega al PATH.
    pause & exit /b 1
)

if not exist "backend\.env" (
    echo [AVISO] No se encontro backend\.env
    echo         Copia backend\.env.example a backend\.env y edita tus credenciales.
    echo.
    pause & exit /b 1
)

REM -- Instalar dependencias solo si requirements.txt cambio --
REM    Si el archivo sentinel (.deps_ok) es mas nuevo que requirements.txt,
REM    las dependencias ya estan instaladas y se salta este paso.
if exist ".deps_ok" (
    for /f %%A in ('powershell -NoProfile -Command "(gi backend\requirements.txt).LastWriteTime -gt (gi .deps_ok).LastWriteTime"') do set CHANGED=%%A
) else (
    set CHANGED=True
)

if "%CHANGED%"=="True" (
    echo [1/2] Instalando dependencias ^(solo lo que falte^)...
    pip install -r backend\requirements.txt -q --disable-pip-version-check
    if %errorlevel% neq 0 (
        echo [ERROR] Fallo la instalacion de dependencias.
        pause & exit /b 1
    )
    echo. > .deps_ok
    echo     Dependencias listas.
) else (
    echo [1/2] Dependencias ya instaladas ^(requirements.txt sin cambios^).
)

echo [2/2] Arrancando servidor...
echo.
echo  Abre tu navegador en: http://127.0.0.1:5000
echo  Ctrl+C para detener.
echo.

python run.py
pause
