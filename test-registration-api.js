#!/usr/bin/env node

/**
 * Test script to verify the registration-requests API endpoint
 * Usage: node test-registration-api.js
 */

const fetch = require('node-fetch');

async function testRegistrationAPI() {
  console.log('🧪 Testing registration-requests API endpoint...');
  
  const API_BASE_URL = 'http://localhost:3001/api';
  
  const testUser = {
    username: 'test_api_user_' + Date.now(),
    password: 'TestPassword123!',
    name: 'Test API User',
    role: 'soldier',
    email: 'testapi@example.com',
    unit_name: 'Test Unit',
    category: 'Test Category',
    phone_no: '1234567890',
    id_no: 'TEST' + Date.now(),
    age: 25,
    gender: 'Male',
    height: '170cm',
    weight: '70kg',
    bp: '120/80',
    blood_group: 'O+'
  };
  
  try {
    console.log('\n1. Testing registration-requests endpoint...');
    console.log('Sending data:', JSON.stringify(testUser, null, 2));
    
    const response = await fetch(`${API_BASE_URL}/users/registration-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ Registration request successful!');
      console.log('Response:', result);
      
      // Check if the record was actually inserted
      console.log('\n2. Verifying record in database...');
      const pool = require('./db');
      const dbResult = await pool.query(
        'SELECT * FROM registration_requests WHERE username = $1',
        [testUser.username]
      );
      
      if (dbResult.rows.length > 0) {
        console.log('✅ Record found in database:');
        console.log('   ID:', dbResult.rows[0].id);
        console.log('   Username:', dbResult.rows[0].username);
        console.log('   Status:', dbResult.rows[0].status);
        console.log('   Created:', dbResult.rows[0].created_at);
        
        // Clean up test record
        await pool.query('DELETE FROM registration_requests WHERE id = $1', [dbResult.rows[0].id]);
        console.log('✅ Test record cleaned up');
      } else {
        console.log('❌ Record not found in database');
      }
      
      await pool.end();
    } else {
      console.log('❌ Registration request failed');
      console.log('Error:', responseText);
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error('Stack trace:', err.stack);
  }
}

// Run the test
testRegistrationAPI();
