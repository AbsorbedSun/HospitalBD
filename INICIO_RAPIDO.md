# ⚡ INICIO RÁPIDO - 5 Minutos para Ejecutar

## 🎯 Lo que tienes

- ✅ **Frontend**: Tu diseño actual (carpeta `frontend/`)
- ✅ **Backend**: API completa (carpeta `hospital-backend/`)
- ✅ **Base de Datos**: Scripts SQL listos

## 🚀 Pasos para Ejecutar (Primera vez)

### 1️⃣ Configurar SQL Server (5 min)

```bash
# Opción A: Si tienes SQL Server instalado localmente
# Abrir SQL Server Management Studio (SSMS) o Azure Data Studio

# Opción B: Si no tienes SQL Server
# Descargar SQL Server Express (gratis): 
# https://www.microsoft.com/es-mx/sql-server/sql-server-downloads

# Crear la base de datos ejecutando en orden:
# 1. hospital-backend/database/01_create_database.sql
# 2. hospital-backend/database/02_triggers_procedures.sql  
# 3. hospital-backend/database/03_test_data.sql
```

### 2️⃣ Configurar Backend (2 min)

```bash
# Entrar a la carpeta del backend
cd hospital-backend

# Instalar dependencias
npm install

# Crear archivo .env (copiar de .env.example)
cp .env.example .env

# Editar .env con tus credenciales de SQL Server
# Cambiar:
# - DB_PASSWORD=TuPasswordSegura123!
# - DB_SERVER=localhost (o tu servidor)
```

### 3️⃣ Iniciar Backend (1 min)

```bash
# En la carpeta hospital-backend/
npm run dev

# Deberías ver:
# 🚀 Servidor ejecutándose en http://localhost:3000
# ✓ Conexión a SQL Server establecida
```

### 4️⃣ Probar Backend (1 min)

```bash
# Abrir navegador en: http://localhost:3000
# Deberías ver la página de bienvenida de la API

# O probar con curl:
curl http://localhost:3000/health
```

### 5️⃣ Abrir Frontend (1 min)

```bash
# Opción A: Con Live Server (VSCode)
# Clic derecho en index.html > "Open with Live Server"

# Opción B: Con servidor HTTP simple
cd frontend
python -m http.server 5500
# O si tienes Node:
npx http-server -p 5500
```

## 🧪 Probar el Sistema

### Test 1: Login (Sin integración todavía)

1. Abrir `http://localhost:5500/login.html`
2. Usar credenciales de prueba:
   - Email: `paciente1@email.com`
   - Password: `hospital123`
   - Tipo: Paciente
3. Por ahora funcionará con localStorage (simulado)

### Test 2: API Directa

```bash
# Login via API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paciente1@email.com",
    "password": "hospital123",
    "userType": "paciente"
  }'

# Deberías recibir un token JWT
```

### Test 3: Obtener Especialidades

```bash
# Sin autenticación (público)
curl http://localhost:3000/api/especialidades

# Deberías ver 10 especialidades
```

## ⚠️ Problemas Comunes

### Backend no inicia

```bash
# Error: Cannot connect to SQL Server
# Solución: Verificar que SQL Server esté corriendo
# Windows: Buscar "SQL Server Configuration Manager"
# Verificar servicio "SQL Server (SQLEXPRESS)" activo
```

### Puerto 3000 en uso

```bash
# Error: Port 3000 already in use
# Solución: Cambiar puerto en .env
PORT=3001
```

### Frontend no carga

```bash
# Error: CORS
# Solución: Verificar que FRONTEND_URL en .env sea correcto
FRONTEND_URL=http://localhost:5500
```

## 🔗 Siguiente Paso: Integración

Una vez que backend y frontend funcionan por separado:

1. Leer: `hospital-backend/INTEGRACION_FRONTEND.md`
2. Crear archivo: `frontend/js/api.js`
3. Modificar: `frontend/js/auth.js`
4. Probar login real con backend

## 📋 Checklist Rápido

- [ ] SQL Server instalado y corriendo
- [ ] Base de datos creada (scripts ejecutados)
- [ ] Backend: `npm install` completado
- [ ] Backend: archivo `.env` configurado
- [ ] Backend: servidor corriendo en puerto 3000
- [ ] Frontend: servidor corriendo en puerto 5500
- [ ] Test API: `curl http://localhost:3000/health` ✓
- [ ] Test Frontend: Login funciona (simulado)
- [ ] Listo para integración

## 🎓 Para la Entrega

Tu proyecto YA está completo con:
- ✅ Base de datos completa
- ✅ Backend funcional
- ✅ Frontend diseñado
- ✅ Todas las reglas de negocio
- ✅ Datos de prueba

Solo necesitas integrar frontend con backend siguiendo `INTEGRACION_FRONTEND.md`.

## 🆘 Si tienes problemas

1. Revisar: `hospital-backend/README.md` (documentación completa)
2. Revisar: `hospital-backend/RESUMEN_EJECUTIVO.md` (visión general)
3. Verificar logs del servidor en la consola
4. Verificar que todos los scripts SQL se ejecutaron correctamente

## 🎉 ¡Todo listo!

Backend funcionando = ✅
Frontend diseñado = ✅
Siguiente paso = Integración (guía incluida)

**Tiempo total de setup: ~10 minutos** ⚡
