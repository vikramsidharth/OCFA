const express = require('express');
const router = express.Router();
const db = require('../db');

// Create a new geofence (zone)
router.post('/', async (req, res) => {
  try {
    const { coordinates, center } = req.body;
    if (!coordinates || coordinates.length < 3 || !center) {
      return res.status(400).json({ error: 'Invalid zone data' });
    }
    // Insert into geofences table
    const result = await db.query(
      `INSERT INTO geofences (points, center_latitude, center_longitude)
       VALUES ($1, $2, $3) RETURNING *`,
      [JSON.stringify(coordinates), center.latitude, center.longitude]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating geofence:', err);
    res.status(500).json({ error: 'Failed to create geofence' });
  }
});

// List all geofences (zones)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, center_lat, center_lng, points, type, level, unit_name FROM geofences WHERE allowed = true');
    // Format the geofences for frontend
    const geofences = result.rows.map(gf => {
      let coords;
      try {
        coords = Array.isArray(gf.points) ? gf.points : JSON.parse(gf.points || '[]');
      } catch (e) {
        coords = [];
      }
      return {
        id: gf.id,
        name: gf.name,
        center: {
          latitude: parseFloat(gf.center_lat),
          longitude: parseFloat(gf.center_lng),
        },
        coordinates: coords,
        type: gf.type,
        level: gf.level,
        unit_name: gf.unit_name,
      };
    });
    res.json(geofences);
  } catch (err) {
    console.error('Error fetching geofences:', err);
    res.status(500).json({ error: 'Failed to fetch geofences' });
  }
});

module.exports = router; 