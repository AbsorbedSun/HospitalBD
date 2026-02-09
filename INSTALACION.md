# 📦 Guía de Instalación Completa

Esta guía te llevará paso a paso para instalar y configurar todo el sistema.

---

## 📋 Requisitos del Sistema

### Software Necesario

| Software | Versión Mínima | Link de Descarga |
|----------|----------------|------------------|
| **Node.js** | 16.0+ | https://nodejs.org/ |
| **SQL Server** | 2019+ | https://www.microsoft.com/sql-server/sql-server-downloads |
| **SSMS o Azure Data Studio** | Última | https://docs.microsoft.com/sql/ssms/download-sql-server-management-studio-ssms |
| **Git** (opcional) | 2.0+ | https://git-scm.com/ |

### Hardware Recomendado

- **RAM**: 8 GB mínimo
- **Espacio en disco**: 2 GB libres
- **Procesador**: Dual-core o superior

---

## 🔧 Instalación Paso a Paso

### PASO 1: Instalar Prerequisitos (15-30 minutos)

#### 1.1 Instalar Node.js

```bash
# Windows / macOS / Linux
1. Descargar de: https://nodejs.org/
2. Ejecutar instalador
3. Verificar instalación:

node --version
# Debería mostrar: v16.x.x o superior

npm --version
# Debería mostrar: 8.x.x o superior
```

#### 1.2 Instalar SQL Server

**Opción A: SQL Server Express (Gratis, recomendado para desarrollo)**

```bash
# Windows
1. Descargar: https://www.microsoft.com/es-mx/sql-server/sql-server-downloads
2. Seleccionar "Express"
3. Seguir asistente de instalación
4. Configurar instancia como "SQLEXPRESS"
5. Habilitar SQL Server Authentication
6. Crear contraseña para usuario 'sa'

# Linux (Docker)
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=TuPassword123!" \
   -p 1433:1433 --name sqlserver \
   -d mcr.microsoft.com/mssql/server:2019-latest
```

#### 1.3 Instalar SQL Server Management Studio (SSMS)

```bash
# Windows
1. Descargar: https://aka.ms/ssmsfullsetup
2. Ejecutar instalador
3. Abrir SSMS
4. Conectar a: localhost\SQLEXPRESS (o localhost para Docker)
5. Autenticación SQL Server
6. Usuario: sa
7. Contraseña: (la que configuraste)

# Alternativa multiplataforma: Azure Data Studio
https://docs.microsoft.com/sql/azure-data-studio/download
```

---

### PASO 2: Descargar el Proyecto

#### Opción A: Desde ZIP
```bash
# 1. Extraer el archivo ZIP
# 2. Abrir terminal en la carpeta extraída
cd proyecto-hospital
```

#### Opción B: Desde Git (si está en repositorio)
```bash
git clone <url-del-repositorio>
cd proyecto-hospital
```

---

### PASO 3: Configurar Base de Datos (10 minutos)

#### 3.1 Abrir SSMS o Azure Data Studio

```sql
-- Conectar al servidor:
-- Servidor: localhost\SQLEXPRESS (o localhost si usas Docker)
-- Autenticación: SQL Server Authentication
-- Usuario: sa
-- Contraseña: tu_contraseña
```

#### 3.2 Ejecutar Scripts SQL en Orden

**IMPORTANTE: Ejecutar en este orden exacto**

```sql
-- Script 1: Crear base de datos y tablas
-- Abrir: backend/database/01_create_database.sql
-- Ejecutar: F5 o botón "Execute"
-- Verificar: Debe decir "Base de datos HospitalDB creada exitosamente"

-- Script 2: Crear triggers y procedimientos
-- Abrir: backend/database/02_triggers_procedures.sql
-- Ejecutar: F5
-- Verificar: Debe decir "Triggers y procedimientos almacenados creados"

-- Script 3: Insertar datos de prueba
-- Abrir: backend/database/03_test_data.sql
-- Ejecutar: F5
-- Verificar: Debe mostrar credenciales de prueba
```

#### 3.3 Verificar que todo se creó correctamente

```sql
-- En SSMS, expandir:
USE HospitalDB;

-- Verificar tablas (debe haber 18)
SELECT COUNT(*) FROM sys.tables;

-- Verificar datos de prueba
SELECT * FROM Usuario;
SELECT * FROM Especialidad;
SELECT * FROM Doctor;
```

---

### PASO 4: Configurar Backend (5 minutos)

#### 4.1 Instalar Dependencias

```bash
# Abrir terminal en la carpeta del proyecto
cd backend

# Instalar todas las dependencias
npm install

# Debería ver:
# ✓ Instalando express
# ✓ Instalando mssql
# ✓ Instalando jsonwebtoken
# etc...
```

