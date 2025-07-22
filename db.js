// Load environment variables from .env file
require('dotenv').config();

// Import pg module
const { Pool } = require('pg');

// Create a new PostgreSQL connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for connecting to Render PostgreSQL
  },
});

// Test connection on startup
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ PostgreSQL connection error:", err));

// Export the pool so you can use it elsewhere in your project
module.exports = pool;
