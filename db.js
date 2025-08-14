const { Pool } = require('pg');

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "[HIDDEN - FOUND]" : "NOT FOUND");

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: 'postgres',
        host: 'localhost',
        database: 'OCFA',
        password: '123456',
        port: 5433
      }
);

pool.connect()
  .then(client => {
    console.log("✅ Database connection successful");
    client.release();
  })
  .catch(err => {
    console.error("❌ Database connection error details:", err); // log full error object
  });

module.exports = pool;
