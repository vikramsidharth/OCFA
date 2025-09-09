#!/usr/bin/env node

/**
 * Test script to verify login behavior for approved vs pending users
 * Usage: node test-login-behavior.js
 */

const fetch = require('node-fetch');
const pool = require('./db');

async function testLoginBehavior() {
  console.log('🧪 Testing login behavior for approved vs pending users...');
  
  const API_BASE_URL = 'http://localhost:3001/api';
  
  try {
    // Test 1: Check if we have any pending registrations
    console.log('\n1. Checking for pending registrations...');
    const pendingResult = await pool.query(`
      SELECT username, name, status, created_at 
      FROM registration_requests 
      WHERE status = 'pending' 
      LIMIT 3
    `);
    
    if (pendingResult.rows.length === 0) {
      console.log('   No pending registrations found');
    } else {
      console.log(`   Found ${pendingResult.rows.length} pending registrations:`);
      pendingResult.rows.forEach((req, index) => {
        console.log(`   ${index + 1}. Username: ${req.username}, Name: ${req.name}, Created: ${req.created_at}`);
      });
    }
    
    // Test 2: Check if we have any approved users
    console.log('\n2. Checking for approved users...');
    const approvedResult = await pool.query(`
      SELECT username, name, role, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    if (approvedResult.rows.length === 0) {
      console.log('   No approved users found');
    } else {
      console.log(`   Found ${approvedResult.rows.length} approved users:`);
      approvedResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. Username: ${user.username}, Name: ${user.name}, Role: ${user.role}`);
      });
    }
    
    // Test 3: Test login with pending user (should fail with pending approval message)
    if (pendingResult.rows.length > 0) {
      const pendingUser = pendingResult.rows[0];
      console.log(`\n3. Testing login with pending user: ${pendingUser.username}`);
      
      try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: pendingUser.username,
            password: 'testpassword' // This will fail password check, but should show pending approval first
          }),
        });
        
        const responseText = await response.text();
        console.log(`   Response status: ${response.status}`);
        console.log(`   Response body: ${responseText}`);
        
        if (response.status === 403) {
          console.log('   ✅ Correctly rejected pending user with 403 status');
        } else {
          console.log('   ❌ Expected 403 status for pending user');
        }
        
      } catch (err) {
        console.log('   ❌ Error testing pending user login:', err.message);
      }
    }
    
    // Test 4: Test login with approved user (should work if password is correct)
    if (approvedResult.rows.length > 0) {
      const approvedUser = approvedResult.rows[0];
      console.log(`\n4. Testing login with approved user: ${approvedUser.username}`);
      
      try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: approvedUser.username,
            password: 'wrongpassword' // This will fail, but should show invalid credentials, not pending approval
          }),
        });
        
        const responseText = await response.text();
        console.log(`   Response status: ${response.status}`);
        console.log(`   Response body: ${responseText}`);
        
        if (response.status === 401) {
          console.log('   ✅ Correctly rejected with invalid credentials (401)');
        } else {
          console.log('   ❌ Expected 401 status for wrong password');
        }
        
      } catch (err) {
        console.log('   ❌ Error testing approved user login:', err.message);
      }
    }
    
    // Test 5: Test login with non-existent user
    console.log('\n5. Testing login with non-existent user...');
    try {
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistentuser123',
          password: 'anypassword'
        }),
      });
      
      const responseText = await response.text();
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response body: ${responseText}`);
      
      if (response.status === 401) {
        console.log('   ✅ Correctly rejected non-existent user with 401 status');
      } else {
        console.log('   ❌ Expected 401 status for non-existent user');
      }
      
    } catch (err) {
      console.log('   ❌ Error testing non-existent user login:', err.message);
    }
    
    console.log('\n✅ Login behavior test completed!');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await pool.end();
  }
}

// Run the test
testLoginBehavior();
