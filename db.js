const { Pool } = require('pg');
require('dotenv').config();


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  family: 4, // 👈 يجبر IPv4 فقط
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Connected to Supabase PostgreSQL');
    release();
  }
});

module.exports = pool;
// welcome@778welcome@
// https://wqfwcxmrvzlfbccjpepq.supabase.co