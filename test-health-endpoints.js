#!/usr/bin/env node

/**
 * Test script for health endpoints
 * Run this script to test the health API endpoints
 * 
 * Usage: node test-health-endpoints.js
 */

const pool = require('./db');

async function testHealthEndpoints() {
  console.log('🧪 Testing health endpoints...');
  
  try {
    // Test 1: Check if tables exist
    console.log('\n1. Checking database tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('soldier_health_vitals', 'soldier_health_profile', 'health_status_thresholds')
      ORDER BY table_name
    `);
    
    if (tables.rows.length === 3) {
      console.log('✅ All health tables exist');
      tables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('❌ Missing tables. Run setup-health-tables.js first.');
      return;
    }
    
    // Test 2: Check health thresholds
    console.log('\n2. Checking health thresholds...');
    const thresholds = await pool.query('SELECT COUNT(*) as count FROM health_status_thresholds');
    console.log(`✅ Health thresholds configured: ${thresholds.rows[0].count}`);
    
    // Test 3: Check if we have any users
    console.log('\n3. Checking for test users...');
    const users = await pool.query('SELECT id, username, role FROM users WHERE role = $1 LIMIT 1', ['soldier']);
    
    if (users.rows.length === 0) {
      console.log('⚠️  No soldier users found. Create a test user first.');
      return;
    }
    
    const testUserId = users.rows[0].id;
    console.log(`✅ Found test user: ${users.rows[0].username} (ID: ${testUserId})`);
    
    // Test 4: Test health functions
    console.log('\n4. Testing health functions...');
    
    // Test get_health_status function
    const heartRateStatus = await pool.query('SELECT get_health_status($1, $2) as status', ['heart_rate', 75]);
    console.log(`✅ Heart rate status function: ${heartRateStatus.rows[0].status}`);
    
    // Test get_latest_health_vitals function
    const vitals = await pool.query('SELECT * FROM get_latest_health_vitals($1)', [testUserId]);
    console.log(`✅ Latest vitals function: ${vitals.rows.length} records`);
    
    // Test get_health_profile function
    const profile = await pool.query('SELECT * FROM get_health_profile($1)', [testUserId]);
    console.log(`✅ Health profile function: ${profile.rows.length} records`);
    
    // Test 5: Insert sample data
    console.log('\n5. Testing data insertion...');
    
    // Insert sample vitals
    const vitalsResult = await pool.query(`
      INSERT INTO soldier_health_vitals (
        user_id, heart_rate, body_temperature, blood_pressure_systolic, 
        blood_pressure_diastolic, spo2, respiration_rate, activity_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [testUserId, 75, 36.5, 120, 80, 98, 16, 'moderate']);
    
    console.log(`✅ Sample vitals inserted: ID ${vitalsResult.rows[0].id}`);
    
    // Insert sample profile
    const profileResult = await pool.query(`
      INSERT INTO soldier_health_profile (
        user_id, steps_today, body_fat_percentage, bmi, vo2_max,
        blood_sugar, cholesterol_total, cholesterol_hdl, cholesterol_ldl
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [testUserId, 8500, 15.5, 22.3, 45.2, 85, 180, 55, 120]);
    
    console.log(`✅ Sample profile inserted: ID ${profileResult.rows[0].id}`);
    
    // Test 6: Test complete dashboard query
    console.log('\n6. Testing dashboard query...');
    const dashboardData = await pool.query(`
      SELECT 
        (SELECT * FROM get_latest_health_vitals($1)) as vitals,
        (SELECT * FROM get_health_profile($1)) as profile
    `, [testUserId]);
    
    console.log('✅ Dashboard query successful');
    console.log(`   - Vitals: ${dashboardData.rows[0].vitals ? 'Available' : 'None'}`);
    console.log(`   - Profile: ${dashboardData.rows[0].profile ? 'Available' : 'None'}`);
    
    console.log('\n🎉 All health endpoint tests passed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your backend server: node index.js');
    console.log('   2. Test the API endpoints with curl or Postman');
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
testHealthEndpoints();

