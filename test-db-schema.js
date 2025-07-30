const pool = require('./db');

async function testDatabaseSchema() {
  try {
    console.log('Testing database schema...');
    
    // Check the table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('latitude', 'longitude', 'heading')
      ORDER BY ordinal_position;
    `);
    
    console.log('Location columns in users table:');
    tableInfo.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
    // Test inserting a user with location data
    const testUser = {
      username: 'test_location_user_' + Date.now(),
      password: 'test123',
      name: 'Test Location User',
      role: 'soldier',
      email: 'test@example.com',
      unit_name: 'Test Unit',
      category: 'Test',
      phone_no: '1234567890',
      id_no: 'TEST123',
      latitude: 17.5433073,
      longitude: 78.49011,
      heading: 45.5
    };
    
    console.log('\nTesting insertion with location data:', testUser);
    
    // First, delete if exists
    await pool.query('DELETE FROM users WHERE username = $1', [testUser.username]);
    
    // Insert test user
    const result = await pool.query(
      `INSERT INTO users (
        username, password, name, role, email, unit, category, "MobileNumber", "EmployeeID", latitude, longitude, heading
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING id, username, latitude, longitude, heading`,
      [
        testUser.username,
        testUser.password,
        testUser.name,
        testUser.role,
        testUser.email,
        testUser.unit_name,
        testUser.category,
        testUser.phone_no,
        testUser.id_no,
        testUser.latitude,
        testUser.longitude,
        testUser.heading
      ]
    );
    
    console.log('Inserted user:', result.rows[0]);
    
    // Verify the data was stored correctly
    const verifyResult = await pool.query(
      'SELECT id, username, latitude, longitude, heading FROM users WHERE username = $1',
      [testUser.username]
    );
    
    console.log('Verified data:', verifyResult.rows[0]);
    
    // Clean up
    await pool.query('DELETE FROM users WHERE username = $1', [testUser.username]);
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
  } finally {
    await pool.end();
  }
}

testDatabaseSchema(); 