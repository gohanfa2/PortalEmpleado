require('dotenv').config();
const sql = require('mssql');

const dbConfig = {
  user: process.env.SQL_USER || 'sa',
  password: process.env.SQL_PASSWORD || 'Colsin123',
  server: process.env.SQL_SERVER || 'localhost',
  database: process.env.SQL_DATABASE || 'NOM_ALPLA',
  port: parseInt(process.env.SQL_PORT, 10) || 1433,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate:
      process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('SQL Server conectado correctamente');
    return pool;
  })
  .catch(err => {
    console.error('Error al conectar con SQL Server:', err);
    throw err;
  });

async function executeQuery(query, params = []) {
  const pool = await poolPromise;
  const request = pool.request();

  params.forEach(({ name, type, value }) => {
    request.input(name, type, value);
  });

  return request.query(query);
}

module.exports = {
  sql,
  poolPromise,
  executeQuery,
  dbConfig
};
