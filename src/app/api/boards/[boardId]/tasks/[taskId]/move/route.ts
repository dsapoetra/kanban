import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { 
  moveTaskSchema,
  ApiResponse, 
  ApiError 
} from '@/types/kanban';
import { ZodError } from 'zod';

// Helper function to check if user has access to board
async function checkBoardAccess(boardId: number, userId: number) {
  const result = await query(`
    SELECT b.*, bm.role
    FROM boards b
    LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = $2
    WHERE b.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)
  `, [boardId, userId]);

  return result.rows.length > 0;
}

// Helper function to log task history
async function logTaskHistory(taskId: number, userId: number, action: string, fieldChanged?: string, oldValue?: string, newValue?: string) {
  await query(`
    INSERT INTO task_history (task_id, user_id, action, field_changed, old_value, new_value)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [taskId, userId, action, fieldChanged, oldValue, newValue]);
}

// POST /api/boards/[boardId]/tasks/[taskId]/move - Move task to different column/position
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; taskId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdStr, taskId: taskIdStr } = await params;
    const boardId = parseInt(boardIdStr);
    const taskId = parseInt(taskIdStr);
    
    if (!userId || isNaN(boardId) || isNaN(taskId)) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid request parameters',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const hasAccess = await checkBoardAccess(boardId, parseInt(userId));
    if (!hasAccess) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or access denied',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const body = await request.json();
    const validatedData = moveTaskSchema.parse(body);

    // Get current task data
    const currentTaskResult = await query(`
      SELECT * FROM tasks WHERE id = $1 AND board_id = $2
    `, [taskId, boardId]);

    if (currentTaskResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Task not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const currentTask = currentTaskResult.rows[0];

    // Verify target column belongs to board
    const columnResult = await query(`
      SELECT id FROM columns 
      WHERE id = $1 AND board_id = $2
    `, [validatedData.column_id, boardId]);

    if (columnResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Target column not found in this board',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Move task in a transaction
    const result = await transaction(async (client) => {
      const oldColumnId = currentTask.column_id;
      const oldPosition = currentTask.position;
      const newColumnId = validatedData.column_id;
      const newPosition = validatedData.position;

      if (oldColumnId === newColumnId) {
        // Moving within same column
        if (oldPosition === newPosition) {
          // No change needed
          return currentTask;
        }

        if (newPosition > oldPosition) {
          // Moving down - shift tasks up
          await client.query(`
            UPDATE tasks 
            SET position = position - 1 
            WHERE column_id = $1 AND position > $2 AND position <= $3
          `, [oldColumnId, oldPosition, newPosition]);
        } else {
          // Moving up - shift tasks down
          await client.query(`
            UPDATE tasks 
            SET position = position + 1 
            WHERE column_id = $1 AND position >= $2 AND position < $3
          `, [oldColumnId, newPosition, oldPosition]);
        }
      } else {
        // Moving to different column
        // Remove from old column - shift tasks up
        await client.query(`
          UPDATE tasks 
          SET position = position - 1 
          WHERE column_id = $1 AND position > $2
        `, [oldColumnId, oldPosition]);

        // Make room in new column - shift tasks down
        await client.query(`
          UPDATE tasks 
          SET position = position + 1 
          WHERE column_id = $1 AND position >= $2
        `, [newColumnId, newPosition]);

        // Log column change
        await logTaskHistory(taskId, parseInt(userId), 'moved', 'column', 
          oldColumnId.toString(), newColumnId.toString());
      }

      // Update task position and column
      const updateResult = await client.query(`
        UPDATE tasks 
        SET column_id = $1, position = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND board_id = $4
        RETURNING *
      `, [newColumnId, newPosition, taskId, boardId]);

      return updateResult.rows[0];
    });

    const response: ApiResponse = {
      success: true,
      message: 'Task moved successfully',
      data: result,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error moving task:', error);
    
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
