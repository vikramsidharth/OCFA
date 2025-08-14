const { Pool } = require('pg');

// Database configuration for local testing
const pool = new Pool({
  user: 'postgres',           // e.g. 'postgres'
  host: 'localhost',
  database: 'OCFA',       // e.g. 'ocfa_db'
  password: '123456',   // e.g. 'yourpassword'
  port: 5433,                     // default PostgreSQL port
  ssl: false                      // since you're not using SSL
});

module.exports = pool;
