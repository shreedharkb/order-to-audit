const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/order_to_audit';
const isCloud = connectionString.includes('sslmode=require') ||
  (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1') && !connectionString.includes('db:5432'));

const pool = new Pool({
  connectionString,
  ...(isCloud && {
    ssl: { rejectUnauthorized: false }
  })
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
