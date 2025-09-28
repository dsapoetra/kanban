import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWTPayload, PublicUser } from '@/types/auth';

// Get JWT secret from environment variables
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: PublicUser): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: '7d', // Token expires in 7 days
    issuer: 'kanban-app',
    audience: 'kanban-users',
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJWTSecret(), {
      issuer: 'kanban-app',
      audience: 'kanban-users',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Generate a secure random string for JWT secret
 * This is a utility function for generating secrets during development
 */
export function generateJWTSecret(): string {
  return require('crypto').randomBytes(64).toString('hex');
}

/**
 * Convert database user to public user (remove sensitive data)
 */
export function toPublicUser(user: any): PublicUser {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
