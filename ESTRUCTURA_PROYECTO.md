# 📁 Estructura del Proyecto Completo

```
proyecto-hospital/
│
├── 📂 backend/                              # BACKEND - API REST
│   │
│   ├── 📂 config/
│   │   └── database.js                      # Configuración SQL Server
│   │
│   ├── 📂 database/                         # SCRIPTS SQL
│   │   ├── 01_create_database.sql          # ⭐ Ejecutar primero
│   │   ├── 02_triggers_procedures.sql      # ⭐ Ejecutar segundo
│   │   └── 03_test_data.sql                # ⭐ Ejecutar tercero
│   │
│   ├── 📂 middleware/
│   │   └── auth.js                          # Autenticación JWT
│   │
│   ├── 📂 routes/                           # ENDPOINTS API
│   │   ├── auth.js                          # Login y registro
│   │   ├── cita.js                          # Gestión de citas
│   │   ├── doctor.js                        # Módulo doctor
│   │   ├── especialidad.js                  # Especialidades
│   │   ├── farmacia.js                      # Farmacia y ventas
│   │   ├── paciente.js                      # Módulo paciente
│   │   └── recepcionista.js                 # Módulo recepcionista
│   │
│   ├── .env.example                         # ⚙️ Variables de entorno (plantilla)
│   ├── .gitignore
│   ├── INTEGRACION_FRONTEND.md              # 📖 Guía de integración
│   ├── README.md                            # 📖 Documentación backend
│   ├── RESUMEN_EJECUTIVO.md                 # 📊 Resumen del proyecto
│   ├── package.json                         # Dependencias Node.js
│   └── server.js                            # ⚙️ Servidor principal
│
├── 📂 frontend/                             # FRONTEND - Interfaz Web
│   │
│   ├── 📂 css/
│   │   ├── auth.css                         # Estilos login/registro
│   │   ├── dashboard.css                    # Estilos dashboards
│   │   └── home.css                         # Estilos home
│   │
│   ├── 📂 js/
│   │   ├── api.js                           # 🆕 Cliente API completo
│   │   ├── auth.js                          # Auth original (offline)
│   │   ├── auth-integrated.js               # 🆕 Auth integrado con backend
│   │   ├── dashboard-doctor.js              # Lógica dashboard doctor
│   │   ├── dashboard-paciente.js            # Lógica dashboard paciente
│   │   ├── dashboard-recepcionista.js       # Lógica dashboard recepcionista
│   │   └── home.js                          # Lógica página principal
│   │
│   ├── dashboard-doctor.html                # 👨‍⚕️ Vista doctor
│   ├── dashboard-paciente.html              # 👤 Vista paciente
│   ├── dashboard-recepcionista.html         # 📋 Vista recepcionista
│   ├── index.html                           # 🏠 Página principal
│   ├── login.html                           # 🔐 Login
│   ├── register.html                        # ✍️ Registro
│   └── README.md                            # Documentación frontend
│
├── .gitignore                               # Archivos a ignorar en Git
├── INSTALACION.md                           # 📖 Guía completa de instalación
├── INICIO_RAPIDO.md                         # ⚡ Inicio rápido (5 min)
├── README.md                                # 📖 Documentación principal
├── start.bat                                # 🚀 Script inicio Windows
└── start.sh                                 # 🚀 Script inicio Linux/Mac

```

---

## 🎯 Archivos Clave por Función

### 📊 Para Entender el Proyecto
1. **README.md** (raíz) - Visión general completa
2. **backend/RESUMEN_EJECUTIVO.md** - Resumen ejecutivo
3. **ESTRUCTURA_PROYECTO.md** - Este archivo

### ⚙️ Para Instalar
1. **INSTALACION.md** - Guía paso a paso completa
2. **INICIO_RAPIDO.md** - Versión rápida (5-10 min)
3. **backend/.env.example** - Plantilla de configuración

### 🚀 Para Ejecutar
1. **start.bat** (Windows) - Inicia todo automáticamente
2. **start.sh** (Linux/Mac) - Inicia todo automáticamente
3. **backend/server.js** - Servidor backend
4. **frontend/index.html** - Página principal

