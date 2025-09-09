const pool = require('./db');

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'registration_requests' 
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in order:');
    result.rows.forEach((r, i) => {
      console.log(`${i+1}. ${r.column_name}`);
    });
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkColumns();
