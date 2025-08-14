const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendEmergencyAlert, sendZoneBreachAlert } = require('../services/firebaseService');

// GET /api/alerts - Get all alerts with filtering
router.get('/', async (req, res) => {
  const { status, severity, alertType, unit, limit = 50, offset = 0 } = req.query;
  
  try {
    let query = 'SELECT * FROM alerts WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (severity) {
      paramCount++;
      query += ` AND severity = $${paramCount}`;
      params.push(severity);
    }

    if (alertType) {
      paramCount++;
      query += ` AND alert_type = $${paramCount}`;
      params.push(alertType);
    }

    if (unit) {
      paramCount++;
      query += ` AND $${paramCount} = ANY(affected_units)`;
      params.push(unit);
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/:id - Get specific alert
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM alerts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts - Create new emergency alert
router.post('/', async (req, res) => {
  const { 
    title, 
    message, 
    severity, 
    affectedUnits, 
    affectedUsers, 
    latitude, 
    longitude,
    createdBy 
  } = req.body;

  try {
    // Validate required fields
    if (!title || !message || !severity || !createdBy) {
      return res.status(400).json({ 
        error: 'Title, message, severity, and createdBy are required' 
      });
    }

    // Send emergency alert via Firebase
    const alertResult = await sendEmergencyAlert({
      title,
      message,
      severity,
      affectedUnits,
      affectedUsers,
      latitude,
      longitude,
      createdBy
    });

    res.status(201).json({
      message: 'Emergency alert created and sent successfully',
      alertResult
    });

  } catch (err) {
    console.error('Error creating emergency alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/zone-breach - Create zone breach alert
router.post('/zone-breach', async (req, res) => {
  const { 
    zoneId, 
    userId, 
    breachType, 
    latitude, 
    longitude 
  } = req.body;

  try {
    // Validate required fields
    if (!zoneId || !userId || !breachType) {
      return res.status(400).json({ 
        error: 'Zone ID, user ID, and breach type are required' 
      });
    }

    // Send zone breach alert via Firebase
    const alertResult = await sendZoneBreachAlert({
      zoneId,
      userId,
      breachType,
      latitude,
      longitude
    });

    res.status(201).json({
      message: 'Zone breach alert created and sent successfully',
      alertResult
    });

  } catch (err) {
    console.error('Error creating zone breach alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/acknowledge - Acknowledge an alert
router.put('/:id/acknowledge', async (req, res) => {
  const { id } = req.params;
  const { acknowledgedBy } = req.body;
  
  try {
    if (!acknowledgedBy) {
      return res.status(400).json({ error: 'acknowledgedBy is required' });
    }

    const result = await pool.query(
      `UPDATE alerts SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [acknowledgedBy, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error acknowledging alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/resolve - Resolve an alert
router.put('/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolvedBy, resolutionNotes } = req.body;
  
  try {
    if (!resolvedBy) {
      return res.status(400).json({ error: 'resolvedBy is required' });
    }

    const result = await pool.query(
      `UPDATE alerts SET status = 'resolved', resolved_by = $1, resolved_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [resolvedBy, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error resolving alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/alerts/:id - Delete an alert
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM alerts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert deleted successfully' });
  } catch (err) {
    console.error('Error deleting alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/stats/summary - Get alert statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts,
        COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_alerts,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_alerts,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_alerts,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_alerts
      FROM alerts
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Error fetching alert statistics:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 