import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { ApiResponse, ApiError } from '@/types/kanban';

// Helper function to check if user has admin access to board
async function checkBoardAdminAccess(boardId: number, userId: number) {
  const result = await query(`
    SELECT b.*, bm.role
    FROM boards b
    LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = $2
    WHERE b.id = $1 AND (b.owner_id = $2 OR (bm.user_id = $2 AND bm.role = 'admin'))
  `, [boardId, userId]);

  return result.rows.length > 0;
}

// POST /api/boards/[boardId]/sprints/[sprintId]/start - Start a sprint
export async function POST(
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

    const hasAccess = await checkBoardAdminAccess(boardId, parseInt(userId));
    if (!hasAccess) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or insufficient permissions',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Check if sprint exists and is in planning status
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

    if (sprint.status !== 'planning') {
      const errorResponse: ApiError = {
        success: false,
        message: `Cannot start sprint with status '${sprint.status}'. Only planning sprints can be started.`,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Check if there's already an active sprint
    const activeSprintResult = await query(`
      SELECT id, name FROM sprints 
      WHERE board_id = $1 AND status = 'active'
    `, [boardId]);

    if (activeSprintResult.rows.length > 0) {
      const activeSprint = activeSprintResult.rows[0];
      const errorResponse: ApiError = {
        success: false,
        message: `Cannot start sprint. Sprint "${activeSprint.name}" is already active.`,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Check if sprint has tasks
    const taskCountResult = await query(`
      SELECT COUNT(*) as task_count FROM sprint_tasks 
      WHERE sprint_id = $1
    `, [sprintId]);

    const taskCount = parseInt(taskCountResult.rows[0].task_count);

    if (taskCount === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Cannot start sprint with no tasks. Add tasks to the sprint first.',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Start the sprint
    const updateResult = await query(`
      UPDATE sprints 
      SET status = 'active', 
          start_date = COALESCE(start_date, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND board_id = $2
      RETURNING *
    `, [sprintId, boardId]);

    const updatedSprint = updateResult.rows[0];

    const response: ApiResponse = {
      success: true,
      message: `Sprint "${updatedSprint.name}" started successfully`,
      data: {
        sprint: updatedSprint,
        task_count: taskCount
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error starting sprint:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
