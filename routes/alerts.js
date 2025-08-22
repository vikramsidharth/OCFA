const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendFirebaseNotification, sendNotificationsByFilter, sendTopicNotification } = require('../services/firebaseService');

// GET /api/alerts - Get all alerts with filtering (matches simple alerts schema)
router.get('/', async (req, res) => {
  const { status, severity, category, unit, userId, limit = 50, offset = 0 } = req.query;
  try {
    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];
    let p = 0;

    if (status) { p++; query += ` AND status = $${p}`; params.push(status); }
    if (severity) { p++; query += ` AND severity = $${p}`; params.push(severity); }
    if (category) { p++; query += ` AND category = $${p}`; params.push(category); }
    if (unit) { p++; query += ` AND unit = $${p}`; params.push(unit); }
    if (userId) { p++; query += ` AND user_id = $${p}`; params.push(parseInt(userId)); }

    query += ' ORDER BY created_at DESC';
    p++; query += ` LIMIT $${p}`; params.push(parseInt(limit));
    p++; query += ` OFFSET $${p}`; params.push(parseInt(offset));

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

// POST /api/alerts - Create a new alert and send push (matches simple alerts schema)
router.post('/', async (req, res) => {
  const { category, message, severity = 'medium', status = 'active', userId, unit } = req.body;
  try {
    if (!category || !message) {
      return res.status(400).json({ error: 'category and message are required' });
    }

    // Insert alert row matching provided schema
    const insert = await pool.query(
      `INSERT INTO alerts (category, message, severity, status, user_id, unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [category, message, severity, status, userId || null, unit || null]
    );
    const alert = insert.rows[0];

    // Build push payload
    const push = {
      title: category,
      body: message,
      data: {
        type: category,
        category,
        severity,
        status,
        alertId: String(alert.id),
      }
    };

    // Send push to specific user if provided, otherwise by unit if provided, otherwise broadcast to 'alerts' topic
    let pushResult = null;
    try {
      if (userId) {
        pushResult = await sendFirebaseNotification(userId, push);
      } else if (unit) {
        pushResult = await sendNotificationsByFilter({ unit, hasPushToken: true }, push);
      } else {
        pushResult = await sendTopicNotification('alerts', push);
      }
    } catch (pushErr) {
      console.error('Push send failed:', pushErr.message);
      // Do not fail the request if push fails
    }

    return res.status(201).json({ alert, pushResult });
  } catch (err) {
    console.error('Error creating alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/test-push - Test push notification system
router.post('/test-push', async (req, res) => {
  const { userId, unit, type = 'test', message = 'This is a test notification' } = req.body;
  
  try {
    console.log('🧪 Testing push notification system...');
    
    // Create test alert
    const testAlert = {
      category: type,
      message: message,
      severity: 'medium',
      status: 'active',
      userId: userId || null,
      unit: unit || null
    };

    // Insert test alert
    const insert = await pool.query(
      `INSERT INTO alerts (category, message, severity, status, user_id, unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [testAlert.category, testAlert.message, testAlert.severity, testAlert.status, testAlert.userId, testAlert.unit]
    );
    const alert = insert.rows[0];

    // Build enhanced test push payload
    const push = {
      title: `🧪 TEST: ${type.toUpperCase()}`,
      body: message,
      data: {
        type: type,
        category: type,
        severity: 'medium',
        status: 'active',
        alertId: String(alert.id),
        isTest: true,
        timestamp: new Date().toISOString()
      }
    };

    let pushResult = null;
    let testResults = {};

    // Test different push scenarios
    try {
      if (userId) {
        console.log(`🧪 Testing push to specific user: ${userId}`);
        pushResult = await sendFirebaseNotification(userId, push);
        testResults.specificUser = pushResult;
      } else if (unit) {
        console.log(`🧪 Testing push to unit: ${unit}`);
        pushResult = await sendNotificationsByFilter({ unit, hasPushToken: true }, push);
        testResults.unitPush = pushResult;
      } else {
        console.log('🧪 Testing broadcast push');
        pushResult = await sendTopicNotification('alerts', push);
        testResults.broadcast = pushResult;
      }

      console.log('✅ Test push completed successfully');
      
      return res.status(200).json({
        success: true,
        message: 'Test push notification sent successfully',
        alert: alert,
        pushResult: pushResult,
        testResults: testResults,
        timestamp: new Date().toISOString()
      });

    } catch (pushErr) {
      console.error('❌ Test push failed:', pushErr.message);
      return res.status(500).json({
        success: false,
        message: 'Test push failed',
        error: pushErr.message,
        alert: alert,
        timestamp: new Date().toISOString()
      });
    }

  } catch (err) {
    console.error('❌ Error in test push:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/alerts/test-emergency - Test emergency notification
router.post('/test-emergency', async (req, res) => {
  const { severity = 'high', message = 'This is a test emergency alert' } = req.body;
  
  try {
    console.log('🚨 Testing emergency notification...');
    
    // Create emergency test alert
    const emergencyAlert = {
      category: 'emergency',
      message: message,
      severity: severity,
      status: 'active',
      userId: null,
      unit: null
    };

    // Insert emergency alert
    const insert = await pool.query(
      `INSERT INTO alerts (category, message, severity, status, user_id, unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [emergencyAlert.category, emergencyAlert.message, emergencyAlert.severity, emergencyAlert.status, emergencyAlert.userId, emergencyAlert.unit]
    );
    const alert = insert.rows[0];

    // Build emergency push payload
    const push = {
      title: `🚨 EMERGENCY: ${severity.toUpperCase()}`,
      body: message,
      data: {
        type: 'emergency',
        category: 'emergency',
        severity: severity,
        status: 'active',
        alertId: String(alert.id),
        requiresImmediateAction: severity === 'critical',
        sound: 'emergency',
        isTest: true,
        timestamp: new Date().toISOString()
      }
    };

    // Send to all commanders and supervisors
    const pushResult = await sendNotificationsByFilter({ 
      role: ['commander', 'supervisor'], 
      hasPushToken: true 
    }, push);

    console.log('✅ Emergency test completed successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Emergency test notification sent successfully',
      alert: alert,
      pushResult: pushResult,
      severity: severity,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Error in emergency test:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Note: Additional specialized alert routes can be implemented similarly, using the same schema

// PUT /api/alerts/:id/acknowledge - Acknowledge an alert (also pushes to creator or unit)
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

    const updated = result.rows[0];

    // Push notify: inform creator or unit subscribers that alert was acknowledged
    try {
      const push = {
        title: 'Alert Acknowledged',
        body: `Alert #${id} acknowledged`,
        data: { type: 'alert-ack', alertId: String(id) }
      };
      if (updated.user_id) {
        await sendFirebaseNotification(updated.user_id, push);
      } else if (updated.unit) {
        await sendNotificationsByFilter({ unit: updated.unit, hasPushToken: true }, push);
      }
    } catch (_) {}

    res.json(updated);
  } catch (err) {
    console.error('Error acknowledging alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/resolve - Resolve an alert (also pushes)
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

    const updated = result.rows[0];
    try {
      const push = {
        title: 'Alert Resolved',
        body: `Alert #${id} resolved`,
        data: { type: 'alert-resolve', alertId: String(id) }
      };
      if (updated.user_id) {
        await sendFirebaseNotification(updated.user_id, push);
      } else if (updated.unit) {
        await sendNotificationsByFilter({ unit: updated.unit, hasPushToken: true }, push);
      }
    } catch (_) {}

    res.json(updated);
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