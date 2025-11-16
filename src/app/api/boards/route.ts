import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import {
  createBoardSchema,
  ApiResponse,
  ApiError,
  Board
} from '@/types/kanban';
import { ZodError } from 'zod';

// GET /api/boards - Get all boards for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Unauthorized - Invalid token',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Get boards where user is owner or member
    const boardsResult = await query(`
      SELECT DISTINCT 
        b.id, b.name, b.description, b.owner_id, b.created_at, b.updated_at,
        u.email as owner_email
      FROM boards b
      JOIN users u ON b.owner_id = u.id
      LEFT JOIN board_members bm ON b.id = bm.board_id
      WHERE b.owner_id = $1 OR bm.user_id = $1
      ORDER BY b.updated_at DESC
    `, [parseInt(userId)]);

    const boards = boardsResult.rows.map(row => ({
      ...row,
      owner: { id: row.owner_id, email: row.owner_email }
    }));

    const response: ApiResponse<typeof boards> = {
      success: true,
      message: 'Boards retrieved successfully',
      data: boards,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching boards:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST /api/boards - Create a new board
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Unauthorized - Invalid token',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createBoardSchema.parse(body);

    // Create board and default columns in a transaction
    const result = await transaction(async (client) => {
      // Create the board
      const boardResult = await client.query(
        'INSERT INTO boards (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
        [validatedData.name, validatedData.description || null, parseInt(userId)]
      );

      const board = boardResult.rows[0];

      // Create columns (custom or default)
      const columnsToCreate = validatedData.columns || [
        { name: 'To Do', position: 0, color: '#6B7280' },
        { name: 'In Progress', position: 1, color: '#3B82F6' },
        { name: 'Testing', position: 2, color: '#F59E0B' },
        { name: 'Done', position: 3, color: '#10B981' },
      ];

      for (const column of columnsToCreate) {
        await client.query(
          'INSERT INTO columns (board_id, name, position, color) VALUES ($1, $2, $3, $4)',
          [board.id, column.name, column.position, column.color || '#6B7280']
        );
      }

      return board;
    });

    const response: ApiResponse<Board> = {
      success: true,
      message: 'Board created successfully',
      data: result,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating board:', error);
    
    if (error instanceof ZodError) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Validation failed',
        errors: error.flatten().fieldErrors,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
