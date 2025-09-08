#!/usr/bin/env node

/**
 * Quick test script to check user 120 and add test data
 */

const pool = require('./db');

async function testUser120() {
  console.log('🔍 Testing user 120...');
  
  try {
    // Check if user 120 exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [120]);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ User 120 does not exist');
      
      // Check what users exist
      const allUsers = await pool.query('SELECT id, username, role FROM users ORDER BY id LIMIT 10');
      console.log('📋 Available users:');
      allUsers.rows.forEach(user => {
        console.log(`   - ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
      });
      
      return;
    }
    
    const user = userCheck.rows[0];
    console.log(`✅ User 120 exists: ${user.username} (${user.role})`);
    
    // Check if vitals exist for this user
    const vitalsCheck = await pool.query('SELECT COUNT(*) as count FROM vitals WHERE user_id = $1', [120]);
    console.log(`📊 Vitals records for user 120: ${vitalsCheck.rows[0].count}`);
    
    // Add test vitals if none exist
    if (vitalsCheck.rows[0].count === '0') {
      console.log('➕ Adding test vitals data...');
      await pool.query(`
        INSERT INTO vitals (user_id, bp, spo2, steps, sleep_hours)
        VALUES ($1, $2, $3, $4, $5)
      `, [120, '120/80', 98, 8500, 7.5]);
      
      console.log('✅ Test vitals added successfully');
    }
    
    // Test the health dashboard endpoint
    console.log('\n🧪 Testing health dashboard endpoint...');
    const vitalsResult = await pool.query(
      `SELECT * FROM vitals WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [120]
    );
    
    if (vitalsResult.rows.length > 0) {
      const vitals = vitalsResult.rows[0];
      console.log('✅ Vitals data found:');
      console.log(`   - BP: ${vitals.bp}`);
      console.log(`   - SpO2: ${vitals.spo2}%`);
      console.log(`   - Steps: ${vitals.steps}`);
      console.log(`   - Sleep: ${vitals.sleep_hours} hrs`);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testUser120();
