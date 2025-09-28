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

// GET /api/boards/[boardId]/analytics/velocity - Get team velocity analytics
export async function GET(
  request: NextRequest,
  { params }: { params: { boardId: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const boardId = parseInt(params.boardId);
    
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

    // Get velocity data for completed sprints
    const velocityResult = await query(`
      SELECT 
        s.id,
        s.name,
        s.start_date,
        s.end_date,
        COUNT(st.task_id) as total_tasks,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) as completed_tasks,
        EXTRACT(DAYS FROM (s.end_date - s.start_date)) as sprint_duration
      FROM sprints s
      LEFT JOIN sprint_tasks st ON s.id = st.sprint_id
      LEFT JOIN tasks t ON st.task_id = t.id
      WHERE s.board_id = $1 AND s.status = 'completed'
      GROUP BY s.id, s.name, s.start_date, s.end_date
      ORDER BY s.end_date DESC
      LIMIT 10
    `, [boardId]);

    const sprintVelocities = velocityResult.rows.map(row => {
      const totalTasks = parseInt(row.total_tasks);
      const completedTasks = parseInt(row.completed_tasks);
      const duration = parseInt(row.sprint_duration) || 1;
      
      return {
        sprint_id: row.id,
        sprint_name: row.name,
        start_date: row.start_date,
        end_date: row.end_date,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        velocity: completedTasks, // Tasks completed per sprint
        daily_velocity: Math.round((completedTasks / duration) * 100) / 100, // Tasks per day
        sprint_duration: duration
      };
    });

    // Calculate average velocity
    const totalCompletedTasks = sprintVelocities.reduce((sum, sprint) => sum + sprint.completed_tasks, 0);
    const averageVelocity = sprintVelocities.length > 0 ? Math.round((totalCompletedTasks / sprintVelocities.length) * 100) / 100 : 0;

    // Calculate velocity trend (comparing last 3 sprints to previous 3)
    let velocityTrend = 'stable';
    if (sprintVelocities.length >= 6) {
      const recentVelocity = sprintVelocities.slice(0, 3).reduce((sum, sprint) => sum + sprint.completed_tasks, 0) / 3;
      const previousVelocity = sprintVelocities.slice(3, 6).reduce((sum, sprint) => sum + sprint.completed_tasks, 0) / 3;
      
      if (recentVelocity > previousVelocity * 1.1) {
        velocityTrend = 'increasing';
      } else if (recentVelocity < previousVelocity * 0.9) {
        velocityTrend = 'decreasing';
      }
    }

    // Get current sprint progress (if any)
    const currentSprintResult = await query(`
      SELECT 
        s.*,
        COUNT(st.task_id) as total_tasks,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) as completed_tasks,
        EXTRACT(DAYS FROM (CURRENT_TIMESTAMP - s.start_date)) as days_elapsed,
        EXTRACT(DAYS FROM (s.end_date - s.start_date)) as total_duration
      FROM sprints s
      LEFT JOIN sprint_tasks st ON s.id = st.sprint_id
      LEFT JOIN tasks t ON st.task_id = t.id
      WHERE s.board_id = $1 AND s.status = 'active'
      GROUP BY s.id
    `, [boardId]);

    let currentSprintProgress = null;
    if (currentSprintResult.rows.length > 0) {
      const current = currentSprintResult.rows[0];
      const totalTasks = parseInt(current.total_tasks);
      const completedTasks = parseInt(current.completed_tasks);
      const daysElapsed = Math.max(0, parseInt(current.days_elapsed) || 0);
      const totalDuration = parseInt(current.total_duration) || 1;
      
      currentSprintProgress = {
        sprint_id: current.id,
        sprint_name: current.name,
        start_date: current.start_date,
        end_date: current.end_date,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        remaining_tasks: totalTasks - completedTasks,
        days_elapsed: daysElapsed,
        days_remaining: Math.max(0, totalDuration - daysElapsed),
        completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        current_velocity: daysElapsed > 0 ? Math.round((completedTasks / daysElapsed) * 100) / 100 : 0,
        projected_completion: totalTasks > 0 && completedTasks > 0 && daysElapsed > 0 
          ? Math.ceil((totalTasks * daysElapsed) / completedTasks) 
          : null
      };
    }

    const response: ApiResponse = {
      success: true,
      message: 'Velocity analytics retrieved successfully',
      data: {
        sprint_velocities: sprintVelocities,
        average_velocity: averageVelocity,
        velocity_trend: velocityTrend,
        current_sprint_progress: currentSprintProgress,
        total_completed_sprints: sprintVelocities.length
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching velocity analytics:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
