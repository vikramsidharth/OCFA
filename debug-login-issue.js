#!/usr/bin/env node

/**
 * Debug script to help identify login issues on hosted environment
 * Usage: node debug-login-issue.js <username>
 */

const fetch = require('node-fetch');
const pool = require('./db');

async function debugLoginIssue(username) {
  console.log(`🔍 Debugging login issue for user: ${username}`);
  
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
  
  try {
    // Check database directly
    console.log('\n1. Checking database directly...');
    
    // Check users table
    const usersResult = await pool.query(
      'SELECT id, username, name, role, email, unit, created_at FROM users WHERE username = $1',
      [username]
    );
    
    console.log(`   Users table: ${usersResult.rows.length} rows found`);
    if (usersResult.rows.length > 0) {
      console.log('   User details:', usersResult.rows[0]);
    }
    
    // Check registration_requests table
    const regRequestsResult = await pool.query(
      'SELECT id, username, name, role, status, created_at FROM registration_requests WHERE username = $1',
      [username]
    );
    
    console.log(`   Registration_requests table: ${regRequestsResult.rows.length} rows found`);
    if (regRequestsResult.rows.length > 0) {
      regRequestsResult.rows.forEach((req, index) => {
        console.log(`   Request ${index + 1}:`, req);
      });
    }
    
    // Test login API
    console.log('\n2. Testing login API...');
    try {
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          password: 'testpassword' // Use a test password
        }),
      });
      
      const responseText = await response.text();
      console.log(`   API Response Status: ${response.status}`);
      console.log(`   API Response Body: ${responseText}`);
      
      if (response.ok) {
        console.log('   ❌ PROBLEM: User can login without being in users table!');
      } else {
        console.log('   ✅ Login correctly rejected');
      }
      
    } catch (apiError) {
      console.log('   ❌ API Error:', apiError.message);
    }
    
    // Summary
    console.log('\n3. Summary:');
    if (usersResult.rows.length > 0) {
      console.log('   ✅ User exists in users table - login should work');
    } else if (regRequestsResult.rows.length > 0) {
      const pendingRequests = regRequestsResult.rows.filter(req => req.status === 'pending');
      if (pendingRequests.length > 0) {
        console.log('   ❌ User only exists in registration_requests with pending status - login should be rejected');
      } else {
        console.log('   ❌ User only exists in registration_requests with non-pending status - login should be rejected');
      }
    } else {
      console.log('   ❌ User does not exist in either table - login should be rejected');
    }
    
  } catch (err) {
    console.error('❌ Debug failed:', err.message);
  } finally {
    await pool.end();
  }
}

// Get username from command line argument
const username = process.argv[2];
if (!username) {
  console.log('Usage: node debug-login-issue.js <username>');
  process.exit(1);
}

debugLoginIssue(username);
