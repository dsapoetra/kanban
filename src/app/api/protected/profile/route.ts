import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { toPublicUser } from '@/lib/auth';
import { ApiError } from '@/types/auth';

export async function GET(request: NextRequest) {
  try {
    // Get user ID from middleware-set headers
    const userId = request.headers.get('x-user-id');
    const userEmail = request.headers.get('x-user-email');

    if (!userId || !userEmail) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Unauthorized - Invalid token',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Fetch user data from database
    const userResult = await query(
      'SELECT id, email, created_at, updated_at FROM users WHERE id = $1',
      [parseInt(userId)]
    );

    if (userResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'User not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const user = userResult.rows[0];
    const publicUser = toPublicUser(user);

    return NextResponse.json({
      success: true,
      message: 'Profile retrieved successfully',
      user: publicUser,
    });

  } catch (error) {
    console.error('Profile API error:', error);
    
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
