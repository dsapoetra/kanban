'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PublicUser } from '@/types/auth';
import { BarChart3, Users, Plus, Calendar, Target } from 'lucide-react';

interface Board {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  owner: { id: number; email: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
