import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { 
  createTaskSchema, 
  ApiResponse, 
  ApiError,
  TaskWithDetails 
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

// Helper function to log task history
async function logTaskHistory(taskId: number, userId: number, action: string, fieldChanged?: string, oldValue?: string, newValue?: string) {
  await query(`
    INSERT INTO task_history (task_id, user_id, action, field_changed, old_value, new_value)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [taskId, userId, action, fieldChanged, oldValue, newValue]);
}

// GET /api/boards/[boardId]/tasks - Get all tasks for a board
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

    // Get tasks with details
    const tasksResult = await query(`
      SELECT
        t.*,
        c.name as column_name, c.color as column_color,
        assignee.email as assignee_email,
        creator.email as creator_email
      FROM tasks t
      JOIN columns c ON t.column_id = c.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      JOIN users creator ON t.creator_id = creator.id
      WHERE t.board_id = $1
      ORDER BY c.position ASC, t.position ASC
    `, [boardId]);

    const tasks: TaskWithDetails[] = tasksResult.rows.map(row => ({
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

    const response: ApiResponse<TaskWithDetails[]> = {
      success: true,
      message: 'Tasks retrieved successfully',
      data: tasks,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API /api/boards/[boardId]/tasks GET] Exception:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST /api/boards/[boardId]/tasks - Create a new task
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

    const access = await checkBoardAccess(boardId, parseInt(userId));
    if (!access) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or access denied',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createTaskSchema.parse(body);

    // Verify column belongs to board
    const columnResult = await query(`
      SELECT id FROM columns 
      WHERE id = $1 AND board_id = $2
    `, [validatedData.column_id, boardId]);

    if (columnResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Column not found in this board',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Verify assignee is a board member (if provided)
    if (validatedData.assignee_id) {
      const memberResult = await query(`
        SELECT 1 FROM board_members bm
        WHERE bm.board_id = $1 AND bm.user_id = $2
        UNION
        SELECT 1 FROM boards b
        WHERE b.id = $1 AND b.owner_id = $2
      `, [boardId, validatedData.assignee_id]);

      if (memberResult.rows.length === 0) {
        const errorResponse: ApiError = {
          success: false,
          message: 'Assignee is not a member of this board',
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }
    }

    // Create task in a transaction
    const result = await transaction(async (client) => {
      // Shift existing tasks to make room for new task
      await client.query(`
        UPDATE tasks 
        SET position = position + 1 
        WHERE column_id = $1 AND position >= $2
      `, [validatedData.column_id, validatedData.position]);

      // Insert new task
      const taskResult = await client.query(`
        INSERT INTO tasks (
          title, description, column_id, board_id, assignee_id, creator_id, 
          priority, position, due_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        validatedData.title,
        validatedData.description || null,
        validatedData.column_id,
        boardId,
        validatedData.assignee_id || null,
        parseInt(userId),
        validatedData.priority || 'medium',
        validatedData.position,
        validatedData.due_date ? new Date(validatedData.due_date) : null
      ]);

      const task = taskResult.rows[0];

      // Log task creation
      await client.query(`
        INSERT INTO task_history (task_id, user_id, action)
        VALUES ($1, $2, 'created')
      `, [task.id, parseInt(userId)]);

      return task;
    });

    const response: ApiResponse = {
      success: true,
      message: 'Task created successfully',
      data: result,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    
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
