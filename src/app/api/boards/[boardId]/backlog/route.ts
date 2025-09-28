import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { 
  ApiResponse, 
  ApiError,
  TaskWithDetails 
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

// GET /api/boards/[boardId]/backlog - Get backlog tasks (tasks not in any sprint)
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

    // Get tasks that are not in any sprint
    const backlogResult = await query(`
      SELECT 
        t.*,
        c.name as column_name, c.color as column_color,
        assignee.email as assignee_email,
        creator.email as creator_email
      FROM tasks t
      JOIN columns c ON t.column_id = c.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      JOIN users creator ON t.creator_id = creator.id
      LEFT JOIN sprint_tasks st ON t.id = st.task_id
      WHERE t.board_id = $1 AND st.task_id IS NULL
      ORDER BY t.created_at DESC
    `, [boardId]);

    const backlogTasks: TaskWithDetails[] = backlogResult.rows.map(row => ({
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
    }));

    // Get summary statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_backlog_tasks,
        COUNT(CASE WHEN t.priority = 'urgent' THEN 1 END) as urgent_tasks,
        COUNT(CASE WHEN t.priority = 'high' THEN 1 END) as high_priority_tasks,
        COUNT(CASE WHEN t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP THEN 1 END) as overdue_tasks
      FROM tasks t
      LEFT JOIN sprint_tasks st ON t.id = st.task_id
      WHERE t.board_id = $1 AND st.task_id IS NULL
    `, [boardId]);

    const stats = statsResult.rows[0];

    const response: ApiResponse = {
      success: true,
      message: 'Backlog retrieved successfully',
      data: {
        tasks: backlogTasks,
        statistics: {
          total_tasks: parseInt(stats.total_backlog_tasks),
          urgent_tasks: parseInt(stats.urgent_tasks),
          high_priority_tasks: parseInt(stats.high_priority_tasks),
          overdue_tasks: parseInt(stats.overdue_tasks)
        }
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching backlog:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
