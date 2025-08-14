const { Pool } = require('pg');

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '[HIDDEN - FOUND]' : 'NOT FOUND');

const hasConnStr = !!process.env.DATABASE_URL;
const shouldUseSsl = (process.env.DB_SSL || 'false').toLowerCase() === 'true';

const pool = new Pool(
  hasConnStr
    ? { connectionString: process.env.DATABASE_URL,
        ssl: shouldUseSsl ? { rejectUnauthorized: false } : false }
    : { user: 'postgres', host: 'localhost', database: 'OCFA', password: '123456', port: 5433 }
);

pool.connect()
  .then(c => { console.log('✅ Database connection successful'); c.release(); })
  .catch(err => { console.error('❌ Database connection error details:', err); });

module.exports = pool;
