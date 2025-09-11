const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const pool = require('./db');
const { sendFirebaseNotification, sendNotificationsByFilter, sendTopicNotification } = require('./services/firebaseService');

// Import routes
const notificationsRouter = require('./routes/notifications');
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const zonesRouter = require('./routes/zones');
const unitsRouter = require('./routes/units');
const alertsRouter = require('./routes/alerts');
const assignmentsRouter = require('./routes/assignments');
const healthRouter = require('./routes/health');
const locationsRouter = require('./routes/locations');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://192.168.1.100:3000"], // Add your frontend URLs
    methods: ["GET", "POST"]
  }
});

// Server configuration for hosting environments
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000,http://192.168.1.100:3000";

// Middleware
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.method === 'POST' && req.url === '/api/users/register') {
    console.log('DEBUG: Received POST /api/users/register', req.body);
  }
  if (req.method === 'POST' && req.url === '/api/users/registration-requests') {
    console.log('DEBUG: Received POST /api/users/registration-requests', req.body);
  }
  console.log('Incoming request:', req.method, req.url, req.body);
  next();
});

// Quick base data endpoint for assignments (helps diagnose 404s on base path)
app.get('/api/assignments', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        assignment_id AS id,
        assignment_name AS title,
        brief_description AS description,
        LOWER(REPLACE(status, ' ', '_')) AS status,
        priority,
        created_at
      FROM public.assignments
      ORDER BY created_at DESC
      LIMIT 500
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/notifications', notificationsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/units', unitsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/health', healthRouter);
app.use('/api/locations', locationsRouter);
// Alias without /api in case of reverse proxy path rewrites
app.use('/assignments', assignmentsRouter);

app.get('/api/dbtest', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a test endpoint for connectivity
app.get('/api/ping', (req, res) => {
  res.json({ success: true, message: 'API is reachable' });
});

// Test notification endpoint using Expo push service
app.post('/api/test-expo', async (req, res) => {
  try {
    const message = {
      to: 'ExponentPushToken[QqVF_1GDZAsvhQL04Md7Vg]',
      sound: 'default',
      title: 'Test Notification',
      body: 'This is a test from your API'
    };
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });
    
    const result = await response.text();
    console.log('Expo push response:', result);
    res.json({ success: true, response: result });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Make io available to routes
app.set('io', io);

// Ensure users.photo column exists for profile image storage
(async () => {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT');
    console.log('Ensured users.photo column exists');
  } catch (err) {
    console.error('Failed to ensure users.photo column:', err.message);
  }
})();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('userLocationUpdate', async (data) => {
    const { user_id, latitude, longitude, heading } = data;
    try {
      // Fetch last known coordinates
      const userRes = await pool.query('SELECT latitude, longitude, heading, username, role FROM users WHERE id = $1', [user_id]);
      if (userRes.rows.length === 0) return; // User not found

      const user = userRes.rows[0];
      // If new coordinates are different
      if (
        user.latitude !== latitude ||
        user.longitude !== longitude ||
        user.heading !== heading
      ) {
        // Update users table with new location
        await pool.query(
          `UPDATE users SET latitude = $1, longitude = $2, heading = $3, last_active = CURRENT_TIMESTAMP WHERE id = $4`,
          [latitude, longitude, heading, user_id]
        );
      }
    } catch (err) {
      console.error('Error handling userLocationUpdate:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
   console.log(`Server running on http://localhost:${PORT}`);
}); 

// Enhanced PostgreSQL LISTEN/NOTIFY for alerts inserts with comprehensive error handling
(async () => {
  let client = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 5000; // 5 seconds

  const setupAlertsListener = async () => {
    try {
      // Close existing connection if any
      if (client) {
        try {
          await client.end();
        } catch (e) {
          console.warn('Error closing existing client:', e.message);
        }
      }

      // Create new client for LISTEN
      client = await pool.connect();
      
    // Ensure trigger and function exist to publish NOTIFY on inserts
    try {
        await client.query(`
        CREATE OR REPLACE FUNCTION notify_alerts_insert()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_notify('alerts_inserted', row_to_json(NEW)::text);
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'alerts_insert_trigger'
          ) THEN
            CREATE TRIGGER alerts_insert_trigger
            AFTER INSERT ON alerts
            FOR EACH ROW
            EXECUTE FUNCTION notify_alerts_insert();
          END IF;
        END$$;
      `);
        console.log('✅ Alerts insert trigger ensured');
    } catch (e) {
        console.warn('⚠️ Could not ensure alerts insert trigger:', e.message);
    }

      // Start listening
    await client.query('LISTEN alerts_inserted');
      console.log('🎧 Listening on channel alerts_inserted for new alerts');

      // Reset reconnect attempts on successful connection
      reconnectAttempts = 0;

      // Handle notifications
    client.on('notification', async (msg) => {
      if (msg.channel !== 'alerts_inserted') return;
        
      try {
          console.log('📨 Received alert notification:', msg.payload);
        const payload = JSON.parse(msg.payload || '{}');
          
          const { 
            id, 
            category, 
            message, 
            severity, 
            status, 
            user_id, 
            unit,
            created_at 
          } = payload;

          // Build push notification payload
        const push = {
            title: getAlertTitle(category, severity),
          body: message,
            data: { 
              type: category, 
              category, 
              severity, 
              status, 
              alertId: String(id),
              timestamp: created_at,
              requiresAction: severity === 'critical' || category === 'zone_breach'
            }
          };

          console.log(`🚀 Sending push notification for alert ${id} (${category})`);

          // Send push based on targeting logic
          let pushResult = null;
          try {
        if (user_id) {
              // Send to specific user
              pushResult = await sendFirebaseNotification(user_id, push);
              console.log(`✅ Alert ${id} sent to user ${user_id}`);
        } else if (unit) {
              // Send to all users in the unit
              pushResult = await sendNotificationsByFilter({ unit, hasPushToken: true }, push);
              console.log(`✅ Alert ${id} sent to unit ${unit}`);
        } else {
              // Broadcast to all commanders and supervisors
              pushResult = await sendNotificationsByFilter({ 
                role: ['commander', 'supervisor'], 
                hasPushToken: true 
              }, push);
              console.log(`✅ Alert ${id} broadcast to commanders/supervisors`);
            }
          } catch (pushError) {
            console.error(`❌ Failed to send push for alert ${id}:`, pushError.message);
            
            // Fallback: try topic notification
            try {
          await sendTopicNotification('alerts', push);
              console.log(`🔄 Alert ${id} sent via topic fallback`);
            } catch (topicError) {
              console.error(`❌ Topic fallback also failed for alert ${id}:`, topicError.message);
            }
          }

        } catch (err) {
          console.error('❌ Failed to handle alerts_inserted notification:', err.message);
        }
      });

      // Handle client errors
      client.on('error', (err) => {
        console.error('❌ Database client error:', err.message);
        scheduleReconnect();
      });

      // Handle client end
      client.on('end', () => {
        console.log('📴 Database client disconnected');
        scheduleReconnect();
      });

      } catch (err) {
      console.error('❌ Failed to setup alerts LISTEN:', err.message);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`🔄 Scheduling reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectDelay}ms`);
      setTimeout(setupAlertsListener, reconnectDelay);
    } else {
      console.error('❌ Max reconnect attempts reached. Alerts listener disabled.');
    }
  };

  // Helper function to generate alert titles
  const getAlertTitle = (category, severity) => {
    const emoji = {
      'emergency': '🚨',
      'zone_breach': '🚫',
      'assignment': '📋',
      'system': '⚙️'
    }[category] || '📢';

    const severityText = severity === 'critical' ? 'CRITICAL' : 
                        severity === 'high' ? 'HIGH' : 
                        severity === 'medium' ? 'MEDIUM' : 'LOW';

    return `${emoji} ${severityText} ${category.toUpperCase().replace('_', ' ')}`;
  };

  // Start the listener
  await setupAlertsListener();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down alerts listener...');
    if (client) {
      try {
        await client.end();
        console.log('✅ Database client closed');
      } catch (e) {
        console.error('❌ Error closing database client:', e.message);
      }
    }
    process.exit(0);
  });

})();