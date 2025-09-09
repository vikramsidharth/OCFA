#!/usr/bin/env node

/**
 * Script to check recent registration data in both users and registration_requests tables
 * Usage: node check-registration-data.js
 */

const pool = require('./db');

async function checkRegistrationData() {
  console.log('🔍 Checking recent registration data...');
  
  try {
    // Check recent registrations in users table
    console.log('\n1. Recent registrations in users table (last 10):');
    const usersResult = await pool.query(`
      SELECT id, username, name, role, email, unit, category, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (usersResult.rows.length === 0) {
      console.log('   No users found in users table');
    } else {
      usersResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. ID: ${user.id}, Username: ${user.username}, Name: ${user.name}, Role: ${user.role}, Created: ${user.created_at}`);
      });
    }
    
    // Check recent registrations in registration_requests table
    console.log('\n2. Recent registrations in registration_requests table (last 10):');
    const regRequestsResult = await pool.query(`
      SELECT id, username, name, role, email, unit_name, category, status, created_at 
      FROM registration_requests 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (regRequestsResult.rows.length === 0) {
      console.log('   No registration requests found in registration_requests table');
    } else {
      regRequestsResult.rows.forEach((req, index) => {
        console.log(`   ${index + 1}. ID: ${req.id}, Username: ${req.username}, Name: ${req.name}, Role: ${req.role}, Status: ${req.status}, Created: ${req.created_at}`);
      });
    }
    
    // Check for pending registrations
    console.log('\n3. Pending registration requests:');
    const pendingResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM registration_requests 
      WHERE status = 'pending'
    `);
    
    console.log(`   Pending registrations: ${pendingResult.rows[0].count}`);
    
    // Check for accepted registrations
    console.log('\n4. Accepted registration requests:');
    const acceptedResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM registration_requests 
      WHERE status = 'accepted'
    `);
    
    console.log(`   Accepted registrations: ${acceptedResult.rows[0].count}`);
    
    // Check for rejected registrations
    console.log('\n5. Rejected registration requests:');
    const rejectedResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM registration_requests 
      WHERE status = 'rejected'
    `);
    
    console.log(`   Rejected registrations: ${rejectedResult.rows[0].count}`);
    
    console.log('\n✅ Data check completed!');
    
  } catch (err) {
    console.error('❌ Error checking registration data:', err.message);
    console.error('Stack trace:', err.stack);
  } finally {
    await pool.end();
  }
}

// Run the check
checkRegistrationData();
