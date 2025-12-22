import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { 
  inviteTeamMemberSchema, 
  ApiResponse, 
  ApiError,
  TeamInvitation
} from '@/types/kanban';
import { ZodError } from 'zod';
import crypto from 'crypto';

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

// POST /api/boards/[boardId]/members - Invite a team member
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

    const hasAccess = await checkBoardAdminAccess(boardId, parseInt(userId));
    if (!hasAccess) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or insufficient permissions',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const body = await request.json();
    const validatedData = inviteTeamMemberSchema.parse(body);

    // Check if user is already a member or has pending invitation
    const existingResult = await query(`
      SELECT 1 FROM board_members bm
      JOIN users u ON bm.user_id = u.id
      WHERE bm.board_id = $1 AND u.email = $2
      UNION
      SELECT 1 FROM team_invitations
      WHERE board_id = $1 AND invitee_email = $2 AND status = 'pending'
    `, [boardId, validatedData.email.toLowerCase()]);

    if (existingResult.rows.length > 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'User is already a member or has a pending invitation',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create invitation
    const invitationResult = await query(`
      INSERT INTO team_invitations (board_id, inviter_id, invitee_email, role, token, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [boardId, parseInt(userId), validatedData.email.toLowerCase(), validatedData.role, token, expiresAt]);

    const invitation = invitationResult.rows[0];

    // TODO: Send email invitation (implement email service)
    console.log(`Invitation sent to ${validatedData.email} for board ${boardId} with token ${token}`);

    const response: ApiResponse<TeamInvitation> = {
      success: true,
      message: 'Team member invited successfully',
      data: invitation,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error inviting team member:', error);
    
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

// GET /api/boards/[boardId]/members - Get board members and pending invitations
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

    // Check if user has access to board
    const accessResult = await query(`
      SELECT 1 FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id
      WHERE b.id = $1 AND (b.owner_id = $2 OR bm.user_id = $2)
    `, [boardId, parseInt(userId)]);

    if (accessResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Board not found or access denied',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Get members and pending invitations
    const [membersResult, invitationsResult] = await Promise.all([
      query(`
        SELECT bm.id, bm.board_id, bm.user_id, bm.role, bm.joined_at,
               json_build_object('id', u.id, 'email', u.email) as user
        FROM board_members bm
        JOIN users u ON bm.user_id = u.id
        WHERE bm.board_id = $1
        ORDER BY bm.joined_at ASC
      `, [boardId]),
      query(`
        SELECT ti.id, ti.board_id, ti.inviter_id, ti.invitee_email,
               ti.role, ti.token, ti.status, ti.created_at, ti.expires_at,
               json_build_object('id', u.id, 'email', u.email) as inviter
        FROM team_invitations ti
        JOIN users u ON ti.inviter_id = u.id
        WHERE ti.board_id = $1 AND ti.status = 'pending' AND ti.expires_at > CURRENT_TIMESTAMP
        ORDER BY ti.created_at DESC
      `, [boardId])
    ]);

    const response: ApiResponse = {
      success: true,
      message: 'Board members retrieved successfully',
      data: {
        members: membersResult.rows,
        invitations: invitationsResult.rows,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching board members:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
