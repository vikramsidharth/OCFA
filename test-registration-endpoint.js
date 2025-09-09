#!/usr/bin/env node

/**
 * Test script to verify the registration-requests endpoint and table
 * Run this script to test if the registration-requests table exists and the endpoint works
 * 
 * Usage: node test-registration-endpoint.js
 */

const pool = require('./db');

async function testRegistrationEndpoint() {
  console.log('🧪 Testing registration-requests endpoint and table...');
  
  try {
    // Test 1: Check if registration_requests table exists
    console.log('\n1. Checking registration_requests table...');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'registration_requests'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ registration_requests table not found!');
      console.log('Please run the registration-requests-schema.sql file to create the table.');
      return;
    }
    console.log('✅ registration_requests table exists');
    
    // Test 2: Check table structure
    console.log('\n2. Checking table structure...');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'registration_requests' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Table columns:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Test 3: Check if we can insert a test record
    console.log('\n3. Testing insert into registration_requests...');
    const testData = {
      username: 'test_user_' + Date.now(),
      password: '$2b$10$test.hash.for.testing',
      name: 'Test User',
      role: 'soldier',
      email: 'test@example.com',
      category: 'Test Category',
      age: 25,
      gender: 'Male',
      height: '170cm',
      weight: '70kg',
      bp: '120/80',
      id_no: 'TEST' + Date.now(),
      blood_group: 'O+',
      unit_name: 'Test Unit',
      phone_no: '1234567890'
    };
    
    const insertResult = await pool.query(`
      INSERT INTO registration_requests (
        username, password, name, role, email, category, age, gender, height, weight, bp, id_no, blood_group, unit_name, phone_no, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending'
      ) RETURNING id, username, name, role, email, status, created_at
    `, [
      testData.username,
      testData.password,
      testData.name,
      testData.role,
      testData.email,
      testData.category,
      testData.age,
      testData.gender,
      testData.height,
      testData.weight,
      testData.bp,
      testData.id_no,
      testData.blood_group,
      testData.unit_name,
      testData.phone_no
    ]);
    
    console.log('✅ Successfully inserted test record:');
    console.log('   ID:', insertResult.rows[0].id);
    console.log('   Username:', insertResult.rows[0].username);
    console.log('   Status:', insertResult.rows[0].status);
    console.log('   Created:', insertResult.rows[0].created_at);
    
    // Test 4: Check if we can query the record
    console.log('\n4. Testing query from registration_requests...');
    const queryResult = await pool.query(
      'SELECT * FROM registration_requests WHERE id = $1',
      [insertResult.rows[0].id]
    );
    
    if (queryResult.rows.length > 0) {
      console.log('✅ Successfully queried test record');
      console.log('   Found record with username:', queryResult.rows[0].username);
    } else {
      console.log('❌ Failed to query test record');
    }
    
    // Test 5: Clean up test record
    console.log('\n5. Cleaning up test record...');
    await pool.query('DELETE FROM registration_requests WHERE id = $1', [insertResult.rows[0].id]);
    console.log('✅ Test record cleaned up');
    
    console.log('\n🎉 All tests passed! The registration_requests table is working correctly.');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error('Stack trace:', err.stack);
    
    if (err.code) {
      console.error('Database error code:', err.code);
    }
    if (err.detail) {
      console.error('Database error detail:', err.detail);
    }
    if (err.hint) {
      console.error('Database error hint:', err.hint);
    }
  } finally {
    await pool.end();
  }
}

// Run the test
testRegistrationEndpoint();
