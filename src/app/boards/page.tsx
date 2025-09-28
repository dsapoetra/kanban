'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Users, Calendar, BarChart3, Trash2, MoreVertical } from 'lucide-react';
import CreateBoardModal from '@/components/CreateBoardModal';
import DeleteBoardModal from '@/components/DeleteBoardModal';

interface Board {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  owner: { id: number; email: string };
}

export default function BoardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/boards', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setBoards(data.data);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error fetching boards:', error);
      setError('Failed to load boards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBoardCreated = (newBoard: Board) => {
    setBoards([newBoard, ...boards]);
  };

  const handleDeleteClick = (e: React.MouseEvent, board: Board) => {
    e.stopPropagation(); // Prevent navigation to board
    setBoardToDelete(board);
    setShowDeleteModal(true);
  };

  const handleDeleteBoard = async () => {
    if (!boardToDelete) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Remove the deleted board from the list
        setBoards(boards.filter(b => b.id !== boardToDelete.id));
        setShowDeleteModal(false);
        setBoardToDelete(null);
      } else {
        setError(data.message || 'Failed to delete board');
      }
    } catch (error) {
      console.error('Error deleting board:', error);
      setError('Failed to delete board');
    } finally {
      setIsDeleting(false);
    }
  };



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading boards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Boards</h1>
              <p className="text-gray-600">Manage your Kanban boards and projects</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Board
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Boards Grid */}
          {boards.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <BarChart3 className="w-12 h-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium">No boards yet</h3>
                <p>Create your first Kanban board to get started</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md font-medium"
              >
                Create Your First Board
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/boards/${board.id}`)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {board.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-gray-400">
                          <Users className="w-4 h-4" />
                        </div>
                        <button
                          onClick={(e) => handleDeleteClick(e, board)}
                          className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                          title="Delete board"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {board.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {board.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Owner: {board.owner?.email || 'Unknown'}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(board.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Board Modal */}
      <CreateBoardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onBoardCreated={handleBoardCreated}
      />

      {/* Delete Board Modal */}
      {boardToDelete && (
        <DeleteBoardModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setBoardToDelete(null);
          }}
          onConfirm={handleDeleteBoard}
          boardName={boardToDelete.name}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
