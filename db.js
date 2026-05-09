// db.js
const { Pool } = require('pg');

// Database connection setup
const pool = new Pool({
  user: 'new_user',        // 👈 New user
  host: 'localhost',
  database: 'cards_db',    // 👈 New database
  password: '123456',      // 👈 Password
  port: 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Successfully connected to the database');
    release();
  }
});

module.exports = pool;