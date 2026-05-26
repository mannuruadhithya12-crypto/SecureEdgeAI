import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

let useFallback = false;
let pool: Pool | null = null;

// Fallback in-memory database storage (CHANGE-10 indexes simulated by array searches)
const fallbackDb = {
  users: [] as any[],
  attendance_logs: [] as any[],
  sync_events: [] as any[],
};

// Initialize PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;

try {
  if (connectionString) {
    pool = new Pool({ connectionString });
  } else {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'secure_edge_db',
      connectionTimeoutMillis: 2000, // Fail fast if Postgres is down
    });
  }
} catch (e) {
  console.warn('[Database] Database pool construction failed, fallback active');
  useFallback = true;
}

export async function initDb(): Promise<void> {
  if (useFallback || !pool) return;
  try {
    // Test connection
    const client = await pool.connect();
    client.release();
    console.log('[Database] PostgreSQL connection verified');
    
    // Create Tables (CHANGE-10)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        verification_score NUMERIC(5, 4) NOT NULL,
        payload_hash VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        description TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Indexes for search optimization (CHANGE-10)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_payload_hash ON attendance_logs(payload_hash);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_id ON attendance_logs(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_timestamp ON attendance_logs(timestamp);');
    
    console.log('[Database] Database tables and indexes verified successfully');
  } catch (error) {
    console.warn('[Database] PostgreSQL service connection failed. Falling back to memory-adapter.');
    useFallback = true;
  }
}

export async function executeQuery(text: string, params: any[] = []): Promise<any> {
  if (useFallback || !pool) {
    return executeFallbackQuery(text, params);
  }
  try {
    const res = await pool.query(text, params);
    return res.rows;
  } catch (err) {
    console.error('[Database] Query execution error:', err);
    throw err;
  }
}

// Simulated SQL queries for in-memory testing/fallback
function executeFallbackQuery(sql: string, params: any[]): any {
  const normalizedSql = sql.trim().replace(/\s+/g, ' ').toLowerCase();

  if (normalizedSql.includes('insert into users')) {
    const name = params[0];
    const existing = fallbackDb.users.find(u => u.name === name);
    if (existing) {
      return [existing];
    }
    const newUser = { id: fallbackDb.users.length + 1, name, created_at: new Date() };
    fallbackDb.users.push(newUser);
    return [newUser];
  }

  if (normalizedSql.includes('select') && normalizedSql.includes('from users')) {
    return fallbackDb.users;
  }

  if (normalizedSql.includes('insert into attendance_logs')) {
    const [userId, userName, timestamp, score, hash] = params;
    const existing = fallbackDb.attendance_logs.find(a => a.payload_hash === hash);
    if (existing) {
      throw new Error('Duplicate key violation: payload_hash UNIQUE constraint failed');
    }
    const newLog = {
      id: fallbackDb.attendance_logs.length + 1,
      user_id: userId,
      user_name: userName,
      timestamp,
      verification_score: score,
      payload_hash: hash,
      created_at: new Date()
    };
    fallbackDb.attendance_logs.push(newLog);
    return [newLog];
  }

  if (normalizedSql.includes('insert into sync_events')) {
    const [eventType, description] = params;
    const newEvent = {
      id: fallbackDb.sync_events.length + 1,
      event_type: eventType,
      description,
      timestamp: new Date()
    };
    fallbackDb.sync_events.push(newEvent);
    return [newEvent];
  }

  if (normalizedSql.includes('select') && normalizedSql.includes('from attendance_logs')) {
    return fallbackDb.attendance_logs;
  }

  return [];
}
