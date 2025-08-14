const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/reports
router.get('/', async (req, res) => {
  try {
    // Status reports from asset_vitals
    const statusResult = await pool.query(`
      SELECT 
        av.asset_vitalspkid AS id,
        'status' AS type,
        av.asset_pkid AS assetId,
        u."SoldierName" AS name,
        av.assetvital_status AS status,
        av.heart_rate AS battery,
        av."timestamp" AS lastUpdate,
        NULL AS location
      FROM asset_vitals av
      LEFT JOIN "UserRegistration" u ON av.asset_pkid = u."SoldierPKID"
    `);

    // History reports from event_logs
    const historyResult = await pool.query(`
      SELECT 
        el.event_logspkid AS id,
        'history' AS type,
        el.asset_pkid AS assetId,
        u."SoldierName" AS name,
        NULL AS status,
        NULL AS battery,
        NULL AS lastUpdate,
        NULL AS location,
        el.event_type AS event,
        el.description AS details,
        el."timestamp" AS timestamp
      FROM event_logs el
      LEFT JOIN "UserRegistration" u ON el.asset_pkid = u."SoldierPKID"
    `);

    // Combine and send
    const reports = [...statusResult.rows, ...historyResult.rows];
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 