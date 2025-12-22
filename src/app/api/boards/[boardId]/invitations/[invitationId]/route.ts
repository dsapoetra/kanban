import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/database';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; invitationId: string }> }
) {
  const { boardId: boardIdStr, invitationId: invitationIdStr } = await params;
  const boardId = parseInt(boardIdStr);
  const invitationId = parseInt(invitationIdStr);
  const userId = parseInt(request.headers.get('x-user-id') || '0');

  if (!userId) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (isNaN(boardId) || isNaN(invitationId)) {
    return NextResponse.json(
      { success: false, message: 'Invalid board or invitation ID' },
      { status: 400 }
    );
  }

  try {
    await transaction(async (client) => {
      // Check if user is owner or admin
      const boardCheckQuery = `
        SELECT
          b.owner_id,
          bm.role
        FROM boards b
        LEFT JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $1
        WHERE b.id = $2
      `;
      const boardCheckResult = await client.query(boardCheckQuery, [userId, boardId]);

      if (boardCheckResult.rows.length === 0) {
        throw new Error('Board not found');
      }

      const { owner_id, role } = boardCheckResult.rows[0];
      const isOwner = owner_id === userId;
      const isAdmin = role === 'admin';

      if (!isOwner && !isAdmin) {
        throw new Error('Only board admins can cancel invitations');
      }

      // Verify invitation belongs to this board and delete it
      const deleteQuery = `
        DELETE FROM team_invitations
        WHERE id = $1 AND board_id = $2 AND status = 'pending'
        RETURNING id
      `;
      const deleteResult = await client.query(deleteQuery, [invitationId, boardId]);

      if (deleteResult.rows.length === 0) {
        throw new Error('Invitation not found or already processed');
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel invitation';
    const status = message.includes('not found') ? 404 : message.includes('admins') ? 403 : 500;

    return NextResponse.json(
      { success: false, message },
      { status }
    );
  }
}
