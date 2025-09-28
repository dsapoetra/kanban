import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { 
  updateColumnSchema, 
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

// GET /api/boards/[boardId]/columns/[columnId] - Get column details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdParam, columnId: columnIdParam } = await params;
    const boardId = parseInt(boardIdParam);
    const columnId = parseInt(columnIdParam);
    
    if (!userId || isNaN(boardId) || isNaN(columnId)) {
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

    // Get column details
    const columnResult = await query(`
      SELECT * FROM columns 
      WHERE id = $1 AND board_id = $2
    `, [columnId, boardId]);

    if (columnResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Column not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const response: ApiResponse<Column> = {
      success: true,
      message: 'Column retrieved successfully',
      data: columnResult.rows[0],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching column:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// PUT /api/boards/[boardId]/columns/[columnId] - Update column
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdParam, columnId: columnIdParam } = await params;
    const boardId = parseInt(boardIdParam);
    const columnId = parseInt(columnIdParam);
    
    if (!userId || isNaN(boardId) || isNaN(columnId)) {
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
    const validatedData = updateColumnSchema.parse(body);

    // Check if column exists
    const existingColumnResult = await query(`
      SELECT * FROM columns 
      WHERE id = $1 AND board_id = $2
    `, [columnId, boardId]);

    if (existingColumnResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Column not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const existingColumn = existingColumnResult.rows[0];

    // Handle position change if needed
    let result;
    if (validatedData.position !== undefined && validatedData.position !== existingColumn.position) {
      result = await transaction(async (client) => {
        const oldPosition = existingColumn.position;
        const newPosition = validatedData.position!;

        if (newPosition > oldPosition) {
          // Moving right - shift columns left
          await client.query(`
            UPDATE columns 
            SET position = position - 1 
            WHERE board_id = $1 AND position > $2 AND position <= $3
          `, [boardId, oldPosition, newPosition]);
        } else {
          // Moving left - shift columns right
          await client.query(`
            UPDATE columns 
            SET position = position + 1 
            WHERE board_id = $1 AND position >= $2 AND position < $3
          `, [boardId, newPosition, oldPosition]);
        }

        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (validatedData.name !== undefined) {
          updateFields.push(`name = $${paramCount++}`);
          updateValues.push(validatedData.name);
        }

        if (validatedData.color !== undefined) {
          updateFields.push(`color = $${paramCount++}`);
          updateValues.push(validatedData.color);
        }

        updateFields.push(`position = $${paramCount++}`);
        updateValues.push(newPosition);

        updateValues.push(columnId);
        updateValues.push(boardId);

        const updateQuery = `
          UPDATE columns 
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount++} AND board_id = $${paramCount}
          RETURNING *
        `;

        const updateResult = await client.query(updateQuery, updateValues);
        return updateResult.rows[0];
      });
    } else {
      // Simple update without position change
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (validatedData.name !== undefined) {
        updateFields.push(`name = $${paramCount++}`);
        updateValues.push(validatedData.name);
      }

      if (validatedData.color !== undefined) {
        updateFields.push(`color = $${paramCount++}`);
        updateValues.push(validatedData.color);
      }

      if (updateFields.length === 0) {
        const errorResponse: ApiError = {
          success: false,
          message: 'No fields to update',
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      updateValues.push(columnId);
      updateValues.push(boardId);

      const updateQuery = `
        UPDATE columns 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount++} AND board_id = $${paramCount}
        RETURNING *
      `;

      const updateResult = await query(updateQuery, updateValues);
      result = updateResult.rows[0];
    }

    const response: ApiResponse<Column> = {
      success: true,
      message: 'Column updated successfully',
      data: result,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error updating column:', error);
    
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

// DELETE /api/boards/[boardId]/columns/[columnId] - Delete column
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdParam, columnId: columnIdParam } = await params;
    const boardId = parseInt(boardIdParam);
    const columnId = parseInt(columnIdParam);
    
    if (!userId || isNaN(boardId) || isNaN(columnId)) {
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

    // Check if column exists and get its position
    const columnResult = await query(`
      SELECT * FROM columns 
      WHERE id = $1 AND board_id = $2
    `, [columnId, boardId]);

    if (columnResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Column not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const column = columnResult.rows[0];

    // Check if column has tasks
    const tasksResult = await query(`
      SELECT COUNT(*) as task_count FROM tasks 
      WHERE column_id = $1
    `, [columnId]);

    const taskCount = parseInt(tasksResult.rows[0].task_count);

    if (taskCount > 0) {
      const errorResponse: ApiError = {
        success: false,
        message: `Cannot delete column with ${taskCount} task(s). Move or delete tasks first.`,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Delete column and adjust positions
    await transaction(async (client) => {
      // Delete the column
      await client.query('DELETE FROM columns WHERE id = $1', [columnId]);

      // Shift remaining columns left
      await client.query(`
        UPDATE columns 
        SET position = position - 1 
        WHERE board_id = $1 AND position > $2
      `, [boardId, column.position]);
    });

    const response: ApiResponse = {
      success: true,
      message: 'Column deleted successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error deleting column:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
