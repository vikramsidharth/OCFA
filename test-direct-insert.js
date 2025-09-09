const pool = require('./db');

async function testDirectInsert() {
  console.log('🧪 Testing direct insert into registration_requests...');
  
  const testData = {
    username: 'test_direct_' + Date.now(),
    password: '$2b$10$test.hash.for.testing',
    name: 'Test Direct User',
    role: 'soldier',
    email: 'testdirect@example.com',
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
  
  try {
    console.log('Testing INSERT statement...');
    
    const result = await pool.query(`
      INSERT INTO registration_requests (
        username, password, name, role, email, category, age, status, gender, height, weight, bp, id_no, blood_group, unit_name, phone, phone_no
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING id, username, name, role, email, status, created_at
    `, [
      testData.username,
      testData.password,
      testData.name,
      testData.role,
      testData.email,
      testData.category,
      testData.age,
      'pending',
      testData.gender,
      testData.height,
      testData.weight,
      testData.bp,
      testData.id_no,
      testData.blood_group,
      testData.unit_name,
      testData.phone_no,
      testData.phone_no
    ]);
    
    console.log('✅ Direct insert successful!');
    console.log('Result:', result.rows[0]);
    
    // Clean up
    await pool.query('DELETE FROM registration_requests WHERE id = $1', [result.rows[0].id]);
    console.log('✅ Test record cleaned up');
    
  } catch (err) {
    console.error('❌ Direct insert failed:', err.message);
    console.error('Error code:', err.code);
    console.error('Error detail:', err.detail);
    console.error('Error hint:', err.hint);
  } finally {
    await pool.end();
  }
}

testDirectInsert();
