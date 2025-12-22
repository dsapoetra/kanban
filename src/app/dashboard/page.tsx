'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PublicUser } from '@/types/auth';
import { BarChart3, Users, Plus, Calendar, Target, Mail, Check, X } from 'lucide-react';

interface Board {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  owner: { id: number; email: string };
}

interface PendingInvitation {
  id: number;
  board_id: number;
  board_name: string;
  board_description?: string;
  inviter_id: number;
  inviter_email: string;
  invitee_email: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingInvitation, setProcessingInvitation] = useState<number | null>(null);

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!userData || !token) {
      router.push('/auth/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchRecentBoards(token);
      fetchPendingInvitations(token);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/auth/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const fetchRecentBoards = async (token: string) => {
    try {
      const response = await fetch('/api/boards', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Show only the 3 most recent boards
          setBoards(data.data.slice(0, 3));
        }
      }
    } catch (error) {
      console.error('Error fetching boards:', error);
    }
  };

  const fetchPendingInvitations = async (token: string) => {
    try {
      const response = await fetch('/api/invitations/my-invitations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPendingInvitations(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
    }
  };

  const handleInvitationResponse = async (token: string, action: 'accept' | 'decline') => {
    const authToken = localStorage.getItem('token');
    if (!authToken) return;

    const invitation = pendingInvitations.find(inv => inv.token === token);
    if (!invitation) return;

    setProcessingInvitation(invitation.id);

    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        // Remove the invitation from the list
        setPendingInvitations(prev => prev.filter(inv => inv.token !== token));

        if (action === 'accept') {
          // Refresh boards to show the newly accessible board
          fetchRecentBoards(authToken);
          // Optionally redirect to the board
          // router.push(`/boards/${invitation.board_id}`);
        }
      } else {
        const data = await response.json();
        alert(data.message || `Failed to ${action} invitation`);
      }
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error);
      alert(`Failed to ${action} invitation`);
    } finally {
      setProcessingInvitation(null);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {user.email.split('@')[0]}!
            </h1>
            <p className="text-gray-600">
              Here&apos;s what&apos;s happening with your projects today.
            </p>
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Mail className="h-6 w-6 text-blue-600 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Pending Invitations ({pendingInvitations.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 mb-1">
                            {invitation.board_name}
                          </h3>
                          {invitation.board_description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {invitation.board_description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>
                              Invited by: <span className="font-medium text-gray-700">{invitation.inviter_email}</span>
                            </span>
                            <span>
                              Role: <span className="font-medium text-gray-700 capitalize">{invitation.role}</span>
                            </span>
                            <span>
                              Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleInvitationResponse(invitation.token, 'accept')}
                            disabled={processingInvitation === invitation.id}
                            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md text-sm font-medium transition-colors"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleInvitationResponse(invitation.token, 'decline')}
                            disabled={processingInvitation === invitation.id}
                            className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Link
              href="/boards"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">My Boards</h3>
                  <p className="text-sm text-gray-500">View all boards</p>
                </div>
              </div>
            </Link>

            <Link
              href="/boards?action=create"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Plus className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">New Board</h3>
                  <p className="text-sm text-gray-500">Create board</p>
                </div>
              </div>
            </Link>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Team</h3>
                  <p className="text-sm text-gray-500">Collaborate</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Sprints</h3>
                  <p className="text-sm text-gray-500">Manage sprints</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Boards */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Boards</h2>
              <Link
                href="/boards"
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                View all →
              </Link>
            </div>

            {boards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {boards.map((board) => (
                  <Link
                    key={board.id}
                    href={`/boards/${board.id}`}
                    className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
                  >
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {board.name}
                    </h3>
                    {board.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {board.description}
                      </p>
                    )}
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(board.updated_at).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-lg shadow border border-gray-200 text-center">
                <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No boards yet</h3>
                <p className="text-gray-600 mb-4">Create your first Kanban board to get started</p>
                <Link
                  href="/boards"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Create Your First Board
                </Link>
              </div>
            )}
          </div>

          {/* Account Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Account Information
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Email:</dt>
                <dd className="text-sm text-gray-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">User ID:</dt>
                <dd className="text-sm text-gray-900">{user.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Member since:</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(user.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
