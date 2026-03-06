// shared database module for SQL Server connections and helpers

const sql = require('mssql');

// configuration used by all scripts; environment variables may override defaults
const config = {
  server: process.env.DB_SERVER || '172.16.200.45',
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER || 'realm',
      password: process.env.DB_PASSWORD || 'oohay@st!lisa'
    }
  },
  options: {
    database: process.env.DB_NAME || 'LeaveApp',
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    enableKeepAlive: true
  }
};

let pool = null;

async function initPool() {
  if (pool) return pool;
  pool = new sql.ConnectionPool(config);
  await pool.connect();
  console.log('Connected to SQL Server at', config.server, 'DB', config.options.database);
  return pool;
}

// helper to convert $1 style placeholders to @p0, @p1 etc for mssql
function translateParams(q) {
  return q.replace(/\$(\d+)/g, (_, n) => `@p${Number(n) - 1}`);
}

/**
 * Query helper compatible with Postgres-style usage.
 * @param {string} q - SQL text with $1, $2 placeholders
 * @param {Array<any>} params
 */
async function query(q, params = []) {
  const p = await initPool();
  const req = p.request();
  params.forEach((v, i) => req.input(`p${i}`, v));
  return req.query(translateParams(q));
}

module.exports = {
  sql,
  config,
  initPool,
  query
};
