const sql = require("mssql");
require("dotenv").config();

const config = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "HospitalDB",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

const getConnection = async () => {
  try {
    if (pool) {
      return pool;
    }

    pool = await sql.connect(config);
    console.log("Conexión a SQL Server establecida");

    return pool;
  } catch (error) {
    console.error("Error al conectar a SQL Server:", error);
    throw error;
  }
};

const closeConnection = async () => {
  try {
    if (pool) {
      await pool.close();
      pool = null;
      console.log("Conexión a SQL Server cerrada");
    }
  } catch (error) {
    console.error("Error al cerrar conexión:", error);
  }
};

// Manejar cierre de aplicación
process.on("SIGINT", async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = {
  getConnection,
  closeConnection,
  sql,
};
