const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const pool = require('./db');

// Import routes
const notificationsRouter = require('./routes/notifications');
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const zonesRouter = require('./routes/zones');
const alertsRouter = require('./routes/alerts');

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
  console.log('Incoming request:', req.method, req.url, req.body);
  next();
});

app.use('/api/notifications', notificationsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/alerts', alertsRouter);

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
          `UPDATE users SET latitude = $1, longitude = $2, heading = $3 WHERE id = $4`,
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