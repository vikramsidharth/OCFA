const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helper function to determine health status
function getHealthStatus(metricName, value) {
  if (value === null || value === undefined) return 'no_data';
  
  const thresholds = {
    spo2: { normal: [95, 100], critical: [90, 100] },
    steps: { normal: [5000, 15000], critical: [0, 20000] },
    sleep_hours: { normal: [7, 9], critical: [4, 12] }
  };
  
  const threshold = thresholds[metricName];
  if (!threshold) return 'normal';
  
  if (value < threshold.critical[0] || value > threshold.critical[1]) {
    return 'critical';
  } else if (value >= threshold.normal[0] && value <= threshold.normal[1]) {
    return 'normal';
  } else {
    return 'warning';
  }
}

// Helper function to parse blood pressure
function parseBloodPressure(bpString) {
  if (!bpString) return { systolic: null, diastolic: null };
  
  const parts = bpString.split('/');
  if (parts.length === 2) {
    return {
      systolic: parseInt(parts[0]) || null,
      diastolic: parseInt(parts[1]) || null
    };
  }
  return { systolic: null, diastolic: null };
}

// GET /api/health/vitals/:userId - Get latest health vitals for a soldier
router.get('/vitals/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const result = await pool.query(
      `SELECT * FROM vitals WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        user_id: parseInt(userId),
        blood_pressure: null,
        blood_pressure_systolic: null,
        blood_pressure_diastolic: null,
        spo2: null,
        steps: null,
        sleep_hours: null,
        recorded_at: null
      });
    }
    
    const vitals = result.rows[0];
    const bp = parseBloodPressure(vitals.bp);
    
    // Add status indicators for each vital
    const vitalsWithStatus = {
      user_id: vitals.user_id,
      blood_pressure: vitals.bp,
      blood_pressure_systolic: bp.systolic,
      blood_pressure_diastolic: bp.diastolic,
      spo2: vitals.spo2,
      steps: vitals.steps,
      sleep_hours: vitals.sleep_hours,
      recorded_at: vitals.recorded_at,
      status: {
        blood_pressure: getHealthStatus('blood_pressure', bp.systolic),
        spo2: getHealthStatus('spo2', vitals.spo2),
        steps: getHealthStatus('steps', vitals.steps),
        sleep_hours: getHealthStatus('sleep_hours', vitals.sleep_hours)
      }
    };
    
    res.json(vitalsWithStatus);
  } catch (err) {
    console.error('Error fetching health vitals:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// POST /api/health/vitals/:userId - Record new health vitals
router.post('/vitals/:userId', async (req, res) => {
  const { userId } = req.params;
  const {
    bp,
    spo2,
    steps,
    sleep_hours
  } = req.body;
  
  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const result = await pool.query(
      `INSERT INTO vitals (user_id, bp, spo2, steps, sleep_hours)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [userId, bp, spo2, steps, sleep_hours]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error recording health vitals:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET /api/health/profile/:userId - Get health profile for a soldier
router.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get latest vitals data for profile
    const result = await pool.query(
      `SELECT * FROM vitals WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        user_id: parseInt(userId),
        steps_today: 0,
        sleep_hours: null,
        last_updated: null
      });
    }
    
    const vitals = result.rows[0];
    
    // Add status indicators for each metric
    const profileWithStatus = {
      user_id: vitals.user_id,
      steps_today: vitals.steps || 0,
      sleep_hours: vitals.sleep_hours,
      last_updated: vitals.recorded_at,
      status: {
        steps_today: getHealthStatus('steps', vitals.steps),
        sleep_hours: getHealthStatus('sleep_hours', vitals.sleep_hours)
      }
    };
    
    res.json(profileWithStatus);
  } catch (err) {
    console.error('Error fetching health profile:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// PUT /api/health/profile/:userId - Update health profile for a soldier
router.put('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const {
    steps,
    sleep_hours
  } = req.body;
  
  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update the latest vitals record
    const result = await pool.query(
      `UPDATE vitals SET
        steps = COALESCE($1, steps),
        sleep_hours = COALESCE($2, sleep_hours)
      WHERE user_id = $3
      ORDER BY recorded_at DESC
      LIMIT 1
      RETURNING *`,
      [steps, sleep_hours, userId]
    );
    
    if (result.rows.length === 0) {
      // Create new vitals record if none exists
      const newResult = await pool.query(
        `INSERT INTO vitals (user_id, steps, sleep_hours)
        VALUES ($1, $2, $3)
        RETURNING *`,
        [userId, steps, sleep_hours]
      );
      res.json(newResult.rows[0]);
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error updating health profile:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET /api/health/dashboard/:userId - Get complete health dashboard data
router.get('/dashboard/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    // First check if user exists
    const userCheck = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get latest vitals
    const vitalsResult = await pool.query(
      `SELECT * FROM vitals WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [userId]
    );
    
    // Get current active mission
    const missionResult = await pool.query(
      `SELECT 
        assignment_id as id,
        assignment_name as title,
        brief_description as description,
        status,
        type as priority,
        created_at,
        destination,
        objectives
       FROM assignments 
       WHERE status IN ('Ongoing', 'Pending', 'Active')
       ORDER BY created_at DESC
       LIMIT 1`
    );
    
    let vitals, profile;
    
    if (vitalsResult.rows.length === 0) {
      vitals = {
        user_id: parseInt(userId),
        blood_pressure: null,
        blood_pressure_systolic: null,
        blood_pressure_diastolic: null,
        spo2: null,
        steps: null,
        sleep_hours: null,
        recorded_at: null
      };
      profile = {
        user_id: parseInt(userId),
        steps_today: 0,
        sleep_hours: null,
        last_updated: null
      };
    } else {
      const vitalsData = vitalsResult.rows[0];
      const bp = parseBloodPressure(vitalsData.bp);
      
      vitals = {
        user_id: vitalsData.user_id,
        blood_pressure: vitalsData.bp,
        blood_pressure_systolic: bp.systolic,
        blood_pressure_diastolic: bp.diastolic,
        spo2: vitalsData.spo2,
        steps: vitalsData.steps,
        sleep_hours: vitalsData.sleep_hours,
        recorded_at: vitalsData.recorded_at
      };
      
      profile = {
        user_id: vitalsData.user_id,
        steps_today: vitalsData.steps || 0,
        sleep_hours: vitalsData.sleep_hours,
        last_updated: vitalsData.recorded_at
      };
    }
    
    const currentMission = missionResult.rows[0] || null;
    
    // Add status indicators
    const vitalsWithStatus = {
      ...vitals,
      status: {
        blood_pressure: getHealthStatus('blood_pressure', vitals.blood_pressure_systolic),
        spo2: getHealthStatus('spo2', vitals.spo2),
        steps: getHealthStatus('steps', vitals.steps),
        sleep_hours: getHealthStatus('sleep_hours', vitals.sleep_hours)
      }
    };
    
    const profileWithStatus = {
      ...profile,
      status: {
        steps_today: getHealthStatus('steps', profile.steps_today),
        sleep_hours: getHealthStatus('sleep_hours', profile.sleep_hours)
      }
    };
    
    res.json({
      vitals: vitalsWithStatus,
      profile: profileWithStatus,
      currentMission: currentMission
    });
  } catch (err) {
    console.error('Error fetching health dashboard:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;
