const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/units
// Optional query params:
//   q: substring to filter by name (case-insensitive)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  try {
    let result;
    if (q && String(q).trim() !== '') {
      result = await pool.query(
        `SELECT id, name
         FROM public.units
         WHERE LOWER(name) LIKE LOWER($1)
         ORDER BY name ASC`,
        [`%${q}%`]
      );
    } else {
      result = await pool.query(
        `SELECT id, name
         FROM public.units
         ORDER BY name ASC`
      );
    }
    return res.json(result.rows || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;


