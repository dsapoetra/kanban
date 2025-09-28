import { NextRequest, NextResponse } from 'next/server';
import { loginSchema, AuthResponse, ApiError, User } from '@/types/auth';
import { verifyPassword, generateToken, toPublicUser } from '@/lib/auth';
import { query } from '@/lib/database';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input data
    const validatedData = loginSchema.parse(body);

    // Find user by email
    const userResult = await query<User>(
      'SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = $1',
      [validatedData.email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid email or password',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const user = userResult.rows[0];

    // Verify password
    const isPasswordValid = await verifyPassword(validatedData.password, user.password_hash);

    if (!isPasswordValid) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid email or password',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Convert to public user (remove sensitive data)
    const publicUser = toPublicUser(user);

    // Generate JWT token
    const token = generateToken(publicUser);

    // Return success response
    const response: AuthResponse = {
      success: true,
      message: 'Login successful',
      user: publicUser,
      token,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);

    // Handle validation errors
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const field = err.path.join('.');
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(err.message);
      });

      const errorResponse: ApiError = {
        success: false,
        message: 'Validation failed',
        errors: fieldErrors,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Handle other errors
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
