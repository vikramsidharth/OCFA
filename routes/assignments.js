const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helpers
function normalizeStatusToApp(status) {
	if (!status) return null;
	const s = String(status).trim().toLowerCase();
	if (s === 'pending') return 'pending';
	if (s === 'in progress' || s === 'in_progress') return 'in_progress';
	if (s === 'completed' || s === 'complete') return 'completed';
	if (s === 'cancelled' || s === 'canceled') return 'cancelled';
	return s.replace(/\s+/g, '_');
}

function dbStatusFromApp(status) {
	if (!status) return null;
	switch (status) {
		case 'pending':
			return 'Pending';
		case 'in_progress':
			return 'In Progress';
		case 'completed':
			return 'Completed';
		case 'cancelled':
			return 'Cancelled';
		default:
			return status;
	}
}

// GET /api/assignments - list with filtering
router.get('/', async (req, res) => {
	const { status, priority, type, assignedCommander, sector, timeframe, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

	try {
		let query = `
			SELECT
				assignment_id AS id,
				assignment_name AS title,
				brief_description AS description,
				type,
				priority,
				sector,
				terrain,
				timeframe,
				assigned_commander,
				destination,
				pickup_point,
				geofence_setting,
				objectives,
				LOWER(REPLACE(status, ' ', '_')) AS status,
				created_at
			FROM assignments
			WHERE 1=1
		`;
		const params = [];
		let paramCount = 0;

		if (status) {
			paramCount++;
			query += ` AND LOWER(REPLACE(status, ' ', '_')) = LOWER(REPLACE($${paramCount}, ' ', '_'))`;
			params.push(status);
		}
		if (priority) {
			paramCount++;
			query += ` AND priority = $${paramCount}`;
			params.push(priority);
		}
		if (type) {
			paramCount++;
			query += ` AND type = $${paramCount}`;
			params.push(type);
		}
		if (assignedCommander) {
			paramCount++;
			query += ` AND assigned_commander = $${paramCount}`;
			params.push(assignedCommander);
		}
		if (sector) {
			paramCount++;
			query += ` AND sector = $${paramCount}`;
			params.push(sector);
		}
		if (timeframe) {
			paramCount++;
			query += ` AND timeframe = $${paramCount}`;
			params.push(timeframe);
		}

		const allowedSortFields = ['created_at', 'priority', 'status', 'assignment_name'];
		const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
		const order = (sortOrder || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

		const sortColumnMap = { title: 'assignment_name' };
		const finalSort = sortColumnMap[sortField] || sortField;

		paramCount++;
		query += ` ORDER BY ${finalSort} ${order} LIMIT $${paramCount}`;
		params.push(parseInt(limit));
		paramCount++;
		query += ` OFFSET $${paramCount}`;
		params.push(parseInt(offset));

		const result = await pool.query(query, params);
		res.json(result.rows);
	} catch (err) {
		console.error('Error fetching assignments:', err);
		res.status(500).json({ error: err.message });
	}
});

// GET /api/assignments/stats/overview
router.get('/stats/overview', async (req, res) => {
	try {
		const result = await pool.query(`
			SELECT
				COUNT(*) AS total,
				COUNT(CASE WHEN LOWER(REPLACE(status, ' ', '_')) = 'pending' THEN 1 END) AS pending,
				COUNT(CASE WHEN LOWER(REPLACE(status, ' ', '_')) = 'in_progress' THEN 1 END) AS in_progress,
				COUNT(CASE WHEN LOWER(REPLACE(status, ' ', '_')) = 'completed' THEN 1 END) AS completed,
				COUNT(CASE WHEN LOWER(REPLACE(status, ' ', '_')) = 'cancelled' THEN 1 END) AS cancelled
			FROM assignments
		`);
		res.json(result.rows[0] || { total: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 });
	} catch (err) {
		console.error('Error fetching assignment stats:', err);
		res.status(500).json({ error: err.message });
	}
});

// GET /api/assignments/:id
router.get('/:id', async (req, res) => {
	const { id } = req.params;
	try {
		const result = await pool.query(
			`SELECT
				assignment_id AS id,
				assignment_name AS title,
				brief_description AS description,
				type,
				priority,
				sector,
				terrain,
				timeframe,
				assigned_commander,
				destination,
				pickup_point,
				geofence_setting,
				objectives,
				LOWER(REPLACE(status, ' ', '_')) AS status,
				created_at
			FROM assignments
			WHERE assignment_id = $1`,
			[id]
		);
		if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
		res.json(result.rows[0]);
	} catch (err) {
		console.error('Error fetching assignment by id:', err);
		res.status(500).json({ error: err.message });
	}
});

// POST /api/assignments
router.post('/', async (req, res) => {
	const { assignment_name, brief_description, type, priority, sector, terrain, timeframe, assigned_commander, destination, pickup_point, geofence_setting, objectives, status } = req.body;
	if (!assignment_name) return res.status(400).json({ error: 'assignment_name is required' });
	try {
		const result = await pool.query(
			`INSERT INTO assignments (
				assignment_name, brief_description, type, priority, sector, terrain, timeframe, assigned_commander, destination, pickup_point, geofence_setting, objectives, status
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
			) RETURNING assignment_id AS id`,
			[
				assignment_name,
				brief_description || null,
				type || null,
				priority || null,
				sector || null,
				terrain || null,
				timeframe || null,
				assigned_commander || null,
				destination || null,
				pickup_point || null,
				geofence_setting || null,
				objectives || null,
				status ? dbStatusFromApp(status) : 'Pending'
			]
		);
		// Emit realtime event for new assignment
		try {
			const io = req.app.get('io');
			if (io) io.emit('assignmentCreated', { id: result.rows[0].id });
		} catch (e) {}

		res.status(201).json({ id: result.rows[0].id });
	} catch (err) {
		console.error('Error creating assignment:', err);
		res.status(500).json({ error: err.message });
	}
});

// PUT /api/assignments/:id
router.put('/:id', async (req, res) => {
	const { id } = req.params;
	const { assignment_name, brief_description, type, priority, sector, terrain, timeframe, assigned_commander, destination, pickup_point, geofence_setting, objectives, status } = req.body;
	try {
		const result = await pool.query(
			`UPDATE assignments SET
				assignment_name = COALESCE($1, assignment_name),
				brief_description = COALESCE($2, brief_description),
				type = COALESCE($3, type),
				priority = COALESCE($4, priority),
				sector = COALESCE($5, sector),
				terrain = COALESCE($6, terrain),
				timeframe = COALESCE($7, timeframe),
				assigned_commander = COALESCE($8, assigned_commander),
				destination = COALESCE($9, destination),
				pickup_point = COALESCE($10, pickup_point),
				geofence_setting = COALESCE($11, geofence_setting),
				objectives = COALESCE($12, objectives),
				status = COALESCE($13, status)
			WHERE assignment_id = $14
			RETURNING assignment_id AS id`,
			[
				assignment_name || null,
				brief_description || null,
				type || null,
				priority || null,
				sector || null,
				terrain || null,
				timeframe || null,
				assigned_commander || null,
				destination || null,
				pickup_point || null,
				geofence_setting || null,
				objectives || null,
				status ? dbStatusFromApp(status) : null,
				id
			]
		);
		if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

		// Emit realtime event for update
		try {
			const io = req.app.get('io');
			if (io) io.emit('assignmentUpdated', { id: result.rows[0].id });
		} catch (e) {}

		res.json({ id: result.rows[0].id });
	} catch (err) {
		console.error('Error updating assignment:', err);
		res.status(500).json({ error: err.message });
	}
});

// PATCH /api/assignments/:id/status
router.patch('/:id/status', async (req, res) => {
	const { id } = req.params;
	const { status } = req.body;
	if (!status) return res.status(400).json({ error: 'status is required' });
	try {
		const dbStatus = dbStatusFromApp(normalizeStatusToApp(status));
		const result = await pool.query(
			`UPDATE assignments SET status = $1 WHERE assignment_id = $2 RETURNING assignment_id AS id`,
			[dbStatus, id]
		);
		if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
		res.json({ id: result.rows[0].id, status: normalizeStatusToApp(dbStatus) });
	} catch (err) {
		console.error('Error updating assignment status:', err);
		res.status(500).json({ error: err.message });
	}
});

// DELETE /api/assignments/:id
router.delete('/:id', async (req, res) => {
	const { id } = req.params;
	try {
		const result = await pool.query(`DELETE FROM assignments WHERE assignment_id = $1 RETURNING assignment_id`, [id]);
		if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

		// Emit realtime event for delete
		try {
			const io = req.app.get('io');
			if (io) io.emit('assignmentDeleted', { id });
		} catch (e) {}

		res.json({ message: 'Assignment deleted successfully' });
	} catch (err) {
		console.error('Error deleting assignment:', err);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;