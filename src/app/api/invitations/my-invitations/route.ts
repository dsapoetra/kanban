import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/invitations/my-invitations
 * Get all pending invitations for the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user email from middleware headers
    const userEmail = request.headers.get('x-user-email');

    if (!userEmail) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch pending invitations for this user's email
    const invitationsQuery = `
      SELECT
        ti.*,
        b.name as board_name,
        b.description as board_description,
        inviter.email as inviter_email
      FROM team_invitations ti
      JOIN boards b ON ti.board_id = b.id
      JOIN users inviter ON ti.inviter_id = inviter.id
      WHERE ti.invitee_email = $1
        AND ti.status = 'pending'
        AND ti.expires_at > NOW()
      ORDER BY ti.created_at DESC
    `;

    const invitationsResult = await pool.query(invitationsQuery, [userEmail]);

    return NextResponse.json({
      success: true,
      message: 'Pending invitations retrieved successfully',
      data: invitationsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch pending invitations',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
