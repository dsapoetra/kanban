import { z } from 'zod';

// Database User model
export interface User {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

// Public user data (without sensitive information)
export interface PublicUser {
  id: number;
  email: string;
  created_at: Date;
  updated_at: Date;
}

// JWT payload structure
export interface JWTPayload {
  userId: number;
  email: string;
  iat?: number; // issued at
  exp?: number; // expiration time
}

// Authentication response
export interface AuthResponse {
  success: boolean;
  message: string;
  user?: PublicUser;
  token?: string;
}

// Registration request validation schema
export const registerSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required')
    .max(255, 'Email must be less than 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password must be less than 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Login request validation schema
export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z
    .string()
    .min(1, 'Password is required')
});

// Type inference from schemas
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;

// API error response
export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}
