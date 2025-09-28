import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { 
  ApiResponse, 
  ApiError,
  BoardAnalytics,
  TaskAnalytics,
  SprintAnalytics 
} from '@/types/kanban';

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

// GET /api/boards/[boardId]/analytics - Get comprehensive board analytics
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

    // Get task analytics
    const taskAnalyticsResult = await query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP AND completed_at IS NULL THEN 1 END) as overdue_tasks,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_priority
      FROM tasks 
      WHERE board_id = $1
    `, [boardId]);

    const taskStats = taskAnalyticsResult.rows[0];
    const totalTasks = parseInt(taskStats.total_tasks);
    const completedTasks = parseInt(taskStats.completed_tasks);

    // Get tasks by column
    const tasksByColumnResult = await query(`
      SELECT c.name, COUNT(t.id) as task_count
      FROM columns c
      LEFT JOIN tasks t ON c.id = t.column_id
      WHERE c.board_id = $1
      GROUP BY c.id, c.name, c.position
      ORDER BY c.position
    `, [boardId]);

    const tasksByColumn: Record<string, number> = {};
    tasksByColumnResult.rows.forEach(row => {
      tasksByColumn[row.name] = parseInt(row.task_count);
    });

    const taskAnalytics: TaskAnalytics = {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      overdue_tasks: parseInt(taskStats.overdue_tasks),
      tasks_by_priority: {
        low: parseInt(taskStats.low_priority),
        medium: parseInt(taskStats.medium_priority),
        high: parseInt(taskStats.high_priority),
        urgent: parseInt(taskStats.urgent_priority)
      },
      tasks_by_column: tasksByColumn,
      completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };

    // Get sprint analytics for the most recent completed sprint
    const recentSprintResult = await query(`
      SELECT s.*, 
        COUNT(st.task_id) as total_tasks,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) as completed_tasks
      FROM sprints s
      LEFT JOIN sprint_tasks st ON s.id = st.sprint_id
      LEFT JOIN tasks t ON st.task_id = t.id
      WHERE s.board_id = $1 AND s.status = 'completed'
      GROUP BY s.id
      ORDER BY s.end_date DESC
      LIMIT 1
    `, [boardId]);

    let sprintAnalytics: SprintAnalytics | undefined;

    if (recentSprintResult.rows.length > 0) {
      const sprint = recentSprintResult.rows[0];
      const sprintTotalTasks = parseInt(sprint.total_tasks);
      const sprintCompletedTasks = parseInt(sprint.completed_tasks);

      // Generate burndown data (simplified - in real implementation, you'd track daily progress)
      const burndownData = [];
      if (sprint.start_date && sprint.end_date) {
        const startDate = new Date(sprint.start_date);
        const endDate = new Date(sprint.end_date);
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        for (let i = 0; i <= totalDays; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          
          // Simplified linear burndown - in reality, you'd track actual daily completion
          const remaining = Math.max(0, sprintTotalTasks - Math.floor((sprintCompletedTasks * i) / totalDays));
          
          burndownData.push({
            date: currentDate.toISOString().split('T')[0],
            remaining: remaining
          });
        }
      }

      sprintAnalytics = {
        total_story_points: sprintTotalTasks, // Simplified - using task count as story points
        completed_story_points: sprintCompletedTasks,
        velocity: sprintCompletedTasks, // Simplified velocity calculation
        burndown_data: burndownData,
        completion_rate: sprintTotalTasks > 0 ? Math.round((sprintCompletedTasks / sprintTotalTasks) * 100) : 0
      };
    }

    // Get member activity
    const memberActivityResult = await query(`
      SELECT 
        u.id as user_id,
        u.email,
        COUNT(t.id) as task_count
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assignee_id AND t.board_id = $1
      WHERE u.id IN (
        SELECT DISTINCT user_id FROM board_members WHERE board_id = $1
        UNION
        SELECT owner_id FROM boards WHERE id = $1
      )
      GROUP BY u.id, u.email
      ORDER BY task_count DESC
    `, [boardId]);

    const memberActivity = memberActivityResult.rows.map(row => ({
      user_id: row.user_id,
      email: row.email,
      task_count: parseInt(row.task_count)
    }));

    // Get recent activity from task history
    const recentActivityResult = await query(`
      SELECT 
        th.*,
        u.email as user_email,
        t.title as task_title
      FROM task_history th
      JOIN users u ON th.user_id = u.id
      JOIN tasks t ON th.task_id = t.id
      WHERE t.board_id = $1
      ORDER BY th.created_at DESC
      LIMIT 20
    `, [boardId]);

    const recentActivity = recentActivityResult.rows.map(row => ({
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      action: row.action,
      old_value: row.old_value,
      new_value: row.new_value,
      field_changed: row.field_changed,
      created_at: row.created_at,
      user_email: row.user_email,
      task_title: row.task_title
    }));

    const boardAnalytics: BoardAnalytics = {
      task_analytics: taskAnalytics,
      sprint_analytics: sprintAnalytics,
      member_activity: memberActivity,
      recent_activity: recentActivity
    };

    const response: ApiResponse<BoardAnalytics> = {
      success: true,
      message: 'Board analytics retrieved successfully',
      data: boardAnalytics,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching board analytics:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
