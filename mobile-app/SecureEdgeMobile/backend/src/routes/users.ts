import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { executeQuery } from '../db/postgres';

const router = Router();

/**
 * GET /users - Get all registered users (CHANGE-10)
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await executeQuery('SELECT * FROM users ORDER BY name ASC;');
    return res.status(200).json(users);
  } catch (error) {
    console.error('[UsersRoute] Get users failed:', error);
    return res.status(500).json({ error: 'Database read failure' });
  }
});

/**
 * POST /users - Register a new user on the server (CHANGE-10)
 */
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const result = await executeQuery(
      'INSERT INTO users (name) VALUES ($1) RETURNING *;',
      [name.trim()]
    );
    
    // Log Sync Event
    await executeQuery(
      'INSERT INTO sync_events (event_type, description) VALUES ($1, $2);',
      ['USER_REGISTRATION', `Registered user profile: ${name}`]
    );

    return res.status(201).json({ success: true, user: result[0] });
  } catch (error: any) {
    if (error.message && (error.message.includes('unique constraint') || error.message.includes('Duplicate key'))) {
      // User already exists, return existing user
      try {
        const existing = await executeQuery('SELECT * FROM users WHERE name = $1;', [name.trim()]);
        return res.status(200).json({ success: true, user: existing[0], message: 'User already exists' });
      } catch (innerErr) {
        return res.status(500).json({ error: 'Database query failure' });
      }
    }
    console.error('[UsersRoute] Registration failed:', error);
    return res.status(500).json({ error: 'Database write failure' });
  }
});

export default router;
