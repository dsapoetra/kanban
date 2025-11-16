import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { 
  updateBoardSchema, 
  ApiResponse, 
  ApiError, 
  BoardWithMembers 
} from '@/types/kanban';
import { ZodError } from 'zod';

// Helper function to check if user has access to board
async function checkBoardAccess(boardId: number, userId: number, requiredRole?: string) {
  const result = await query(`
    SELECT b.*, bm.role, u.email as owner_email
    FROM boards b
    LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = $2
    JOIN users u ON b.owner_id = u.id
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

// GET /api/boards/[boardId] - Get board details with members and columns (fixed for Next.js 15)
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

    // Get board with members and columns
    const [membersResult, columnsResult] = await Promise.all([
      query(`
        SELECT bm.id, bm.board_id, bm.user_id, bm.role, bm.joined_at, u.email
        FROM board_members bm
        JOIN users u ON bm.user_id = u.id
        WHERE bm.board_id = $1
        UNION
        SELECT NULL as id, $1 as board_id, u.id as user_id, 'admin' as role,
               u.created_at as joined_at, u.email
        FROM users u
        WHERE u.id = (SELECT owner_id FROM boards WHERE id = $1)
        ORDER BY joined_at ASC
      `, [boardId]),
      query(`
        SELECT * FROM columns 
        WHERE board_id = $1 
        ORDER BY position ASC
      `, [boardId])
    ]);

    const boardWithDetails: BoardWithMembers = {
      ...access.board,
      owner: { id: access.board.owner_id, email: access.board.owner_email },
      members: membersResult.rows.map(row => ({
        id: row.id,
        board_id: row.board_id,
        user_id: row.user_id,
        role: row.role,
        joined_at: row.joined_at,
        user: { id: row.user_id, email: row.email }
      })),
      columns: columnsResult.rows
    };

    const response: ApiResponse<BoardWithMembers> = {
      success: true,
      message: 'Board retrieved successfully',
      data: boardWithDetails,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching board:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// PUT /api/boards/[boardId] - Update board details
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
    const validatedData = updateBoardSchema.parse(body);

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (validatedData.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      updateValues.push(validatedData.name);
    }

    if (validatedData.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      updateValues.push(validatedData.description);
    }

    if (updateFields.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'No fields to update',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    updateValues.push(boardId);
    const updateQuery = `
      UPDATE boards 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);

    const response: ApiResponse = {
      success: true,
      message: 'Board updated successfully',
      data: result.rows[0],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error updating board:', error);
    
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

// DELETE /api/boards/[boardId] - Delete board
export async function DELETE(
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

    // Delete board (cascade will handle related records)
    await query('DELETE FROM boards WHERE id = $1', [boardId]);

    const response: ApiResponse = {
      success: true,
      message: 'Board deleted successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error deleting board:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
