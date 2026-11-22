const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

async function runSeed() {
  console.log('Generating seed data with bcrypt hashed passwords...');
  try {
    const seedPath = path.join(__dirname, 'seed.sql');
    let sql = fs.readFileSync(seedPath, 'utf8');

    // Generate real bcrypt hash for 'password123'
    const salt = await bcrypt.genSalt(10);
    const realHash = await bcrypt.hash('password123', salt);

    // Replace the placeholder hash with the newly generated hash
    sql = sql.replace(/\$2b\$10\$rICGcNMYbL2QLJhKMi3DLOm7VXZqxKhY9e8eT6kFJ6tA0\.uH9IXXS/g, realHash);

    await pool.query(sql);
    console.log('✅ Benchmark seed data loaded successfully!');
    console.log('Default credentials for all seeded users: password123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

runSeed();
