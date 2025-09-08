#!/usr/bin/env node

/**
 * Setup script for health-related database tables
 * Run this script to initialize the health tables in your PostgreSQL database
 * 
 * Usage: node setup-health-tables.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function setupHealthTables() {
  console.log('🏥 Setting up health tables for Future Soldiers APK...');
  
  try {
    // Read the health schema file
    const schemaPath = path.join(__dirname, 'health-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('✅ Health tables created successfully!');
    console.log('📊 Created tables:');
    console.log('   - soldier_health_vitals');
    console.log('   - soldier_health_profile');
    console.log('   - health_status_thresholds');
    console.log('   - Indexes and triggers');
    console.log('   - Helper functions');
    
    // Test the setup by checking if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('soldier_health_vitals', 'soldier_health_profile', 'health_status_thresholds')
      ORDER BY table_name
    `);
    
    console.log('🔍 Verification:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check thresholds
    const thresholds = await pool.query('SELECT COUNT(*) as count FROM health_status_thresholds');
    console.log(`   📋 Health thresholds: ${thresholds.rows[0].count} configured`);
    
    console.log('\n🎉 Health database setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your backend server: node index.js');
    console.log('   2. Test the health endpoints with your frontend app');
    console.log('   3. Soldiers can now view their health dashboard');
    
  } catch (error) {
    console.error('❌ Error setting up health tables:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupHealthTables();

