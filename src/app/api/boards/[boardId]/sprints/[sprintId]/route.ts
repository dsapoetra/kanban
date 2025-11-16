import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { 
  updateSprintSchema, 
  ApiResponse, 
  ApiError,
  SprintWithTasks 
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

// GET /api/boards/[boardId]/sprints/[sprintId] - Get sprint details with tasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; sprintId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdStr, sprintId: sprintIdStr } = await params;
    const boardId = parseInt(boardIdStr);
    const sprintId = parseInt(sprintIdStr);
    
    if (!userId || isNaN(boardId) || isNaN(sprintId)) {
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

    // Get sprint details
    const sprintResult = await query(`
      SELECT * FROM sprints 
      WHERE id = $1 AND board_id = $2
    `, [sprintId, boardId]);

    if (sprintResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Sprint not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const sprint = sprintResult.rows[0];

    // Get sprint tasks with details
    const tasksResult = await query(`
      SELECT 
        t.*,
        c.name as column_name, c.color as column_color,
        assignee.email as assignee_email,
        creator.email as creator_email
      FROM sprint_tasks st
      JOIN tasks t ON st.task_id = t.id
      JOIN columns c ON t.column_id = c.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      JOIN users creator ON t.creator_id = creator.id
      WHERE st.sprint_id = $1
      ORDER BY c.position ASC, t.position ASC
    `, [sprintId]);

    const tasks = tasksResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      column_id: row.column_id,
      board_id: row.board_id,
      assignee_id: row.assignee_id,
      creator_id: row.creator_id,
      priority: row.priority,
      position: row.position,
      due_date: row.due_date,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      assignee: row.assignee_id ? { id: row.assignee_id, email: row.assignee_email } : undefined,
      creator: { id: row.creator_id, email: row.creator_email },
      column: { id: row.column_id, name: row.column_name, color: row.column_color }
    }));

    const sprintWithTasks: SprintWithTasks = {
      ...sprint,
      tasks
    };

    const response: ApiResponse<SprintWithTasks> = {
      success: true,
      message: 'Sprint retrieved successfully',
      data: sprintWithTasks,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching sprint:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// PUT /api/boards/[boardId]/sprints/[sprintId] - Update sprint
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; sprintId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdStr, sprintId: sprintIdStr } = await params;
    const boardId = parseInt(boardIdStr);
    const sprintId = parseInt(sprintIdStr);
    
    if (!userId || isNaN(boardId) || isNaN(sprintId)) {
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
    const validatedData = updateSprintSchema.parse(body);

    // Check if sprint exists
    const existingSprintResult = await query(`
      SELECT * FROM sprints 
      WHERE id = $1 AND board_id = $2
    `, [sprintId, boardId]);

    if (existingSprintResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Sprint not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const existingSprint = existingSprintResult.rows[0];

    // If changing status to active, check if there's already an active sprint
    if (validatedData.status === 'active' && existingSprint.status !== 'active') {
      const activeSprintResult = await query(`
        SELECT id FROM sprints 
        WHERE board_id = $1 AND status = 'active' AND id != $2
      `, [boardId, sprintId]);

      if (activeSprintResult.rows.length > 0) {
        const errorResponse: ApiError = {
          success: false,
          message: 'There is already an active sprint. Complete it before activating this one.',
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }
    }

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

    if (validatedData.start_date !== undefined) {
      updateFields.push(`start_date = $${paramCount++}`);
      updateValues.push(validatedData.start_date ? new Date(validatedData.start_date) : null);
    }

    if (validatedData.end_date !== undefined) {
      updateFields.push(`end_date = $${paramCount++}`);
      updateValues.push(validatedData.end_date ? new Date(validatedData.end_date) : null);
    }

    if (validatedData.status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      updateValues.push(validatedData.status);
    }

    if (validatedData.goal !== undefined) {
      updateFields.push(`goal = $${paramCount++}`);
      updateValues.push(validatedData.goal);
    }

    if (updateFields.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'No fields to update',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    updateValues.push(sprintId);
    updateValues.push(boardId);

    const updateQuery = `
      UPDATE sprints 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount++} AND board_id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);

    const response: ApiResponse = {
      success: true,
      message: 'Sprint updated successfully',
      data: result.rows[0],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error updating sprint:', error);
    
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

// DELETE /api/boards/[boardId]/sprints/[sprintId] - Delete sprint
export async function DELETE(
  request: NextRequest,
  { params }: { params: { boardId: string; sprintId: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const boardId = parseInt(params.boardId);
    const sprintId = parseInt(params.sprintId);
    
    if (!userId || isNaN(boardId) || isNaN(sprintId)) {
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

    // Check if sprint exists
    const sprintResult = await query(`
      SELECT * FROM sprints 
      WHERE id = $1 AND board_id = $2
    `, [sprintId, boardId]);

    if (sprintResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Sprint not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const sprint = sprintResult.rows[0];

    // Prevent deleting active sprint
    if (sprint.status === 'active') {
      const errorResponse: ApiError = {
        success: false,
        message: 'Cannot delete active sprint. Complete it first.',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Delete sprint (cascade will handle sprint_tasks)
    await query('DELETE FROM sprints WHERE id = $1', [sprintId]);

    const response: ApiResponse = {
      success: true,
      message: 'Sprint deleted successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error deleting sprint:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
