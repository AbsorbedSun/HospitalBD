# ⚠️ IMPORTANTE - LÉEME PRIMERO

## 🎯 Archivos que DEBES Modificar Antes de Usar

### 1. Backend - Variables de Entorno
**Archivo**: `backend/.env`

```bash
# ESTE ARCHIVO NO EXISTE TODAVÍA
# Debes crearlo copiando .env.example

# Windows
cd backend
copy .env.example .env

# Linux/Mac
cd backend
cp .env.example .env
```

**Luego editar y cambiar:**
```env
DB_PASSWORD=TuPasswordSegura123!  # ⚠️ CAMBIAR por tu password real de SQL Server
DB_SERVER=localhost\SQLEXPRESS    # ⚠️ Cambiar si usas otra instancia
```

### 2. Frontend - Integración con Backend
**Archivos**: `frontend/login.html` y `frontend/register.html`

**Buscar esta línea:**
```html
<script src="js/auth.js"></script>
```

**Cambiar por:**
```html
<script src="js/api.js"></script>
<script src="js/auth-integrated.js"></script>
```

**O simplemente usar el modo API:**
- Abrir `frontend/js/auth-integrated.js`
- Verificar que `USE_API = true` (línea 8)

---

## 🔴 ORDEN CORRECTO de Ejecución

### ❌ INCORRECTO (No hacer)
```bash
# Esto NO funcionará:
1. Abrir frontend directamente
2. Iniciar backend
3. Ejecutar scripts SQL
```

### ✅ CORRECTO (Seguir este orden)
```bash
1. Ejecutar scripts SQL (crear base de datos)
2. Configurar backend (.env)
3. Iniciar backend (npm run dev)
4. Iniciar frontend (servidor HTTP)
5. Probar en navegador
```

---

## 🔑 Credenciales de Prueba

**IMPORTANTE**: Estas credenciales YA ESTÁN en la base de datos después de ejecutar `03_test_data.sql`

| Usuario | Email | Password | Tipo |
|---------|-------|----------|------|
| Paciente 1 | paciente1@email.com | hospital123 | paciente |
| Paciente 2 | paciente2@email.com | hospital123 | paciente |
| Paciente 3 | paciente3@email.com | hospital123 | paciente |
| Dr. García | dr.garcia@hospital.com | hospital123 | doctor |
| Dra. Martínez | dr.martinez@hospital.com | hospital123 | doctor |
| Dr. López | dr.lopez@hospital.com | hospital123 | doctor |
| Dra. Rodríguez | dr.rodriguez@hospital.com | hospital123 | doctor |
| Recepcionista 1 | recep.gonzalez@hospital.com | hospital123 | recepcionista |
| Recepcionista 2 | recep.hernandez@hospital.com | hospital123 | recepcionista |

**Nota**: Todas las contraseñas están hasheadas en la BD con bcrypt.

---

## 🚫 Errores Comunes y Soluciones

### Error 1: "Cannot connect to database"
**Causa**: SQL Server no está corriendo o credenciales incorrectas
**Solución**: 
- Verificar que SQL Server esté iniciado
- Revisar password en `backend/.env`
- Verificar nombre de instancia (SQLEXPRESS)

### Error 2: "Port 3000 already in use"
**Causa**: Otro proceso usando el puerto
**Solución**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <número> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Error 3: "Module not found: express"
**Causa**: No se instalaron las dependencias
**Solución**:
```bash
cd backend
npm install
```

### Error 4: "CORS policy error"
**Causa**: Frontend y backend en diferentes puertos
**Solución**: 
- Verificar `FRONTEND_URL=http://localhost:5500` en backend/.env
- Debe coincidir con URL real del frontend

### Error 5: "Invalid token" al navegar
**Causa**: Token expiró (24 horas) o hay inconsistencia
**Solución**: 
- Hacer logout
- Limpiar localStorage
- Volver a hacer login

---

## 📝 Checklist Pre-Entrega

Antes de entregar el proyecto, verificar:

