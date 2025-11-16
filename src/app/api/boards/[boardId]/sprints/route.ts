import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { 
  createSprintSchema, 
  ApiResponse, 
  ApiError,
  Sprint,
  SprintWithTasks 
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

// GET /api/boards/[boardId]/sprints - Get all sprints for a board
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdStr } = await params;
    const boardId = parseInt(boardIdStr);
    
    if (!userId || isNaN(boardId)) {
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

    // Get sprints with task counts
    const sprintsResult = await query(`
      SELECT 
        s.*,
        COUNT(st.task_id) as task_count,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) as completed_tasks
      FROM sprints s
      LEFT JOIN sprint_tasks st ON s.id = st.sprint_id
      LEFT JOIN tasks t ON st.task_id = t.id
      WHERE s.board_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [boardId]);

    const sprints = sprintsResult.rows.map(row => ({
      ...row,
      task_count: parseInt(row.task_count),
      completed_tasks: parseInt(row.completed_tasks)
    }));

    const response: ApiResponse<typeof sprints> = {
      success: true,
      message: 'Sprints retrieved successfully',
      data: sprints,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching sprints:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST /api/boards/[boardId]/sprints - Create a new sprint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { boardId: boardIdStr } = await params;
    const boardId = parseInt(boardIdStr);
    
    if (!userId || isNaN(boardId)) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid request parameters',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const access = await checkBoardAccess(boardId, parseInt(userId), 'admin');
    if (!access) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or insufficient permissions',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createSprintSchema.parse(body);

    // Check if there's already an active sprint
    const activeSprintResult = await query(`
      SELECT id FROM sprints 
      WHERE board_id = $1 AND status = 'active'
    `, [boardId]);

    if (activeSprintResult.rows.length > 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'There is already an active sprint. Complete it before creating a new one.',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Create sprint
    const sprintResult = await query(`
      INSERT INTO sprints (board_id, name, description, start_date, end_date, goal)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      boardId,
      validatedData.name,
      validatedData.description || null,
      validatedData.start_date ? new Date(validatedData.start_date) : null,
      validatedData.end_date ? new Date(validatedData.end_date) : null,
      validatedData.goal || null
    ]);

    const sprint = sprintResult.rows[0];

    const response: ApiResponse<Sprint> = {
      success: true,
      message: 'Sprint created successfully',
      data: sprint,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating sprint:', error);
    
    if (error instanceof ZodError) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Validation failed',
        errors: error.flatten().fieldErrors,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
