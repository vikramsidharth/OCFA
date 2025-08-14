const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  isProduction
    ? {
        user: 'ocfa_rdea_user',
        host: 'dpg-d23inammcj7s739egja0-a.oregon-postgres.render.com',
        database: 'ocfa_rdea',
        password: 'bo9wsbOddjXXjIeOOhWLYLxLGG2U8DLn',
        port: 5432,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: 'postgres',          // local user
        host: 'localhost',         // local host
        database: 'OCFA',          // local DB name
        password: '123456',        // local password
        port: 5433,                 // local port
        ssl: false
      }
);

module.exports = pool;
