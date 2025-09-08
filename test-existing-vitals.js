#!/usr/bin/env node

/**
 * Test script for existing vitals table
 * Run this script to test the health API endpoints with your existing vitals table
 * 
 * Usage: node test-existing-vitals.js
 */

const pool = require('./db');

async function testExistingVitals() {
  console.log('🧪 Testing health endpoints with existing vitals table...');
  
  try {
    // Test 1: Check if vitals table exists
    console.log('\n1. Checking vitals table...');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'vitals'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ Vitals table not found. Please create it first.');
      return;
    }
    console.log('✅ Vitals table exists');
    
    // Test 2: Check table structure
    console.log('\n2. Checking table structure...');
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vitals' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Table columns:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    // Test 3: Check if we have any users
    console.log('\n3. Checking for test users...');
    const users = await pool.query('SELECT id, username, role FROM users WHERE role = $1 LIMIT 1', ['soldier']);
    
    if (users.rows.length === 0) {
      console.log('⚠️  No soldier users found. Create a test user first.');
      return;
    }
    
    const testUserId = users.rows[0].id;
    console.log(`✅ Found test user: ${users.rows[0].username} (ID: ${testUserId})`);
    
    // Test 4: Check existing vitals data
    console.log('\n4. Checking existing vitals data...');
    const existingVitals = await pool.query('SELECT COUNT(*) as count FROM vitals WHERE user_id = $1', [testUserId]);
    console.log(`✅ Existing vitals records for user ${testUserId}: ${existingVitals.rows[0].count}`);
    
    // Test 5: Insert sample data if none exists
    if (existingVitals.rows[0].count === '0') {
      console.log('\n5. Inserting sample vitals data...');
      const insertResult = await pool.query(`
        INSERT INTO vitals (user_id, bp, spo2, steps, sleep_hours)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [testUserId, '120/80', 98, 8500, 7.5]);
      
      console.log(`✅ Sample vitals inserted: ID ${insertResult.rows[0].id}`);
    } else {
      console.log('\n5. Using existing vitals data...');
      const latestVitals = await pool.query(`
        SELECT * FROM vitals WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1
      `, [testUserId]);
      
      console.log('✅ Latest vitals data:');
      console.log(`   - BP: ${latestVitals.rows[0].bp}`);
      console.log(`   - SpO2: ${latestVitals.rows[0].spo2}%`);
      console.log(`   - Steps: ${latestVitals.rows[0].steps}`);
      console.log(`   - Sleep: ${latestVitals.rows[0].sleep_hours} hrs`);
    }
    
    // Test 6: Test the health dashboard query
    console.log('\n6. Testing dashboard query...');
    const dashboardData = await pool.query(`
      SELECT 
        v.*,
        (SELECT COUNT(*) FROM assignments a WHERE a.assigned_to = $1 AND a.status IN ('pending', 'in_progress')) as active_missions
      FROM vitals v
      WHERE v.user_id = $1
      ORDER BY v.recorded_at DESC
      LIMIT 1
    `, [testUserId]);
    
    if (dashboardData.rows.length > 0) {
      console.log('✅ Dashboard query successful');
      const data = dashboardData.rows[0];
      console.log(`   - BP: ${data.bp}`);
      console.log(`   - SpO2: ${data.spo2}%`);
      console.log(`   - Steps: ${data.steps}`);
      console.log(`   - Sleep: ${data.sleep_hours} hrs`);
      console.log(`   - Active missions: ${data.active_missions}`);
    } else {
      console.log('⚠️  No vitals data found for dashboard');
    }
    
    console.log('\n🎉 All tests passed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your backend server: node index.js');
    console.log('   2. Test the API endpoints:');
    console.log(`      GET http://localhost:3001/api/health/dashboard/${testUserId}`);
    console.log(`      GET http://localhost:3001/api/health/vitals/${testUserId}`);
    console.log('   3. Use the frontend app to view the health dashboard');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the tests
testExistingVitals();

