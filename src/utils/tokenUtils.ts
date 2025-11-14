import jwt from 'jsonwebtoken';
import { BlacklistedToken } from '../models/BlacklistedToken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'default_secret';

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  exp: number;
  iat: number;
}

/**
 * Decode JWT token without verification
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Get token expiration date
 */
export function getTokenExpiration(token: string): Date | null {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }
  return new Date(decoded.exp * 1000);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true;
  }
  return expiration < new Date();
}

/**
 * Blacklist a token
 */
export async function blacklistToken(token: string, userId: string): Promise<void> {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    throw new Error('Invalid token');
  }
  
  await BlacklistedToken.blacklistToken(token, userId, expiration);
}

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  return await BlacklistedToken.isBlacklisted(token);
}

/**
 * Clean expired tokens from blacklist
 */
export async function cleanExpiredTokens(): Promise<number> {
  const result = await BlacklistedToken.cleanExpiredTokens();
  return result.deletedCount || 0;
} 