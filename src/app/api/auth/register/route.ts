import { NextRequest, NextResponse } from 'next/server';
import { registerSchema, AuthResponse, ApiError } from '@/types/auth';
import { hashPassword, generateToken, toPublicUser } from '@/lib/auth';
import { query } from '@/lib/database';
import { DatabaseUser } from '@/types/kanban';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input data
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUserResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [validatedData.email.toLowerCase()]
    );

    if (existingUserResult.rows.length > 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'User with this email already exists',
      };
      return NextResponse.json(errorResponse, { status: 409 });
    }

    // Hash the password
    const passwordHash = await hashPassword(validatedData.password);

    // Insert new user into database
    const insertResult = await query<DatabaseUser>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at, updated_at`,
      [validatedData.email.toLowerCase(), passwordHash]
    );

    const newUser = insertResult.rows[0];
    const publicUser = toPublicUser(newUser);

    // Generate JWT token
    const token = generateToken(publicUser);

    // Return success response
    const response: AuthResponse = {
      success: true,
      message: 'User registered successfully',
      user: publicUser,
      token,
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);

    // Handle validation errors
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      error.issues.forEach((err) => {
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

    // Handle database errors
    if (error instanceof Error && error.message.includes('duplicate key')) {
      const errorResponse: ApiError = {
        success: false,
        message: 'User with this email already exists',
      };
      return NextResponse.json(errorResponse, { status: 409 });
    }

    // Handle other errors
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
