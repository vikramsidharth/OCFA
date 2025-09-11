const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/locations?userId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const params = [start.toISOString(), end.toISOString()];
    let sql = `
      SELECT 
        latitude::float8 AS latitude,
        longitude::float8 AS longitude,
        COALESCE(timestamp, created_at, updated_at) AS timestamp
      FROM locations
      WHERE (COALESCE(timestamp, created_at, updated_at) BETWEEN $1 AND $2)
    `;

    if (userId) {
      sql += ' AND user_id = $3';
      params.push(userId);
    }

    sql += ' ORDER BY COALESCE(timestamp, created_at, updated_at) ASC LIMIT 5000';

    const { rows } = await pool.query(sql, params);
    const normalized = rows.map(r => ({
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      timestamp: r.timestamp,
    })).filter(p => isFinite(p.latitude) && isFinite(p.longitude));

    return res.json(normalized);
  } catch (err) {
    console.error('GET /api/locations error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