#### 4.2 Configurar Variables de Entorno

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env

# Abrir .env con tu editor favorito
# Visual Studio Code:
code .env

# Notepad (Windows):
notepad .env
```

#### 4.3 Editar archivo .env

```env
# CONFIGURACIÓN DEL SERVIDOR
PORT=3000
NODE_ENV=development

# CONFIGURACIÓN DE SQL SERVER
DB_SERVER=localhost\SQLEXPRESS    # O solo "localhost" si usas Docker
DB_DATABASE=HospitalDB
DB_USER=sa
DB_PASSWORD=TuPasswordSegura123!  # ⚠️ CAMBIAR POR TU CONTRASEÑA REAL
DB_PORT=1433

# Configuración de encriptación
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true  # true para desarrollo local

# JWT SECRET
JWT_SECRET=mi_secreto_super_seguro_cambiar_en_produccion_123
JWT_EXPIRES_IN=24h

# CORS (Frontend URL)
FRONTEND_URL=http://localhost:5500
```

**⚠️ IMPORTANTE:**
- Cambiar `DB_PASSWORD` por tu contraseña real de SQL Server
- Si usas instancia por defecto (no Express), cambiar `DB_SERVER=localhost`
- Si cambias el puerto del frontend, actualizar `FRONTEND_URL`

#### 4.4 Probar Conexión a Base de Datos

```bash
# Iniciar el servidor en modo desarrollo
npm run dev

# Deberías ver algo como:
# ╔════════════════════════════════════════════╗
# ║   Sistema de Gestión Hospitalaria - API   ║
# ╚════════════════════════════════════════════╝
# 
# ✓ Conexión a SQL Server establecida
# 🚀 Servidor ejecutándose en http://localhost:3000
# 📊 Base de datos: HospitalDB
# 🌍 Entorno: development
```

#### 4.5 Verificar que la API funciona

```bash
# En otra terminal (o navegador):
curl http://localhost:3000/health

# Debería responder:
# {
#   "status": "OK",
#   "database": "Connected",
#   "timestamp": "2026-02-08T..."
# }
```

**Si hay error de conexión:**
```bash
# Error común: "Login failed for user 'sa'"
# Solución: Verificar contraseña en .env

# Error común: "Cannot connect to server"
# Solución: Verificar que SQL Server esté corriendo
```

---

### PASO 5: Configurar Frontend (3 minutos)

#### 5.1 Activar Integración con Backend

```bash
cd ../frontend

# Abrir login.html y register.html en tu editor
# Buscar esta línea en ambos archivos:
<script src="js/auth.js"></script>

# Cambiar por:
<script src="js/api.js"></script>
<script src="js/auth-integrated.js"></script>
```

**O usar el siguiente comando:**

```bash
# Windows PowerShell
(Get-Content login.html) -replace 'auth.js', 'api.js"></script>
<script src="js/auth-integrated.js' | Set-Content login.html

(Get-Content register.html) -replace 'auth.js', 'api.js"></script>
<script src="js/auth-integrated.js' | Set-Content register.html

# macOS / Linux
sed -i 's/auth.js/api.js"><\/script>\n<script src="js\/auth-integrated.js/g' login.html
sed -i 's/auth.js/api.js"><\/script>\n<script src="js\/auth-integrated.js/g' register.html
```

#### 5.2 Iniciar Servidor Frontend

**Opción A: Live Server (VS Code)**
```bash
# 1. Instalar extensión "Live Server" en VS Code
# 2. Clic derecho en index.html
# 3. Seleccionar "Open with Live Server"
# Automáticamente abrirá en http://localhost:5500
```

**Opción B: Python**
```bash
# Python 3.x
python -m http.server 5500

# Python 2.x
python -m SimpleHTTPServer 5500

# Abrir navegador en: http://localhost:5500
```

**Opción C: Node.js http-server**
```bash
# Instalar http-server globalmente (solo una vez)
npm install -g http-server

# Iniciar servidor
http-server -p 5500

# Abrir navegador en: http://localhost:5500
```

**Opción D: PHP**
```bash
php -S localhost:5500
```

---

### PASO 6: ¡Probar el Sistema! (5 minutos)

#### 6.1 Probar Login

```bash
# 1. Abrir navegador en: http://localhost:5500
# 2. Clic en "Iniciar Sesión"
# 3. Usar credenciales de prueba:

Email: paciente1@email.com
Password: hospital123
Tipo: Paciente

