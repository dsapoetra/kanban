'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Mail, CheckCircle, XCircle, AlertCircle, Loader2, Shield, User, Eye } from 'lucide-react';

interface InvitationDetails {
  id: number;
  board_id: number;
  invitee_email: string;
  role: 'admin' | 'member' | 'viewer';
  expires_at: string;
  board: {
    id: number;
    name: string;
  };
  inviter: {
    id: number;
    email: string;
  };
}

export default function InvitationPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionComplete, setActionComplete] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    fetchInvitationDetails();
  }, [token]);

  const fetchInvitationDetails = async () => {
    try {
      const response = await fetch(`/api/invitations/${token}`);
      const data = await response.json();

      if (data.success) {
        setInvitation(data.data);
      } else {
        setError(data.message || 'Failed to load invitation');
      }
    } catch (error) {
      console.error('Error fetching invitation:', error);
      setError('Failed to load invitation details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      // Redirect to login with return URL
      localStorage.setItem('returnUrl', `/invitations/${token}`);
      router.push('/auth/login');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action: 'accept' }),
      });

      const data = await response.json();

      if (data.success) {
        setActionComplete('accepted');
        // Redirect to board after 2 seconds
        setTimeout(() => {
          router.push(`/boards/${invitation?.board_id}`);
        }, 2000);
      } else {
        setError(data.message || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError('Failed to accept invitation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      // Redirect to login with return URL
      localStorage.setItem('returnUrl', `/invitations/${token}`);
      router.push('/auth/login');
      return;
    }

    if (!confirm('Are you sure you want to decline this invitation?')) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action: 'decline' }),
      });

      const data = await response.json();

      if (data.success) {
        setActionComplete('declined');
        // Redirect to boards after 2 seconds
        setTimeout(() => {
          router.push('/boards');
        }, 2000);
      } else {
        setError(data.message || 'Failed to decline invitation');
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      setError('Failed to decline invitation');
    } finally {
      setIsProcessing(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-6 h-6 text-purple-600" />;
      case 'member':
        return <User className="w-6 h-6 text-blue-600" />;
      case 'viewer':
        return <Eye className="w-6 h-6 text-gray-600" />;
      default:
        return null;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Full access to manage board settings, members, and content';
      case 'member':
        return 'Can create, edit, and manage tasks on the board';
      case 'viewer':
        return 'Read-only access to view the board and tasks';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (actionComplete === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Accepted!</h2>
          <p className="text-gray-600 mb-4">
            You&apos;ve successfully joined the board. Redirecting...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (actionComplete === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Declined</h2>
          <p className="text-gray-600 mb-4">
            You&apos;ve declined the invitation. Redirecting...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 mb-6">
            {error || 'This invitation may have expired or is no longer valid.'}
          </p>
          <button
            onClick={() => router.push('/boards')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Go to Boards
          </button>
        </div>
      </div>
    );
  }

  const isExpired = new Date(invitation.expires_at) < new Date();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center">Board Invitation</h1>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {isExpired && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>This invitation has expired</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Invitation Details */}
            <div>
              <p className="text-gray-600 mb-4">
                <span className="font-semibold text-gray-900">{invitation.inviter.email}</span>
                {' '}has invited you to join:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-1">{invitation.board.name}</h2>
                <p className="text-sm text-gray-600">Board ID: {invitation.board_id}</p>
              </div>
            </div>

            {/* Role Information */}
            <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {getRoleIcon(invitation.role)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)} Role
                  </h3>
                  <p className="text-sm text-gray-600">
                    {getRoleDescription(invitation.role)}
                  </p>
                </div>
              </div>
            </div>

            {/* Expiration Info */}
            <div className="text-sm text-gray-500 text-center">
              {isExpired ? (
                <span className="text-red-600">Expired on {new Date(invitation.expires_at).toLocaleDateString()}</span>
              ) : (
                <span>Expires on {new Date(invitation.expires_at).toLocaleDateString()} at {new Date(invitation.expires_at).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isExpired && (
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex gap-4">
            <button
              onClick={handleDecline}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 font-medium"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {isProcessing && <Loader2 className="w-5 h-5 animate-spin" />}
              Accept Invitation
            </button>
          </div>
        )}

        {isExpired && (
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
            <button
              onClick={() => router.push('/boards')}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
            >
              Go to Boards
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
