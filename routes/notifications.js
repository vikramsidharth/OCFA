const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/notifications
router.get('/', async (req, res) => {
  const { unit, level } = req.query;
  try {
    let query = 'SELECT * FROM notifications';
    let params = [];
    if (unit && level) {
      query += ' WHERE unit = $1 AND level = $2';
      params = [unit, level];
    } else if (unit) {
      query += ' WHERE unit = $1';
      params = [unit];
    } else if (level) {
      query += ' WHERE level = $1';
      params = [level];
    }
    query += ' ORDER BY timestamp DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 