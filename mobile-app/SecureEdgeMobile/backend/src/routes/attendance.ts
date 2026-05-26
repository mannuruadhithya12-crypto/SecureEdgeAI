import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { executeQuery } from '../db/postgres';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const router = Router();
const HMAC_SECRET = process.env.HMAC_SECRET || 'secure_edge_hmac_secret_4567890';

// Verification middleware for HMAC request signature (CHANGE-8)
function verifyHmacSignature(req: AuthenticatedRequest, res: Response, next: any) {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;

  if (!signature || !timestamp) {
    return res.status(400).json({ error: 'Missing security signature or timestamp headers' });
  }

  // 1. Replay attack check: assert timestamp is within 5 minutes
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return res.status(403).json({ error: 'Request rejected due to potential replay attack (skewed timestamp)' });
  }

  // 2. Compute expected HMAC: HMAC-SHA256(payload + timestamp)
  // Ensure the body is stringified consistently
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(payload + timestamp);
  const expectedSignature = hmac.digest('hex');

  if (signature !== expectedSignature) {
    return res.status(403).json({ error: 'Request rejected due to invalid security signature (tampering detected)' });
  }

  next();
}

/**
 * POST /attendance - Upload single attendance log (CHANGE-8, CHANGE-10)
 */
router.post('/', authenticateToken, verifyHmacSignature, async (req: AuthenticatedRequest, res: Response) => {
  const { userId, userName, timestamp, verificationScore } = req.body;

  if (!userId || !userName || !timestamp || verificationScore === undefined) {
    return res.status(400).json({ error: 'Missing required attendance fields' });
  }

  try {
    // Generate payload hash to prevent duplicates (CHANGE-5 backend constraint)
    const payloadStr = JSON.stringify({ userId, userName, timestamp, verificationScore });
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    // Insert Log wrapped in postgres query
    await executeQuery(
      'INSERT INTO attendance_logs (user_id, user_name, timestamp, verification_score, payload_hash) VALUES ($1, $2, $3, $4, $5);',
      [userId, userName, new Date(timestamp), parseFloat(verificationScore), payloadHash]
    );

    // Insert Sync Event
    await executeQuery(
      'INSERT INTO sync_events (event_type, description) VALUES ($1, $2);',
      ['ATTENDANCE_SYNC', `Synced attendance log for user ${userName}`]
    );

    return res.status(200).json({ success: true, confirmationId: payloadHash });
  } catch (error: any) {
    if (error.message && (error.message.includes('unique constraint') || error.message.includes('Duplicate key'))) {
      // Duplicate prevention (CHANGE-5, retry-safe APIs)
      return res.status(200).json({ success: true, message: 'Duplicate record ignored', duplicate: true });
    }
    console.error('[AttendanceRoute] Insert failed:', error);
    return res.status(500).json({ error: 'Database write failure' });
  }
});

/**
 * POST /attendance/sync - Sync bulk queue items
 */
router.post('/sync', authenticateToken, verifyHmacSignature, async (req: AuthenticatedRequest, res: Response) => {
  const records = req.body.records;

  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Invalid sync payload: records must be an array' });
  }

  const results: any[] = [];

  for (const record of records) {
    const { userId, userName, timestamp, verificationScore } = record;
    if (!userId || !userName || !timestamp || verificationScore === undefined) {
      results.push({ id: record.id, success: false, error: 'Malformed record' });
      continue;
    }

    try {
      const payloadStr = JSON.stringify({ userId, userName, timestamp, verificationScore });
      const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

      await executeQuery(
        'INSERT INTO attendance_logs (user_id, user_name, timestamp, verification_score, payload_hash) VALUES ($1, $2, $3, $4, $5);',
        [userId, userName, new Date(timestamp), parseFloat(verificationScore), payloadHash]
      );

      results.push({ id: record.id, success: true, confirmationId: payloadHash });
    } catch (error: any) {
      // Duplicate check
      if (error.message && (error.message.includes('unique constraint') || error.message.includes('Duplicate key'))) {
        results.push({ id: record.id, success: true, message: 'Duplicate ignored' });
      } else {
        results.push({ id: record.id, success: false, error: 'Database write failure' });
      }
    }
  }

  // Insert Sync Event
  await executeQuery(
    'INSERT INTO sync_events (event_type, description) VALUES ($1, $2);',
    ['BULK_SYNC', `Processed bulk sync of ${records.length} records`]
  );

  return res.status(200).json({ success: true, results });
});

export default router;
