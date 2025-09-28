import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
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

// POST /api/boards/[boardId]/sprints/[sprintId]/complete - Complete a sprint
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

    const body = await request.json();
    const { move_incomplete_tasks_to_backlog = true } = body;

    // Check if sprint exists and is active
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

    if (sprint.status !== 'active') {
      const errorResponse: ApiError = {
        success: false,
        message: `Cannot complete sprint with status '${sprint.status}'. Only active sprints can be completed.`,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Get sprint statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.completed_at IS NULL THEN 1 END) as incomplete_tasks
      FROM sprint_tasks st
      JOIN tasks t ON st.task_id = t.id
      WHERE st.sprint_id = $1
    `, [sprintId]);

    const stats = statsResult.rows[0];
    const totalTasks = parseInt(stats.total_tasks);
    const completedTasks = parseInt(stats.completed_tasks);
    const incompleteTasks = parseInt(stats.incomplete_tasks);

    // Complete sprint in a transaction
    const result = await transaction(async (client) => {
      // If requested, move incomplete tasks back to backlog (remove from sprint)
      if (move_incomplete_tasks_to_backlog && incompleteTasks > 0) {
        await client.query(`
          DELETE FROM sprint_tasks 
          WHERE sprint_id = $1 AND task_id IN (
            SELECT t.id FROM tasks t 
            JOIN sprint_tasks st ON t.id = st.task_id 
            WHERE st.sprint_id = $1 AND t.completed_at IS NULL
          )
        `, [sprintId]);
      }

      // Complete the sprint
      const updateResult = await client.query(`
        UPDATE sprints 
        SET status = 'completed', 
            end_date = COALESCE(end_date, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND board_id = $2
        RETURNING *
      `, [sprintId, boardId]);

      return updateResult.rows[0];
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const response: ApiResponse = {
      success: true,
      message: `Sprint "${result.name}" completed successfully`,
      data: {
        sprint: result,
        statistics: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          incomplete_tasks: incompleteTasks,
          completion_rate: completionRate,
          incomplete_moved_to_backlog: move_incomplete_tasks_to_backlog ? incompleteTasks : 0
        }
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error completing sprint:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