- [ ] ✅ Base de datos creada y con datos
- [ ] ✅ Backend inicia sin errores
- [ ] ✅ Frontend conecta con backend
- [ ] ✅ Login funciona con credenciales de prueba
- [ ] ✅ Se pueden agendar citas
- [ ] ✅ Se pueden cancelar citas
- [ ] ✅ Doctores ven sus pacientes
- [ ] ✅ Recepcionistas ven dashboard
- [ ] ✅ Documentación incluida
- [ ] ✅ Scripts SQL incluidos
- [ ] ✅ README claro y completo

---

## 🎓 Para la Demo

### Preparación
1. Tener SQL Server corriendo
2. Tener backend corriendo (`npm run dev`)
3. Tener frontend abierto en navegador
4. Tener las credenciales a mano

### Flujo Sugerido
1. **Login como Paciente**
   - Mostrar dashboard
   - Agendar una cita
   - Mostrar comprobante
   - Cancelar cita

2. **Login como Doctor**
   - Mostrar citas del día
   - Ver lista de pacientes
   - Ver historial médico
   - Crear receta

3. **Login como Recepcionista**
   - Mostrar dashboard con estadísticas
   - Ver bitácoras
   - Realizar venta en farmacia

4. **Mostrar Base de Datos**
   - Abrir SSMS
   - Mostrar tablas
   - Ejecutar un SELECT
   - Mostrar un procedimiento almacenado

---

## 🔐 Seguridad

### ⚠️ NO SUBIR A PRODUCCIÓN SIN:
- [ ] Cambiar `JWT_SECRET` a valor aleatorio seguro
- [ ] Cambiar todas las contraseñas de prueba
- [ ] Habilitar HTTPS
- [ ] Configurar CORS correctamente
- [ ] Agregar rate limiting
- [ ] Validar todas las entradas
- [ ] Usar variables de entorno seguras
- [ ] Configurar firewall de BD
- [ ] Implementar logs de auditoría
- [ ] Hacer backups regulares

---

## 📊 Estructura de Carpetas del ZIP

```
proyecto-hospital.zip/
├── backend/          ← API completa
├── frontend/         ← Interfaz web
├── *.md              ← Documentación
├── start.bat         ← Script Windows
└── start.sh          ← Script Linux/Mac
```

**Tamaño aproximado**: 2-5 MB (sin node_modules)

---

## 🔄 Si Algo Sale Mal

### Resetear Todo

```bash
# 1. Borrar base de datos
DROP DATABASE HospitalDB;

# 2. Ejecutar scripts de nuevo
01_create_database.sql
02_triggers_procedures.sql
03_test_data.sql

# 3. Reiniciar backend
cd backend
npm install
npm run dev

# 4. Limpiar localStorage del navegador
# F12 > Application > Local Storage > Clear
```

---

## 📞 Ayuda

Si necesitas ayuda:
1. Leer `INSTALACION.md` completo
2. Revisar sección de troubleshooting
3. Verificar logs del backend
4. Verificar consola del navegador (F12)
5. Revisar `backend/README.md`

---

## 💡 Tips Finales

1. **Siempre ejecutar scripts SQL en orden**
2. **Configurar .env ANTES de iniciar backend**
3. **Usar las credenciales de prueba incluidas**
4. **Mantener backend corriendo mientras usas el frontend**
5. **Usar modo desarrollo de Node (`npm run dev`) para ver errores**
6. **Abrir consola del navegador (F12) para ver errores de frontend**
7. **Leer los mensajes de error, suelen ser muy claros**

---

## 🎉 ¡Todo Listo!

El proyecto está **100% funcional** y listo para usar.

Solo necesitas:
1. Seguir `INSTALACION.md` o `INICIO_RAPIDO.md`
2. Configurar las credenciales de SQL Server
3. Ejecutar y disfrutar

**¡Buena suerte con tu proyecto! 🚀**

---

**Nota**: Este archivo contiene información crítica. Por favor léelo completo antes de empezar.
