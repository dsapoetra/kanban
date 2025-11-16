import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { 
  ApiResponse, 
  ApiError 
} from '@/types/kanban';

// Helper function to check if user has access to board
async function checkBoardAccess(boardId: number, userId: number) {
  const result = await query(`
    SELECT b.*, bm.role
    FROM boards b
    LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = $2
    WHERE b.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)
  `, [boardId, userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

// DELETE /api/boards/[boardId]/sprints/[sprintId]/tasks/[taskId] - Remove single task from sprint
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; sprintId: string; taskId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdStr, sprintId: sprintIdStr, taskId: taskIdStr } = await params;
    const boardId = parseInt(boardIdStr);
    const sprintId = parseInt(sprintIdStr);
    const taskId = parseInt(taskIdStr);
    
    if (!userId || isNaN(boardId) || isNaN(sprintId) || isNaN(taskId)) {
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

    // Verify task exists and belongs to board
    const taskResult = await query(`
      SELECT * FROM tasks 
      WHERE id = $1 AND board_id = $2
    `, [taskId, boardId]);

    if (taskResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Task not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Remove task from sprint
    const deleteResult = await query(`
      DELETE FROM sprint_tasks 
      WHERE sprint_id = $1 AND task_id = $2
    `, [sprintId, taskId]);

    const response: ApiResponse = {
      success: true,
      message: 'Task removed from sprint',
      data: { removed: (deleteResult.rowCount ?? 0) > 0 },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error removing task from sprint:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

