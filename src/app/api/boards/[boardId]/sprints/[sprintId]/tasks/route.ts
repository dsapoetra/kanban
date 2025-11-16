import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { 
  ApiResponse, 
  ApiError 
} from '@/types/kanban';

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

// POST /api/boards/[boardId]/sprints/[sprintId]/tasks - Add task to sprint
export async function POST(
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

    const body = await request.json();
    const { task_ids } = body; // Array of task IDs to add to sprint

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'task_ids must be a non-empty array',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Verify sprint exists and belongs to board
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

    // Verify all tasks exist and belong to the board
    const tasksResult = await query(`
      SELECT id FROM tasks 
      WHERE id = ANY($1) AND board_id = $2
    `, [task_ids, boardId]);

    if (tasksResult.rows.length !== task_ids.length) {
      const errorResponse: ApiError = {
        success: false,
        message: 'One or more tasks not found in this board',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Add tasks to sprint (ignore duplicates)
    const addedTasks = await transaction(async (client) => {
      const results = [];
      for (const taskId of task_ids) {
        try {
          const result = await client.query(`
            INSERT INTO sprint_tasks (sprint_id, task_id)
            VALUES ($1, $2)
            ON CONFLICT (sprint_id, task_id) DO NOTHING
            RETURNING *
          `, [sprintId, taskId]);
          
          if (result.rows.length > 0) {
            results.push(result.rows[0]);
          }
        } catch {
          // Skip if already exists
          continue;
        }
      }
      return results;
    });

    const response: ApiResponse = {
      success: true,
      message: `${addedTasks.length} task(s) added to sprint`,
      data: { added_tasks: addedTasks.length, total_requested: task_ids.length },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error adding tasks to sprint:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// DELETE /api/boards/[boardId]/sprints/[sprintId]/tasks - Remove tasks from sprint
export async function DELETE(
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

    const body = await request.json();
    const { task_ids } = body; // Array of task IDs to remove from sprint

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'task_ids must be a non-empty array',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Verify sprint exists and belongs to board
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

    // Remove tasks from sprint
    const deleteResult = await query(`
      DELETE FROM sprint_tasks 
      WHERE sprint_id = $1 AND task_id = ANY($2)
    `, [sprintId, task_ids]);

    const response: ApiResponse = {
      success: true,
      message: `${deleteResult.rowCount} task(s) removed from sprint`,
      data: { removed_tasks: deleteResult.rowCount, total_requested: task_ids.length },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error removing tasks from sprint:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