# 4. Debería redirigir al Dashboard de Paciente
```

#### 6.2 Probar Registro

```bash
# 1. En login.html, clic en "Registrarse"
# 2. Llenar formulario con datos de prueba
# 3. Aceptar términos y condiciones
# 4. Clic en "Crear Cuenta"
# 5. Debería crear cuenta y redirigir a dashboard
```

#### 6.3 Probar API Directamente

```bash
# Desde terminal:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paciente1@email.com",
    "password": "hospital123",
    "userType": "paciente"
  }'

# Debería devolver:
# {
#   "message": "Login exitoso",
#   "token": "eyJhbGc...",
#   "user": {...}
# }
```

---

## ✅ Verificación de Instalación

### Checklist Final

- [ ] ✅ Node.js instalado y funcionando
- [ ] ✅ SQL Server instalado y corriendo
- [ ] ✅ SSMS o Azure Data Studio instalado
- [ ] ✅ Scripts SQL ejecutados exitosamente
- [ ] ✅ Base de datos HospitalDB creada
- [ ] ✅ Datos de prueba insertados
- [ ] ✅ Backend: dependencias instaladas (`npm install`)
- [ ] ✅ Backend: archivo `.env` configurado
- [ ] ✅ Backend: servidor corriendo en puerto 3000
- [ ] ✅ Backend: health check responde OK
- [ ] ✅ Frontend: servidor corriendo en puerto 5500
- [ ] ✅ Frontend: archivos HTML actualizados
- [ ] ✅ Login funciona correctamente
- [ ] ✅ Registro funciona correctamente

---

## 🐛 Solución de Problemas Comunes

### Error: "Cannot find module 'express'"
```bash
# Solución: Instalar dependencias
cd backend
npm install
```

### Error: "Login failed for user 'sa'"
```bash
# Solución: Verificar contraseña en .env
# O habilitar SQL Server Authentication en SSMS
```

### Error: "Port 3000 is already in use"
```bash
# Solución: Cambiar puerto en backend/.env
PORT=3001

# O matar proceso en puerto 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Error: "CORS policy" en el navegador
```bash
# Solución: Verificar que FRONTEND_URL en backend/.env
# coincida con la URL del frontend
FRONTEND_URL=http://localhost:5500
```

### Error: "Cannot connect to SQL Server"
```bash
# 1. Verificar que SQL Server esté corriendo
# Windows: Servicios > SQL Server (SQLEXPRESS) > Iniciar

# 2. Verificar protocolo TCP/IP habilitado
# SQL Server Configuration Manager > SQL Server Network Configuration
# > Protocols for SQLEXPRESS > TCP/IP > Enabled: Yes

# 3. Reiniciar servicio SQL Server
```

### Error: "Token invalid" al navegar
```bash
# Solución: Hacer logout y volver a iniciar sesión
# Los tokens expiran en 24 horas
```

### Frontend no carga estilos
```bash
# Solución: Verificar que el servidor esté en la carpeta frontend/
# Y que los paths en HTML sean relativos

# Correcto: <link href="css/home.css">
# Incorrecto: <link href="/css/home.css">
```

---

## 🔄 Comandos Útiles

### Backend

```bash
# Iniciar en modo desarrollo (auto-reload)
npm run dev

# Iniciar en modo producción
npm start

# Ver logs en tiempo real
# (los logs se muestran en la terminal)

# Detener servidor
# Ctrl + C
```

### Frontend

```bash
# Iniciar con Live Server (VS Code)
# Automático con extensión

# Iniciar con Python
python -m http.server 5500

# Iniciar con Node
npx http-server -p 5500
```

### Base de Datos

```sql
-- Ver todas las tablas
USE HospitalDB;
SELECT * FROM sys.tables;

-- Ver datos de prueba
SELECT * FROM Usuario;
SELECT * FROM Cita;
SELECT * FROM Especialidad;

-- Limpiar datos de prueba
EXEC sp_MSforeachtable 'DELETE FROM ?';
-- Luego re-ejecutar 03_test_data.sql

-- Recrear base de datos completa
DROP DATABASE HospitalDB;
-- Luego ejecutar los 3 scripts en orden
```

---

## 📚 Próximos Pasos

Una vez instalado todo:

1. 📖 Leer `README.md` principal
2. 🧪 Probar todas las credenciales
3. 🔍 Explorar endpoints en `backend/README.md`
4. 🎨 Personalizar frontend según necesites
5. 📝 Revisar reglas de negocio en scripts SQL

---

## 🆘 Ayuda Adicional

- **Documentación Backend**: `backend/README.md`
- **Guía de Integración**: `backend/INTEGRACION_FRONTEND.md`
- **Inicio Rápido**: `INICIO_RAPIDO.md`
- **Resumen Ejecutivo**: `backend/RESUMEN_EJECUTIVO.md`

---

**¡Feliz desarrollo! 🚀**
