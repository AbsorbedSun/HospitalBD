import pyodbc
# Copia aquí EXACTAMENTE los valores que tienes en tu .env
server = '127.0.0.1,1433' 
database = 'HospitalDB'
username = 'sa'
password = 'absolt074' 

connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};Encrypt=no;TrustServerCertificate=yes;'

try:
    print("Intentando conectar...")
    conn = pyodbc.connect(connection_string, timeout=5)
    print("✅ ¡CONEXIÓN EXITOSA!")
    conn.close()
except Exception as e:
    print("❌ ERROR DE CONEXIÓN:")
    print(e)