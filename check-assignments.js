#!/usr/bin/env node

const pool = require('./db');

async function checkAssignments() {
  try {
    console.log('🔍 Checking assignments table structure...');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assignments' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Assignments table columns:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if there are any assignments
    const assignments = await pool.query('SELECT COUNT(*) as count FROM assignments');
    console.log(`📊 Total assignments: ${assignments.rows[0].count}`);
    
    if (assignments.rows[0].count > 0) {
      const sample = await pool.query('SELECT * FROM assignments LIMIT 1');
      console.log('📝 Sample assignment:');
      console.log(JSON.stringify(sample.rows[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAssignments();