### 💾 Para Base de Datos
1. **backend/database/01_create_database.sql** - Estructura
2. **backend/database/02_triggers_procedures.sql** - Lógica
3. **backend/database/03_test_data.sql** - Datos de prueba

### 🔗 Para Integrar Frontend con Backend
1. **backend/INTEGRACION_FRONTEND.md** - Guía completa
2. **frontend/js/api.js** - Cliente API
3. **frontend/js/auth-integrated.js** - Auth integrado

---

## 📊 Estadísticas del Proyecto

### Backend
- **Archivos**: 15 archivos principales
- **Líneas de código**: ~3,500
- **Endpoints**: 30+
- **Procedimientos SQL**: 5
- **Triggers SQL**: 4

### Frontend
- **Archivos HTML**: 6 páginas
- **Archivos CSS**: 3 hojas de estilo
- **Archivos JS**: 8 scripts
- **Líneas de código**: ~2,000

### Base de Datos
- **Tablas**: 18
- **Vistas**: 0
- **Procedimientos**: 5
- **Triggers**: 4
- **Índices**: 6

### Documentación
- **Archivos MD**: 8 documentos
- **Palabras totales**: ~15,000
- **Ejemplos de código**: 50+

---

## 🔍 Búsqueda Rápida

### ¿Necesitas...?

**Instalar el proyecto?**
→ `INSTALACION.md`

**Iniciarlo rápido?**
→ `INICIO_RAPIDO.md` o ejecuta `start.bat` / `start.sh`

**Documentación de la API?**
→ `backend/README.md`

**Crear la base de datos?**
→ `backend/database/01_create_database.sql`

**Conectar frontend con backend?**
→ `backend/INTEGRACION_FRONTEND.md`

**Entender el proyecto completo?**
→ `README.md` y `backend/RESUMEN_EJECUTIVO.md`

**Credenciales de prueba?**
→ `backend/database/03_test_data.sql` (al final)

**Configurar variables de entorno?**
→ `backend/.env.example`

**Modificar endpoints?**
→ `backend/routes/`

**Modificar interfaz?**
→ `frontend/`

---

## 🎨 Convenciones de Código

### Backend (JavaScript/Node.js)
- Nombres de variables: `camelCase`
- Nombres de archivos: `kebab-case.js`
- Nombres de rutas: `/api/nombre-recurso`
- Async/await para operaciones asíncronas

### Frontend (JavaScript)
- Nombres de variables: `camelCase`
- Nombres de funciones: `verbNoun()` - ej: `loadView()`
- IDs de elementos: `camelCase`
- Clases CSS: `kebab-case`

### SQL
- Nombres de tablas: `PascalCase`
- Nombres de columnas: `snake_case`
- Procedimientos: `sp_NombreDescriptivo`
- Triggers: `trg_NombreDescriptivo`

---

## 🔄 Flujo de Datos

```
Usuario (Navegador)
      ↓
Frontend (HTML/CSS/JS)
      ↓
API Client (api.js)
      ↓
Backend (Express)
      ↓
Middleware (auth.js)
      ↓
Routes (*.js)
      ↓
SQL Server (HospitalDB)
```

---

## 🏁 Orden de Ejecución Recomendado

### Primera Vez (Instalación)
1. Leer `INSTALACION.md`
2. Instalar prerequisitos (Node.js, SQL Server)
3. Ejecutar scripts SQL (en orden)
4. Configurar backend (.env)
5. Instalar dependencias (`npm install`)
6. Probar backend (`npm run dev`)
7. Configurar frontend (actualizar HTML)
8. Probar frontend (abrir en navegador)

### Desarrollo Diario
1. Ejecutar `start.bat` o `start.sh`
2. Esperar a que se inicien los servicios
3. Abrir navegador en `http://localhost:5500`
4. Desarrollar y probar
5. Ctrl+C para detener

---

**Última actualización**: 08/02/2026
**Versión del proyecto**: 1.0.0
