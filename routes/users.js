const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');

// GET /api/users
router.get('/', async (req, res) => {
  const { username, role, unit } = req.query;
  try {
    if (username) {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(result.rows[0]);
    } else if (role && unit) {
      const result = await pool.query(
        'SELECT * FROM users WHERE LOWER(role) = LOWER($1) AND LOWER(unit) = LOWER($2) ORDER BY id',
        [role, unit]
      );
      return res.json(result.rows);
    } else if (role) {
      const result = await pool.query('SELECT * FROM users WHERE LOWER(role) = LOWER($1) ORDER BY id', [role]);
      return res.json(result.rows);
    } else if (unit) {
      const result = await pool.query('SELECT * FROM users WHERE LOWER(unit) = LOWER($1) ORDER BY id', [unit]);
      return res.json(result.rows);
    } else {
      const result = await pool.query('SELECT * FROM users ORDER BY id');
      res.json(result.rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/register
router.post('/register', async (req, res) => {
  const {
    username,
    password,
    name,
    role,
    email,
    unit_name,
    category,
    phone_no,
    id_no
  } = req.body;
  if (!username || !password || !role || !name || !id_no) {
    return res.status(400).json({ error: 'Missing required fields: username, password, role, name, and ID Number are required' });
  }
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      `INSERT INTO users (
        username, password, name, role, email, unit, category, "MobileNumber", "EmployeeID", latitude, longitude, heading
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING id, username, name, role, email, unit, category, "MobileNumber", "EmployeeID", latitude, longitude, heading`,
      [
        username,
        hashedPassword,
        name,
        role,
        email,
        unit_name,
        category,
        phone_no,
        id_no,
        0, // latitude default
        0, // longitude default
        0  // heading default
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[REGISTER] Backend error:', err);
    if (err.stack) console.error(err.stack);
    if (err.detail) console.error('DB Detail:', err.detail);
    if (err.hint) console.error('DB Hint:', err.hint);
    if (err.code) console.error('DB Code:', err.code);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
    }
    res.status(500).json({ error: err.message || 'Server error during registration' });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login request payload:', req.body);
  if (!username || !password) {
    console.log('Login error: Missing username or password');
    return res.status(400).json({ error: 'Missing username or password' });
  }
  try {
    const result = await pool.query(
      'SELECT id, username, password, name, role, email, unit FROM users WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) {
      console.log('Login error: Invalid credentials (user not found)');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    // Normalize role to lowercase and restrict to 'commander' or 'soldier'
    if (user.role) {
      const normalizedRole = user.role.toLowerCase();
      if (normalizedRole === 'commander') {
        user.role = 'commander';
      } else if (normalizedRole === 'soldier') {
        user.role = 'soldier';
      } else {
        user.role = 'soldier'; // Default to soldier if invalid
      }
    } else {
      user.role = 'soldier'; // Default to soldier if missing
    }
    console.log('Stored password in DB:', user.password);
    // Allow login if password matches hash (bcrypt) OR is exactly the stored hash (legacy hashed login)
    const bcryptResult = await bcrypt.compare(password, user.password);
    const directMatch = password === user.password;
    console.log('bcrypt.compare result:', bcryptResult);
    console.log('Direct string match:', directMatch);
    const passwordMatch = bcryptResult || directMatch;
    if (!passwordMatch) {
      // Fallback: check if there is a user with this username and password (plain text match in DB)
      const fallbackResult = await pool.query(
        'SELECT id, username, name, role, email, unit, password FROM users WHERE username = $1 AND password = $2',
        [username, password]
      );
      console.log('Fallback DB result:', fallbackResult.rows);
      if (fallbackResult.rows.length === 1) {
        const fallbackUser = fallbackResult.rows[0];
        // Normalize role to lowercase and restrict to 'commander' or 'soldier'
        if (fallbackUser.role) {
          const normalizedRole = fallbackUser.role.toLowerCase();
          if (normalizedRole === 'commander') {
            fallbackUser.role = 'commander';
          } else if (normalizedRole === 'soldier') {
            fallbackUser.role = 'soldier';
          } else {
            fallbackUser.role = 'soldier';
          }
        } else {
          fallbackUser.role = 'soldier';
        }
        console.log('Login success (fallback plain match):', fallbackUser);
        return res.json(fallbackUser);
      }
      console.log('Login error: Invalid credentials (wrong password)');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    delete user.password;
    console.log('Login success:', user);
    res.json(user);
  } catch (err) {
    console.log('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/soldier-overview?commander_id=ID
router.get('/soldier-overview', async (req, res) => {
  const { commander_id } = req.query;
  if (!commander_id) {
    return res.status(400).json({ error: 'commander_id is required' });
  }
  try {
    // A) Determine the commander's unit name (fallback path)
    let commanderUnit = null;
    try {
      const cu = await pool.query('SELECT unit FROM users WHERE id = $1', [commander_id]);
      commanderUnit = (cu.rows[0]?.unit || null);
    } catch {}

    // B) Primary: mapping-based units assigned to the commander
    const unitResult = await pool.query(
      'SELECT unit_id FROM commander_unit_mappings WHERE commander_id = $1',
      [commander_id]
    );
    const unitIds = unitResult.rows.map(row => row.unit_id);

    // B1) Soldiers via mapping tables
    let mappingSoldiers = [];
    if (unitIds.length > 0) {
    const soldierResult = await pool.query(
      `SELECT u.id, u.username, u.name, u.unit
       FROM users u
       JOIN soldier_unit_mappings s ON u.id = s.soldier_id
         WHERE s.unit_id = ANY($1::int[]) AND LOWER(u.role) = 'soldier'`,
      [unitIds]
    );
      mappingSoldiers = soldierResult.rows;
    }

    // B2) Fallback: soldiers by unit name match (case-insensitive)
    let unitNameSoldiers = [];
    if (commanderUnit) {
      const unitName = commanderUnit.toLowerCase();
      const sr = await pool.query(
        `SELECT id, username, name, unit
         FROM users
         WHERE LOWER(unit) = $1 AND LOWER(role) = 'soldier'
         ORDER BY id`,
        [unitName]
      );
      unitNameSoldiers = sr.rows;
    }

    // Combine and deduplicate soldiers by id
    const combinedMap = new Map();
    [...mappingSoldiers, ...unitNameSoldiers].forEach(s => {
      if (s && !combinedMap.has(s.id)) combinedMap.set(s.id, s);
    });
    const soldiers = Array.from(combinedMap.values());

    if (soldiers.length === 0) {
      return res.json([]);
    }

    // Enrich with latest location, health, and operation details
    const soldierIds = soldiers.map(s => s.id);

    const locationResult = await pool.query(
      `SELECT DISTINCT ON (user_id) user_id, latitude, longitude, recorded_at
       FROM user_location_history
       WHERE user_id = ANY($1::int[])
       ORDER BY user_id, recorded_at DESC`,
      [soldierIds]
    );
    const locationMap = {};
    locationResult.rows.forEach(row => { locationMap[row.user_id] = row; });

    const healthResult = await pool.query(
      `SELECT * FROM advanced_health_details WHERE user_id = ANY($1::int[])`,
      [soldierIds]
    );
    const healthMap = {};
    healthResult.rows.forEach(row => { healthMap[row.user_id] = row; });

    const opResult = await pool.query(
      `SELECT * FROM operation_details WHERE user_id = ANY($1::int[])`,
      [soldierIds]
    );
    const opMap = {};
    opResult.rows.forEach(row => { opMap[row.user_id] = row; });

    const overview = soldiers.map(soldier => ({
      id: soldier.id,
      username: soldier.username,
      name: soldier.name,
      unit: soldier.unit,
      location: locationMap[soldier.id] || null,
      health: healthMap[soldier.id] || null,
      operation: opMap[soldier.id] || null,
    }));
    res.json(overview);
  } catch (err) {
    console.error('Error in /api/users/soldier-overview:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// PUT /api/users/update-tokens
// Kept for backward compatibility, but will not require DB columns
router.put('/update-tokens', async (req, res) => {
  // Accept and ignore without error so mobile can call it safely
  try {
    res.json({ message: 'Accepted (no DB storage). Consider topic subscription endpoints instead.' });
  } catch (err) {
    res.status(200).json({ message: 'Accepted' });
  }
});

// POST /api/users/subscribe-topic   { fcmToken, topic }
router.post('/subscribe-topic', async (req, res) => {
  try {
    const { fcmToken, topic = 'alerts' } = req.body || {};
    console.log('📱 Subscribing FCM token to topic:', { fcmToken: fcmToken ? '***' + fcmToken.slice(-10) : null, topic });
    
    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }
    
    const { subscribeTokenToTopic } = require('../services/firebaseService');
    const out = await subscribeTokenToTopic(fcmToken, topic);
    console.log('✅ Successfully subscribed to topic:', out);
    res.json(out);
  } catch (err) {
    console.error('❌ Error subscribing to topic:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/users/unsubscribe-topic   { fcmToken, topic }
router.post('/unsubscribe-topic', async (req, res) => {
  try {
    const { fcmToken, topic = 'alerts' } = req.body || {};
    console.log('📱 Unsubscribing FCM token from topic:', { fcmToken: fcmToken ? '***' + fcmToken.slice(-10) : null, topic });
    
    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }
    
    const { unsubscribeTokenFromTopic } = require('../services/firebaseService');
    const out = await unsubscribeTokenFromTopic(fcmToken, topic);
    console.log('✅ Successfully unsubscribed from topic:', out);
    res.json(out);
  } catch (err) {
    console.error('❌ Error unsubscribing from topic:', err);
    res.status(400).json({ error: err.message });
  }
});

// --- Registration Requests ---
const { v4: uuidv4 } = require('uuid');

// POST /api/registration-requests
router.post('/registration-requests', async (req, res) => {
  console.log('POST /api/registration-requests', req.body); // Debug log
  const {
    username,
    password,
    name,
    role,
    email,
    unit_name,
    category,
    age,
    gender,
    height,
    weight,
    bp,
    phone_no,
    id_no,
    blood_group
  } = req.body;
  if (!username || !password || !role || !name || !id_no) {
    return res.status(400).json({ error: 'Missing required fields: username, password, role, name, and ID Number are required' });
  }
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      `INSERT INTO users (
        username, password, name, role, email, unit, category, age, gender, height, weight, bp, "MobileNumber", "EmployeeID", blood_group
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING id, username, name, role, email, unit, category, age, gender, height, weight, bp, "MobileNumber", "EmployeeID", blood_group`,
      [
        username,
        hashedPassword,
        name,
        role,
        email,
        unit_name,
        category,
        age,
        gender,
        height,
        weight,
        bp,
        phone_no,
        id_no,
        blood_group
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[REGISTER] Backend error:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: err.message || 'Server error during registration' });
    }
  }
});

// GET /api/registration-requests (not allowed)
router.get('/registration-requests', (req, res) => {
  res.status(405).json({ error: 'GET not allowed on this endpoint. Use POST to register.' });
});

// POST /api/registration-requests/:id/accept
router.post('/registration-requests/:id/accept', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get the request data
    const { rows } = await client.query(
      'SELECT * FROM registration_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registration request not found or already processed' });
    }

    const user = rows[0];

    // 2. Insert into users table
    const insertResult = await client.query(
      `INSERT INTO users (username, password, name, role, email, unit, category, age, gender, height, weight, bp, "MobileNumber", "EmployeeID", blood_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, username, name, role, email`,
      [
        user.username,
        user.password,
        user.name,
        user.role,
        user.email,
        user.unit_name,
        user.category,
        user.age,
        user.gender,
        user.height,
        user.weight,
        user.bp,
        user.phone_no,
        user.id_no,
        user.blood_group
      ]
    );

    // 3. Update registration status
    await client.query(
      'UPDATE registration_requests SET status = $1 WHERE id = $2',
      ['accepted', id]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'User accepted and added to system', user: insertResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error accepting registration:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/registration-requests/:id/reject
router.post('/registration-requests/:id/reject', async (req, res) => {
  try {
    await pool.query(
      `UPDATE registration_requests SET status = 'rejected', processed_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Request rejected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PARAMETERIZED ROUTES (must come after specific routes) =====

// PUT /api/users/:id - update soldier details (name, email, unit, MobileNumber, role)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, unit, MobileNumber, role } = req.body || {};

  // Normalize placeholder/null-like values to actual nulls to avoid strings like "[null]"
  const normalizeNullish = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim().toLowerCase();
    if (s === '' || s === 'null' || s === '[null]' || s === 'undefined' || s === 'na' || s === 'n/a') return null;
    return v;
  };

  try {
    const result = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        unit = COALESCE($3, unit),
        "MobileNumber" = COALESCE($4, "MobileNumber"),
        role = COALESCE($5, role)
       WHERE id = $6
       RETURNING id, username, name, role, email, unit, "MobileNumber"`,
      [
        normalizeNullish(name),
        normalizeNullish(email),
        normalizeNullish(unit),
        normalizeNullish(MobileNumber),
        normalizeNullish(role),
        id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/location
router.put('/:id/location', async (req, res) => {
  const userId = req.params.id;
  const { latitude, longitude, heading } = req.body;
  const safeHeading = typeof heading === 'number' && !isNaN(heading) ? heading : 0;
  console.log('--- BACKEND /users/:id/location ---');
  console.log(`Received location update for userId: ${userId}`);
  console.log(`Payload: { latitude: ${latitude}, longitude: ${longitude}, heading: ${safeHeading} }`);
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    console.error('Validation Error: latitude and longitude must be numbers.');
    return res.status(400).json({ error: 'latitude and longitude must be numbers' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET latitude = $1, longitude = $2, heading = $3 WHERE id = $4 RETURNING *',
      [latitude, longitude, safeHeading, userId]
    );
    if (result.rows.length === 0) {
      console.error('User not found for id:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Location update successful for userId:', userId);
    return res.status(200).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Database error during location update:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/photo
// Accepts JSON { photoBase64: string } where string can be raw base64 or a data URI (e.g., data:image/jpeg;base64,....)
router.put('/:id/photo', async (req, res) => {
  const userId = req.params.id;
  let { photoBase64 } = req.body || {};
  try {
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return res.status(400).json({ error: 'photoBase64 is required' });
    }

    // Debug: log payload size (not data) and enforce a max size to avoid overloads
    const approxLen = photoBase64.length;
    console.log(`[PHOTO] userId=${userId} payloadLen=${approxLen}`);
    if (approxLen > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large' });
    }

    // Normalize: strip data URI header if present to store raw base64 only (smaller DB, consistent reads)
    const normalized = photoBase64.startsWith('data:')
      ? photoBase64.substring(photoBase64.indexOf(',') + 1)
      : photoBase64;

    const result = await pool.query(
      'UPDATE users SET photo = $1 WHERE id = $2 RETURNING id, username, name, role, email, unit, photo',
      [normalized, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Error updating user photo:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET /api/users/:id/tasks
router.get('/:id/tasks', async (req, res) => {
  const userId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT "ID" as id, "ZONE_ID" as zone_id, "ASSIGNED_BY" as assigned_by, "CREATED_BY" as created_by
       FROM "ZONE_ASSIGNMENT"
       WHERE "SOULDER_ID" = $1
       ORDER BY "ID" DESC`,
      [userId]
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Error fetching tasks for user', userId, err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router; 