const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendFirebaseNotification } = require('../services/firebaseService');

// GET /api/notifications - Get notifications for a user
router.get('/', async (req, res) => {
  const { userId, type, category, limit = 50, offset = 0 } = req.query;
  
  try {
    let query = 'SELECT * FROM notifications WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }

    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      params.push(type);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    query += ' ORDER BY sent_at DESC';
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/unread-count - Get unread count for a user
router.get('/unread-count/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    res.json({ unreadCount: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications - Create a new notification
router.post('/', async (req, res) => {
  const { 
    userId, 
    title, 
    message, 
    type, 
    category, 
    priority, 
    source, 
    data,
    sendPush = true 
  } = req.body;

  try {
    // Insert notification into database
    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, category, priority, source, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, title, message, type, category, priority, source, data]
    );

    const notification = result.rows[0];

    // Send push notification if requested
    if (sendPush) {
      try {
        await sendFirebaseNotification(userId, {
          title,
          body: message,
          data: {
            type,
            category,
            priority,
            notificationId: notification.id,
            ...data
          }
        });
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
        // Don't fail the request if push fails
      }
    }

    res.status(201).json(notification);
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/bulk - Send notifications to multiple users
router.post('/bulk', async (req, res) => {
  const { 
    userIds, 
    title, 
    message, 
    type, 
    category, 
    priority, 
    source, 
    data,
    sendPush = true 
  } = req.body;

  try {
    const notifications = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const userId of userIds) {
        const result = await client.query(
          `INSERT INTO notifications (user_id, title, message, type, category, priority, source, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [userId, title, message, type, category, priority, source, data]
        );
        notifications.push(result.rows[0]);
      }

      await client.query('COMMIT');

      // Send push notifications if requested
      if (sendPush) {
        for (const userId of userIds) {
          try {
            await sendFirebaseNotification(userId, {
              title,
              body: message,
              data: {
                type,
                category,
                priority,
                ...data
              }
            });
          } catch (pushError) {
            console.error(`Failed to send push notification to user ${userId}:`, pushError);
          }
        }
      }

      res.status(201).json({ 
        message: `Created ${notifications.length} notifications`,
        notifications 
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating bulk notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read-all - Mark all notifications as read for a user
router.put('/:userId/read-all', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING COUNT(*) as count',
      [userId]
    );

    res.json({ 
      message: `Marked ${result.rows[0].count} notifications as read`,
      count: parseInt(result.rows[0].count)
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:userId/clear-read - Clear all read notifications for a user
router.delete('/:userId/clear-read', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 AND is_read = true RETURNING COUNT(*) as count',
      [userId]
    );

    res.json({ 
      message: `Cleared ${result.rows[0].count} read notifications`,
      count: parseInt(result.rows[0].count)
    });
  } catch (err) {
    console.error('Error clearing read notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 