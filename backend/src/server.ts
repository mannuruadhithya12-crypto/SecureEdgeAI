import express from 'express';
import rateLimit from 'express-rate-limit';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { initDb, executeQuery } from './db/postgres';
import { generateAccessToken, generateRefreshToken, JWT_REFRESH_SECRET } from './middleware/auth';
import attendanceRouter from './routes/attendance';
import usersRouter from './routes/users';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'secure_edge_client_secret_xyz';

app.use(express.json());

// 1. API Rate Limiting (CHANGE-9)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  message: { error: 'Too many sync requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Stricter limit on auth calls (max 30 per 15 mins)
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/attendance', apiLimiter);
app.use('/users', apiLimiter);
app.use('/auth', authLimiter);

/**
 * GET /health - Service health monitoring check (CHANGE-17)
 */
app.get('/health', async (req, res) => {
  try {
    // Check DB status
    let dbStatus = 'CONNECTED';
    let logsCount = 0;
    try {
      const result = await executeQuery('SELECT COUNT(*) as count FROM attendance_logs;');
      if (result && result.length > 0) {
        logsCount = parseInt(result[0].count || result[0].count_rows || '0', 10);
      }
    } catch (dbErr) {
      dbStatus = 'DISCONNECTED';
    }

    return res.status(200).json({
      status: 'UP',
      database: dbStatus,
      processedLogsCount: logsCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'DOWN',
      error: error.message || 'Health check encountered unexpected error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /auth/login - Client credentials authentication to obtain JWT (CHANGE-5, CHANGE-6)
 */
app.post('/auth/login', (req, res) => {
  const { clientId, clientSecret } = req.body;

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Missing clientId or clientSecret' });
  }

  // Validate credentials
  if (clientSecret !== CLIENT_SECRET) {
    return res.status(401).json({ error: 'Invalid client credentials' });
  }

  const payload = { clientId, role: 'mobile_device' };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return res.status(200).json({
    accessToken,
    refreshToken,
    expiresIn: 900 // 15 minutes (in seconds)
  });
});

/**
 * POST /auth/refresh - Rotate JWT access and refresh tokens (CHANGE-5)
 */
app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(401).json({ error: 'Refresh token expired or invalid' });
    }

    const payload = { clientId: decoded.clientId, role: decoded.role };
    
    // Rotate tokens (issue new access token AND a new refresh token)
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    });
  });
});

// Bind Route Routers
app.use('/attendance', attendanceRouter);
app.use('/users', usersRouter);

// Server startup sequence
app.listen(PORT, async () => {
  console.log(`[Server] Express secure edge server listening on port ${PORT}`);
  await initDb();
});
