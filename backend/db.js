//db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  user: process.env.DB_USER || process.env.PGUSER || 'escape_user',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'escape_pass',
  database: process.env.DB_NAME || process.env.PGDATABASE || 'escape_game2',
});

module.exports = pool;
