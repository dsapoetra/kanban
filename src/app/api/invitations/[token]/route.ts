import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { ApiResponse, ApiError } from '@/types/kanban';

// GET /api/invitations/[token] - Get invitation details
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    
    if (!token) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid invitation token',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Get invitation details
    const invitationResult = await query(`
      SELECT ti.*, b.name as board_name, u.email as inviter_email
      FROM team_invitations ti
      JOIN boards b ON ti.board_id = b.id
      JOIN users u ON ti.inviter_id = u.id
      WHERE ti.token = $1 AND ti.status = 'pending'
    `, [token]);

    if (invitationResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invitation not found or already processed',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const invitation = invitationResult.rows[0];

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await query(
        'UPDATE team_invitations SET status = $1 WHERE id = $2',
        ['expired', invitation.id]
      );

      const errorResponse: ApiError = {
        success: false,
        message: 'Invitation has expired',
      };
      return NextResponse.json(errorResponse, { status: 410 });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Invitation details retrieved successfully',
      data: {
        board_name: invitation.board_name,
        inviter_email: invitation.inviter_email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST /api/invitations/[token] - Accept or decline invitation
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const userEmail = request.headers.get('x-user-email');
    const token = params.token;
    
    if (!userId || !userEmail || !token) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid request parameters',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const body = await request.json();
    const action = body.action; // 'accept' or 'decline'

    if (!action || !['accept', 'decline'].includes(action)) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invalid action. Must be "accept" or "decline"',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Get invitation details
    const invitationResult = await query(`
      SELECT * FROM team_invitations
      WHERE token = $1 AND status = 'pending' AND invitee_email = $2
    `, [token, userEmail.toLowerCase()]);

    if (invitationResult.rows.length === 0) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Invitation not found or not for this user',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const invitation = invitationResult.rows[0];

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      await query(
        'UPDATE team_invitations SET status = $1 WHERE id = $2',
        ['expired', invitation.id]
      );

      const errorResponse: ApiError = {
        success: false,
        message: 'Invitation has expired',
      };
      return NextResponse.json(errorResponse, { status: 410 });
    }

    if (action === 'accept') {
      // Check if user is already a member
      const existingMemberResult = await query(
        'SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2',
        [invitation.board_id, parseInt(userId)]
      );

      if (existingMemberResult.rows.length > 0) {
        const errorResponse: ApiError = {
          success: false,
          message: 'You are already a member of this board',
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      // Accept invitation - add user to board and update invitation status
      await transaction(async (client) => {
        // Add user to board
        await client.query(
          'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)',
          [invitation.board_id, parseInt(userId), invitation.role]
        );

        // Update invitation status
        await client.query(
          'UPDATE team_invitations SET status = $1, responded_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['accepted', invitation.id]
        );
      });

      const response: ApiResponse = {
        success: true,
        message: 'Invitation accepted successfully',
        data: { board_id: invitation.board_id },
      };

      return NextResponse.json(response, { status: 200 });
    } else {
      // Decline invitation
      await query(
        'UPDATE team_invitations SET status = $1, responded_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['declined', invitation.id]
      );

      const response: ApiResponse = {
        success: true,
        message: 'Invitation declined',
      };

      return NextResponse.json(response, { status: 200 });
    }
  } catch (error) {
    console.error('Error processing invitation:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Internal server error',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
