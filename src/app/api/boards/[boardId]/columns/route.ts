import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { 
  createColumnSchema, 
  ApiResponse, 
  ApiError,
  Column 
} from '@/types/kanban';
import { ZodError } from 'zod';

// Helper function to check if user has access to board
async function checkBoardAccess(boardId: number, userId: number, requiredRole?: string) {
  const result = await query(`
    SELECT b.*, bm.role
    FROM boards b
    LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = $2
    WHERE b.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)
  `, [boardId, userId]);

  if (result.rows.length === 0) {
    return null;
  }

  const board = result.rows[0];
  const userRole = board.owner_id === userId ? 'admin' : board.role;

  if (requiredRole && requiredRole === 'admin' && userRole !== 'admin') {
    return null;
  }

  return { board, userRole };
}

// GET /api/boards/[boardId]/columns - Get all columns for a board
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdParam } = await params;
    const boardId = parseInt(boardIdParam);
    
    if (!userId || isNaN(boardId)) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid request parameters',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const access = await checkBoardAccess(boardId, parseInt(userId));
    if (!access) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or access denied',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Get columns ordered by position
    const columnsResult = await query(`
      SELECT * FROM columns 
      WHERE board_id = $1 
      ORDER BY position ASC
    `, [boardId]);

    const response: ApiResponse<Column[]> = {
      success: true,
      message: 'Columns retrieved successfully',
      data: columnsResult.rows,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching columns:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST /api/boards/[boardId]/columns - Create a new column
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdParam } = await params;
    const boardId = parseInt(boardIdParam);
    
    if (!userId || isNaN(boardId)) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid request parameters',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const access = await checkBoardAccess(boardId, parseInt(userId), 'admin');
    if (!access) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or insufficient permissions',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createColumnSchema.parse(body);

    // Create column in a transaction to handle position adjustments
    const result = await transaction(async (client) => {
      // Shift existing columns to make room for new column
      await client.query(`
        UPDATE columns 
        SET position = position + 1 
        WHERE board_id = $1 AND position >= $2
      `, [boardId, validatedData.position]);

      // Insert new column
      const columnResult = await client.query(`
        INSERT INTO columns (board_id, name, position, color)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [boardId, validatedData.name, validatedData.position, validatedData.color || '#6B7280']);

      return columnResult.rows[0];
    });

    const response: ApiResponse<Column> = {
      success: true,
      message: 'Column created successfully',
      data: result,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating column:', error);
    
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

// PUT /api/boards/[boardId]/columns - Reorder columns
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdParam } = await params;
    const boardId = parseInt(boardIdParam);
    
    if (!userId || isNaN(boardId)) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid request parameters',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const access = await checkBoardAccess(boardId, parseInt(userId), 'admin');
    if (!access) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or insufficient permissions',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const body = await request.json();
    const { columnOrder } = body; // Array of column IDs in new order

    if (!Array.isArray(columnOrder)) {
      const errorResponse: ApiError = {
        success: false,
        message: 'columnOrder must be an array of column IDs',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Update column positions in a transaction
    await transaction(async (client) => {
      for (let i = 0; i < columnOrder.length; i++) {
        await client.query(`
          UPDATE columns 
          SET position = $1 
          WHERE id = $2 AND board_id = $3
        `, [i, columnOrder[i], boardId]);
      }
    });

    const response: ApiResponse = {
      success: true,
      message: 'Columns reordered successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error reordering columns:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
