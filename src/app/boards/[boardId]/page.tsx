'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  Settings,
  Users,
  BarChart3,
  Target,
  Columns,
  Trash2
} from 'lucide-react';
import KanbanColumn from '@/components/KanbanColumn';
import TaskModal from '@/components/TaskModal';
import ColumnManager from '@/components/ColumnManager';
import TaskFilter from '@/components/TaskFilter';
import DeleteBoardModal from '@/components/DeleteBoardModal';
import { ColumnWithTasks, TaskWithDetails, Sprint } from '@/types/kanban';

interface BoardDetails {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  owner: { id: number; email: string };
  members: Array<{
    id: number;
    board_id: number;
    user_id: number;
    role: string;
    joined_at: string;
    user: { id: number; email: string };
  }>;
  columns: Array<{
    id: number;
    board_id: number;
    name: string;
    position: number;
    color: string;
    created_at: string;
    updated_at: string;
  }>;
}

export default function BoardPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = parseInt(params.boardId as string);

  const [board, setBoard] = useState<BoardDetails | null>(null);
  const [columns, setColumns] = useState<ColumnWithTasks[]>([]);
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (boardId) {
      fetchBoardData();
    }
  }, [boardId]);

  // Re-organize tasks when filter changes
  useEffect(() => {
    if (board && tasks.length > 0) {
      organizeTasks();
    }
  }, [selectedAssignee, board, tasks]);

  const organizeTasks = () => {
    if (!board) return;

    // Organize tasks by columns with filtering
    const columnsWithTasks = board.columns.map((column) => {
      let columnTasks = tasks.filter((task: TaskWithDetails) => task.column_id === column.id);

      // Apply assignee filter
      if (selectedAssignee !== null) {
        if (selectedAssignee === -1) {
          // Show unassigned tasks
          columnTasks = columnTasks.filter((task: TaskWithDetails) => !task.assignee_id);
        } else {
          // Show tasks assigned to specific user
          columnTasks = columnTasks.filter((task: TaskWithDetails) => task.assignee_id === selectedAssignee);
        }
      }

      return {
        ...column,
        tasks: columnTasks.sort((a: TaskWithDetails, b: TaskWithDetails) => a.position - b.position),
      };
    });

    setColumns(columnsWithTasks as unknown as ColumnWithTasks[]);
  };

  const fetchBoardData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // Fetch board details, tasks, and sprints in parallel
      const [boardResponse, tasksResponse, sprintsResponse] = await Promise.all([
        fetch(`/api/boards/${boardId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/boards/${boardId}/tasks`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/boards/${boardId}/sprints`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (boardResponse.status === 401 || tasksResponse.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
        return;
      }

      const [boardData, tasksData, sprintsData] = await Promise.all([
        boardResponse.json(),
        tasksResponse.json(),
        sprintsResponse.json(),
      ]);

      if (boardData.success && tasksData.success) {
        setBoard(boardData.data);
        setTasks(tasksData.data);

        // Find active sprint
        if (sprintsData.success) {
          const active = sprintsData.data.find((s: Sprint) => s.status === 'active');
          setActiveSprint(active || null);
        }

        // organizeTasks will be called by the useEffect
      } else {
        setError(boardData.message || tasksData.message || 'Failed to load board');
      }
    } catch (error) {
      console.error('Error fetching board data:', error);
      setError('Failed to load board data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as number;
    const overId = over.id;

    // Find the task being moved
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Determine target column and position
    let targetColumnId: number;
    let targetPosition: number;

    if (typeof overId === 'string' && overId.startsWith('column-')) {
      // Dropped on empty column
      targetColumnId = parseInt(overId.replace('column-', ''));
      targetPosition = 0;
    } else {
      // Dropped on another task
      const targetTask = tasks.find(t => t.id === overId);
      if (!targetTask) return;
      
      targetColumnId = targetTask.column_id;
      targetPosition = targetTask.position;
    }

    // Don't move if it's the same position
    if (task.column_id === targetColumnId && task.position === targetPosition) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/tasks/${taskId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          column_id: targetColumnId,
          position: targetPosition,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Refresh board data to get updated positions
        await fetchBoardData();
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error moving task:', error);
      setError('Failed to move task');
    }
  };

  const handleTaskClick = (task: TaskWithDetails) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleCreateTask = (columnId: number) => {
    setSelectedTask({
      id: 0, // Temporary ID for new task
      title: '',
      description: '',
      column_id: columnId,
      board_id: boardId,
      assignee_id: undefined,
      creator_id: 0,
      priority: 'medium',
      position: 0,
      due_date: undefined,
      completed_at: undefined,
      created_at: new Date(),
      updated_at: new Date(),
      creator: { id: 0, email: '' },
      column: columns.find(c => c.id === columnId)!
    } as TaskWithDetails);
    setShowTaskModal(true);
  };

  const handleTaskSave = async () => {
    // Refresh board data after task save
    await fetchBoardData();
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  const handleDeleteBoard = async () => {
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Redirect to boards page after successful deletion
        router.push('/boards');
      } else {
        setError(data.message || 'Failed to delete board');
        setShowDeleteModal(false);
      }
    } catch (error) {
      console.error('Error deleting board:', error);
      setError('Failed to delete board');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Board not found</h2>
          <button
            onClick={() => router.push('/boards')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Back to Boards
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Board Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{board.name}</h1>
                {board.description && (
                  <p className="text-sm text-gray-600">{board.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Task Filter */}
              {board && (
                <TaskFilter
                  members={board.members}
                  selectedAssignee={selectedAssignee}
                  onAssigneeChange={setSelectedAssignee}
                  totalTasks={tasks.length}
                  visibleTasks={columns.reduce((sum, col) => sum + col.tasks.length, 0)}
                />
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push(`/boards/${boardId}/analytics`)}
                  className="text-gray-700 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                  title="Analytics"
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
              <button
                onClick={() => router.push(`/boards/${boardId}/sprints`)}
                className="text-gray-700 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                title="Sprints"
              >
                <Target className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push(`/boards/${boardId}/members`)}
                className="text-gray-700 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                title="Members"
              >
                <Users className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowColumnManager(true)}
                className="text-gray-700 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                title="Manage Columns"
              >
                <Columns className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push(`/boards/${boardId}/settings`)}
                className="text-gray-700 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-red-600 hover:text-red-800 p-2 rounded-md hover:bg-red-50"
                title="Delete Board"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sprint Banner */}
      {activeSprint && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Active Sprint:</span>
                    <span>{activeSprint.name}</span>
                  </div>
                  {activeSprint.end_date && (
                    <div className="text-sm text-indigo-100">
                      Due: {new Date(activeSprint.end_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => router.push(`/boards/${boardId}/sprints`)}
                className="text-white hover:text-indigo-100 text-sm font-medium underline"
              >
                Manage Sprints
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-6">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                onTaskClick={handleTaskClick}
                onCreateTask={handleCreateTask}
              />
            ))}
          </div>
        </DndContext>
      </main>

      {/* Task Modal */}
      {showTaskModal && selectedTask && (
        <TaskModal
          task={selectedTask}
          boardId={boardId}
          columns={columns}
          members={board.members}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
          onSave={handleTaskSave}
        />
      )}

      {/* Column Manager Modal */}
      <ColumnManager
        boardId={boardId}
        isOpen={showColumnManager}
        onClose={() => setShowColumnManager(false)}
        onColumnsUpdated={fetchBoardData}
      />

      {/* Delete Board Modal */}
      {board && (
        <DeleteBoardModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteBoard}
          boardName={board.name}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
