const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Alerts" ORDER BY "timestamp" DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 