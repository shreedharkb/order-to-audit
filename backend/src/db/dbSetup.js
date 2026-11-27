const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

/**
 * Initializes database schema and seeds benchmark data if needed.
 */
async function setupDatabase(customPool = null) {
  const db = customPool || pool;
  const results = { schema: false, seed: false, userCount: 0 };

  // 1. Run Schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error('schema.sql file not found at ' + schemaPath);
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await db.query(schemaSql);
  results.schema = true;

  // 2. Check if users exist
  const countRes = await db.query('SELECT COUNT(*) FROM users');
  const userCount = parseInt(countRes.rows[0].count, 10);
  results.userCount = userCount;

  // 3. Seed if no users exist
  if (userCount === 0) {
    const seedPath = path.join(__dirname, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      let seedSql = fs.readFileSync(seedPath, 'utf8');
      const salt = await bcrypt.genSalt(10);
      const realHash = await bcrypt.hash('password123', salt);
      seedSql = seedSql.replace(/\$2b\$10\$rICGcNMYbL2QLJhKMi3DLOm7VXZqxKhY9e8eT6kFJ6tA0\.uH9IXXS/g, realHash);
      await db.query(seedSql);
      results.seed = true;

      const newCountRes = await db.query('SELECT COUNT(*) FROM users');
      results.userCount = parseInt(newCountRes.rows[0].count, 10);
    }
  }

  return results;
}

module.exports = { setupDatabase };
