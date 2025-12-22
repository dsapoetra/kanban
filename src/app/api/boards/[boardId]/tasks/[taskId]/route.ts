import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import {
  updateTaskSchema,
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

// GET /api/boards/[boardId]/tasks/[taskId] - Get task details
export async function GET(
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

    const access = await checkBoardAccess(boardId, parseInt(userId));
    if (!access) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or access denied',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Get task with details
    const taskResult = await query(`
      SELECT 
        t.*,
        c.name as column_name, c.color as column_color,
        assignee.email as assignee_email,
        creator.email as creator_email
      FROM tasks t
      JOIN columns c ON t.column_id = c.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      JOIN users creator ON t.creator_id = creator.id
      WHERE t.id = $1 AND t.board_id = $2
    `, [taskId, boardId]);

    if (taskResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Task not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const row = taskResult.rows[0];
    const task: TaskWithDetails = {
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
    };

    const response: ApiResponse<TaskWithDetails> = {
      success: true,
      message: 'Task retrieved successfully',
      data: task,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching task:', error);

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

// PUT /api/boards/[boardId]/tasks/[taskId] - Update task
export async function PUT(
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

    const access = await checkBoardAccess(boardId, parseInt(userId));
    if (!access) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or access denied',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateTaskSchema.parse(body);

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

    // Verify column belongs to board (if changing column)
    if (validatedData.column_id && validatedData.column_id !== currentTask.column_id) {
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
    }

    // Verify assignee is a board member (if changing assignee)
    if (validatedData.assignee_id && validatedData.assignee_id !== currentTask.assignee_id) {
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

    // Update task in a transaction
    const result = await transaction(async (client) => {
      // Handle position changes if moving within same column or to different column
      if (validatedData.column_id !== undefined || validatedData.position !== undefined) {
        const newColumnId = validatedData.column_id || currentTask.column_id;
        const newPosition = validatedData.position !== undefined ? validatedData.position : currentTask.position;

        if (newColumnId !== currentTask.column_id) {
          // Moving to different column
          // Remove from old column
          await client.query(`
            UPDATE tasks 
            SET position = position - 1 
            WHERE column_id = $1 AND position > $2
          `, [currentTask.column_id, currentTask.position]);

          // Make room in new column
          await client.query(`
            UPDATE tasks 
            SET position = position + 1 
            WHERE column_id = $1 AND position >= $2
          `, [newColumnId, newPosition]);
        } else if (newPosition !== currentTask.position) {
          // Moving within same column
          if (newPosition > currentTask.position) {
            // Moving down
            await client.query(`
              UPDATE tasks 
              SET position = position - 1 
              WHERE column_id = $1 AND position > $2 AND position <= $3
            `, [currentTask.column_id, currentTask.position, newPosition]);
          } else {
            // Moving up
            await client.query(`
              UPDATE tasks 
              SET position = position + 1 
              WHERE column_id = $1 AND position >= $2 AND position < $3
            `, [currentTask.column_id, newPosition, currentTask.position]);
          }
        }
      }

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (validatedData.title !== undefined) {
        updateFields.push(`title = $${paramCount++}`);
        updateValues.push(validatedData.title);
        if (validatedData.title !== currentTask.title) {
          await logTaskHistory(taskId, parseInt(userId), 'updated', 'title', currentTask.title, validatedData.title);
        }
      }

      if (validatedData.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        updateValues.push(validatedData.description);
        if (validatedData.description !== currentTask.description) {
          await logTaskHistory(taskId, parseInt(userId), 'updated', 'description', currentTask.description, validatedData.description);
        }
      }

      if (validatedData.column_id !== undefined) {
        updateFields.push(`column_id = $${paramCount++}`);
        updateValues.push(validatedData.column_id);
        if (validatedData.column_id !== currentTask.column_id) {
          await logTaskHistory(taskId, parseInt(userId), 'moved', 'column', currentTask.column_id.toString(), validatedData.column_id.toString());
        }
      }

      if (validatedData.assignee_id !== undefined) {
        updateFields.push(`assignee_id = $${paramCount++}`);
        updateValues.push(validatedData.assignee_id);
        if (validatedData.assignee_id !== currentTask.assignee_id) {
          await logTaskHistory(taskId, parseInt(userId), 'assigned', 'assignee', 
            currentTask.assignee_id?.toString(), validatedData.assignee_id?.toString());
        }
      }

      if (validatedData.priority !== undefined) {
        updateFields.push(`priority = $${paramCount++}`);
        updateValues.push(validatedData.priority);
        if (validatedData.priority !== currentTask.priority) {
          await logTaskHistory(taskId, parseInt(userId), 'updated', 'priority', currentTask.priority, validatedData.priority);
        }
      }

      if (validatedData.position !== undefined) {
        updateFields.push(`position = $${paramCount++}`);
        updateValues.push(validatedData.position);
      }

      if (validatedData.due_date !== undefined) {
        updateFields.push(`due_date = $${paramCount++}`);
        updateValues.push(validatedData.due_date ? new Date(validatedData.due_date) : null);
        const oldDate = currentTask.due_date ? currentTask.due_date.toISOString() : null;
        const newDate = validatedData.due_date;
        if (oldDate !== newDate) {
          await logTaskHistory(taskId, parseInt(userId), 'updated', 'due_date', oldDate, newDate);
        }
      }

      if (updateFields.length === 0) {
        return currentTask;
      }

      updateValues.push(taskId);
      updateValues.push(boardId);

      const updateQuery = `
        UPDATE tasks 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount++} AND board_id = $${paramCount}
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, updateValues);
      return updateResult.rows[0];
    });

    const response: ApiResponse = {
      success: true,
      message: 'Task updated successfully',
      data: result,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error updating task:', error);

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

// DELETE /api/boards/[boardId]/tasks/[taskId] - Delete task
export async function DELETE(
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

    const access = await checkBoardAccess(boardId, parseInt(userId));
    if (!access) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or access denied',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Get task details
    const taskResult = await query(`
      SELECT * FROM tasks WHERE id = $1 AND board_id = $2
    `, [taskId, boardId]);

    if (taskResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Task not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const task = taskResult.rows[0];

    // Delete task and adjust positions
    await transaction(async (client) => {
      // Log task deletion
      await client.query(`
        INSERT INTO task_history (task_id, user_id, action)
        VALUES ($1, $2, 'deleted')
      `, [taskId, parseInt(userId)]);

      // Delete the task
      await client.query('DELETE FROM tasks WHERE id = $1', [taskId]);

      // Shift remaining tasks up
      await client.query(`
        UPDATE tasks
        SET position = position - 1
        WHERE column_id = $1 AND position > $2
      `, [task.column_id, task.position]);
    });

    const response: ApiResponse = {
      success: true,
      message: 'Task deleted successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error deleting task:', error);

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
