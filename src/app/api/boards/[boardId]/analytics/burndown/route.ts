import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { ApiResponse, ApiError } from '@/types/kanban';

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

// GET /api/boards/[boardId]/analytics/burndown?sprintId=123 - Get burndown chart data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdStr } = await params;
    const boardId = parseInt(boardIdStr);
    const { searchParams } = new URL(request.url);
    const sprintIdParam = searchParams.get('sprintId');
    
    if (!userId || isNaN(boardId)) {
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

    let sprintId: number;

    if (sprintIdParam) {
      sprintId = parseInt(sprintIdParam);
      if (isNaN(sprintId)) {
        const errorResponse: ApiError = {
          success: false,
          message: 'Invalid sprint ID',
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }
    } else {
      // Get the active sprint or most recent sprint
      const sprintResult = await query(`
        SELECT id FROM sprints 
        WHERE board_id = $1 AND (status = 'active' OR status = 'completed')
        ORDER BY 
          CASE WHEN status = 'active' THEN 1 ELSE 2 END,
          updated_at DESC
        LIMIT 1
      `, [boardId]);

      if (sprintResult.rows.length === 0) {
        const errorResponse: ApiError = {
          success: false,
          message: 'No active or completed sprints found',
        };
        return NextResponse.json(errorResponse, { status: 404 });
      }

      sprintId = sprintResult.rows[0].id;
    }

    // Get sprint details
    const sprintDetailsResult = await query(`
      SELECT * FROM sprints 
      WHERE id = $1 AND board_id = $2
    `, [sprintId, boardId]);

    if (sprintDetailsResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Sprint not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const sprint = sprintDetailsResult.rows[0];

    // Get total tasks in sprint
    const totalTasksResult = await query(`
      SELECT COUNT(*) as total_tasks
      FROM sprint_tasks st
      WHERE st.sprint_id = $1
    `, [sprintId]);

    const totalTasks = parseInt(totalTasksResult.rows[0].total_tasks);

    if (totalTasks === 0) {
      const response: ApiResponse = {
        success: true,
        message: 'Burndown chart data retrieved successfully',
        data: {
          sprint: sprint,
          total_tasks: 0,
          burndown_data: [],
          ideal_burndown: [],
          completion_rate: 0
        },
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Generate date range for the sprint
    const startDate = new Date(sprint.start_date || sprint.created_at);
    const endDate = sprint.status === 'completed' 
      ? new Date(sprint.end_date || sprint.updated_at)
      : new Date(); // Use current date for active sprints

    const dates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get task completion data by date
    const burndownData = [];
    const idealBurndown = [];
    
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const dateStr = date.toISOString().split('T')[0];
      
      // Count completed tasks up to this date
      const completedTasksResult = await query(`
        SELECT COUNT(*) as completed_count
        FROM sprint_tasks st
        JOIN tasks t ON st.task_id = t.id
        WHERE st.sprint_id = $1 
        AND t.completed_at IS NOT NULL 
        AND DATE(t.completed_at) <= $2
      `, [sprintId, dateStr]);

      const completedTasks = parseInt(completedTasksResult.rows[0].completed_count);
      const remainingTasks = totalTasks - completedTasks;

      burndownData.push({
        date: dateStr,
        remaining_tasks: remainingTasks,
        completed_tasks: completedTasks,
        day_number: i + 1
      });

      // Calculate ideal burndown (linear)
      const totalDays = dates.length;
      const idealRemaining = Math.max(0, totalTasks - Math.round((totalTasks * (i + 1)) / totalDays));
      
      idealBurndown.push({
        date: dateStr,
        ideal_remaining: idealRemaining,
        day_number: i + 1
      });
    }

    // Calculate completion rate
    const currentCompleted = burndownData.length > 0 ? burndownData[burndownData.length - 1].completed_tasks : 0;
    const completionRate = totalTasks > 0 ? Math.round((currentCompleted / totalTasks) * 100) : 0;

    // Calculate velocity and projection for active sprints
    let projectedCompletion = null;
    if (sprint.status === 'active' && burndownData.length > 1) {
      const daysElapsed = burndownData.length;
      const tasksCompleted = currentCompleted;
      
      if (tasksCompleted > 0) {
        const dailyVelocity = tasksCompleted / daysElapsed;
        const remainingTasks = totalTasks - tasksCompleted;
        const projectedDaysToComplete = Math.ceil(remainingTasks / dailyVelocity);
        
        const projectedEndDate = new Date();
        projectedEndDate.setDate(projectedEndDate.getDate() + projectedDaysToComplete);
        
        projectedCompletion = {
          projected_end_date: projectedEndDate.toISOString().split('T')[0],
          days_to_complete: projectedDaysToComplete,
          daily_velocity: Math.round(dailyVelocity * 100) / 100
        };
      }
    }

    const response: ApiResponse = {
      success: true,
      message: 'Burndown chart data retrieved successfully',
      data: {
        sprint: {
          id: sprint.id,
          name: sprint.name,
          status: sprint.status,
          start_date: sprint.start_date,
          end_date: sprint.end_date,
          goal: sprint.goal
        },
        total_tasks: totalTasks,
        burndown_data: burndownData,
        ideal_burndown: idealBurndown,
        completion_rate: completionRate,
        projected_completion: projectedCompletion
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching burndown data:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
