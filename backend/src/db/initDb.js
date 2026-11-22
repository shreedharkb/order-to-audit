const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function initDb() {
  console.log('Connecting to database and running schema.sql...');
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(sql);
    console.log('✅ Database schema initialized successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);
  }
}

initDb();
