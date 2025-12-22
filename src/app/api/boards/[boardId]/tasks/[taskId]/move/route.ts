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

    // Combine task and column validation into single query for speed
    const validationResult = await query(`
      SELECT
        t.*,
        EXISTS(SELECT 1 FROM columns WHERE id = $3 AND board_id = $2) as column_exists
      FROM tasks t
      WHERE t.id = $1 AND t.board_id = $2
    `, [taskId, boardId, validatedData.column_id]);

    if (validationResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Task not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const currentTask = validationResult.rows[0];

    if (!currentTask.column_exists) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Target column not found in this board',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Move task in a transaction - optimized for speed
    const result = await transaction(async (client) => {
      const oldColumnId = currentTask.column_id;
      const oldPosition = currentTask.position;
      const newColumnId = validatedData.column_id;
      const newPosition = validatedData.position;

      // Early exit if no change needed
      if (oldColumnId === newColumnId && oldPosition === newPosition) {
        return currentTask;
      }

      if (oldColumnId === newColumnId) {
        // Moving within same column - single optimized query
        if (newPosition > oldPosition) {
          // Moving down - shift tasks up and update in one query
          await client.query(`
            UPDATE tasks
            SET position = CASE
              WHEN id = $1 THEN $2
              WHEN position > $3 AND position <= $2 THEN position - 1
              ELSE position
            END,
            updated_at = CASE WHEN id = $1 THEN CURRENT_TIMESTAMP ELSE updated_at END
            WHERE column_id = $4 AND (id = $1 OR (position > $3 AND position <= $2))
          `, [taskId, newPosition, oldPosition, oldColumnId]);
        } else {
          // Moving up - shift tasks down and update in one query
          await client.query(`
            UPDATE tasks
            SET position = CASE
              WHEN id = $1 THEN $2
              WHEN position >= $2 AND position < $3 THEN position + 1
              ELSE position
            END,
            updated_at = CASE WHEN id = $1 THEN CURRENT_TIMESTAMP ELSE updated_at END
            WHERE column_id = $4 AND (id = $1 OR (position >= $2 AND position < $3))
          `, [taskId, newPosition, oldPosition, oldColumnId]);
        }
      } else {
        // Moving to different column - combine updates for efficiency
        await client.query(`
          UPDATE tasks
          SET position = CASE
            WHEN id = $1 THEN $2
            WHEN column_id = $3 AND position > $4 THEN position - 1
            WHEN column_id = $5 AND position >= $2 THEN position + 1
            ELSE position
          END,
          column_id = CASE WHEN id = $1 THEN $5 ELSE column_id END,
          updated_at = CASE WHEN id = $1 THEN CURRENT_TIMESTAMP ELSE updated_at END
          WHERE id = $1 OR (column_id = $3 AND position > $4) OR (column_id = $5 AND position >= $2)
        `, [taskId, newPosition, oldColumnId, oldPosition, newColumnId]);
      }

      // Get updated task data
      const updateResult = await client.query(`
        SELECT * FROM tasks WHERE id = $1 AND board_id = $2
      `, [taskId, boardId]);

      return updateResult.rows[0];
    });

    // Log history AFTER transaction completes (non-blocking)
    if (currentTask.column_id !== validatedData.column_id) {
      // Don't await - fire and forget to avoid blocking response
      logTaskHistory(taskId, parseInt(userId), 'moved', 'column',
        currentTask.column_id.toString(), validatedData.column_id.toString()).catch(err => {
        console.error('Failed to log task history:', err);
      });
    }

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

    // Check if error is a connection/timeout error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConnectionError = errorMessage.includes('timeout') ||
                             errorMessage.includes('Connection') ||
                             errorMessage.includes('connect ETIMEDOUT') ||
                             errorMessage.includes('ECONNREFUSED');

    const errorResponse: ApiError = {
      success: false,
      message: isConnectionError
        ? 'Database connection timeout. Please try again.'
        : 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: isConnectionError ? 503 : 500 });
  }
}
