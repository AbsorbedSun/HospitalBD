# 🏥 MediConnect – Sistema de Gestión Hospitalaria

**IPN · ESCOM · Bases de Datos · Periodo 26-2 · Equipo 4 · Grupo 3CM3**

---

## Guía de inicio rápido

### Paso 1 – Base de datos

Abrir **SQL Server Management Studio (SSMS)** y ejecutar en orden:

```
backend/database/schema.sql   ← crea HospitalDB, tablas, catálogos
backend/database/seed.sql     ← inserta datos de prueba
```

### Paso 2 – Backend Flask

```bash
cd backend
pip install -r requirements.txt
cp .env       # ← editar: DB_SERVER, DB_PASSWORD
python app.py
```

El servidor queda en **http://127.0.0.1:5000**

Verificar que funciona abriendo en el navegador:

```
http://127.0.0.1:5000/api/health
```

Debe responder: `{"status": "ok", "base_datos": "conectada"}`

### Paso 3 – Frontend

```bash
cd frontend
python -m http.server 8080 --bind 127.0.0.1
```

Abrir: **http://127.0.0.1:8080/login.html**

> ⚠️ **IMPORTANTE**: Usar siempre `127.0.0.1` (no `localhost`) tanto para
> el frontend como para el backend, para evitar errores de CORS.

---

## Credenciales de prueba

| Rol           | Email                  | Contraseña   |
| ------------- | ---------------------- | ------------ |
| Recepcionista | recepcion@hospital.com | Hospital123! |
| Doctor        | dr.garcia@hospital.com | Hospital123! |
| Paciente      | paciente@test.com      | Hospital123! |

---

## Solución de problemas comunes

### "No se pudo conectar con el servidor"

- Verificar que `python app.py` esté corriendo
- Abrir `http://127.0.0.1:5000/api/health` en el navegador
- Revisar que `.env` tenga las credenciales correctas de SQL Server

### "Error de base de datos"

- Verificar que SQL Server esté corriendo
- Confirmar que se ejecutaron `schema.sql` y `seed.sql`
- Revisar `DB_SERVER`, `DB_USER`, `DB_PASSWORD` en `.env`

### El login no responde

- Asegurarse de abrir el frontend desde `http://127.0.0.1:8080` (no desde `file://`)
- El backend debe estar en `http://127.0.0.1:5000`
- Abrir la consola del navegador (F12 → Console) para ver el error exacto

### ODBC Driver no encontrado

```bash
# Windows: descargar de Microsoft
# https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server
```

---

## Tecnologías

| Capa          | Tecnología                        |
| ------------- | --------------------------------- |
| Frontend      | HTML5 · CSS3 · JavaScript vanilla |
| Backend       | Python 3 · Flask                  |
| Base de datos | Microsoft SQL Server 2019+        |
| Auth          | JWT (flask-jwt-extended)          |
| Cifrado       | bcrypt                            |

## Equipo

- García Ambrosio Aldo – 2025630171
- Hernández Rodríguez José Eduardo – 2025630494
- Hernández Zetina Jared – 2025630682
- Tinoco Celestino Sunduri Bilgai – 2023301870
