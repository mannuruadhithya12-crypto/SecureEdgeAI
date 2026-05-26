import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'secure_edge_jwt_secret_987654321';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secure_edge_jwt_refresh_secret_123456789';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Middleware to authenticate JWT access tokens
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(401).json({ error: 'Access token expired or invalid' });
    }
    req.user = user;
    next();
  });
}

/**
 * Generates an Access Token (short-lived, e.g., 15 minutes)
 */
export function generateAccessToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

/**
 * Generates a Refresh Token (long-lived, e.g., 7 days)
 */
export function generateRefreshToken(payload: any): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}
