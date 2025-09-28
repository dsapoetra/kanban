import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { 
  updateMemberRoleSchema, 
  ApiResponse, 
  ApiError 
} from '@/types/kanban';
import { ZodError } from 'zod';

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

// PUT /api/boards/[boardId]/members/[memberId] - Update member role
export async function PUT(
  request: NextRequest,
  { params }: { params: { boardId: string; memberId: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const boardId = parseInt(params.boardId);
    const memberId = parseInt(params.memberId);
    
    if (!userId || isNaN(boardId) || isNaN(memberId)) {
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
    const validatedData = updateMemberRoleSchema.parse(body);

    // Check if member exists and is not the board owner
    const memberResult = await query(`
      SELECT bm.*, b.owner_id
      FROM board_members bm
      JOIN boards b ON bm.board_id = b.id
      WHERE bm.id = $1 AND bm.board_id = $2
    `, [memberId, boardId]);

    if (memberResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Member not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const member = memberResult.rows[0];

    // Prevent changing role of board owner
    if (member.user_id === member.owner_id) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Cannot change role of board owner',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Update member role
    const updateResult = await query(`
      UPDATE board_members 
      SET role = $1
      WHERE id = $2 AND board_id = $3
      RETURNING *
    `, [validatedData.role, memberId, boardId]);

    const response: ApiResponse = {
      success: true,
      message: 'Member role updated successfully',
      data: updateResult.rows[0],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error updating member role:', error);
    
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

// DELETE /api/boards/[boardId]/members/[memberId] - Remove member from board
export async function DELETE(
  request: NextRequest,
  { params }: { params: { boardId: string; memberId: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const boardId = parseInt(params.boardId);
    const memberId = parseInt(params.memberId);
    
    if (!userId || isNaN(boardId) || isNaN(memberId)) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid request parameters',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Check if member exists
    const memberResult = await query(`
      SELECT bm.*, b.owner_id
      FROM board_members bm
      JOIN boards b ON bm.board_id = b.id
      WHERE bm.id = $1 AND bm.board_id = $2
    `, [memberId, boardId]);

    if (memberResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Member not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const member = memberResult.rows[0];

    // Check permissions: admin can remove anyone, users can remove themselves
    const hasAdminAccess = await checkBoardAdminAccess(boardId, parseInt(userId));
    const isSelfRemoval = member.user_id === parseInt(userId);

    if (!hasAdminAccess && !isSelfRemoval) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Insufficient permissions',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // Prevent removing board owner
    if (member.user_id === member.owner_id) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Cannot remove board owner',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Remove member
    await query('DELETE FROM board_members WHERE id = $1', [memberId]);

    const response: ApiResponse = {
      success: true,
      message: 'Member removed successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error removing member:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
