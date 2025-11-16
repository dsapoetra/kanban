'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Play,
  CheckCircle,
  Calendar,
  Target,
  Clock,
  X,
  AlertCircle
} from 'lucide-react';
import { SprintWithTasks, TaskWithDetails, SprintCompletionStats } from '@/types/kanban';
import CompleteSprintModal from '@/components/CompleteSprintModal';
import SprintCompletedModal from '@/components/SprintCompletedModal';

interface BacklogTask extends TaskWithDetails {
  selected?: boolean;
}

export default function SprintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = parseInt(params.boardId as string);
  const sprintId = parseInt(params.sprintId as string);

  const [sprint, setSprint] = useState<SprintWithTasks | null>(null);
  const [backlogTasks, setBacklogTasks] = useState<BacklogTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddTasksModal, setShowAddTasksModal] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [isCompletingSprint, setIsCompletingSprint] = useState(false);
  const [completionStats, setCompletionStats] = useState<SprintCompletionStats | null>(null);
  const [isAddingTasks, setIsAddingTasks] = useState(false);

  useEffect(() => {
    if (boardId && sprintId) {
      fetchSprintData();
    }
  }, [boardId, sprintId]);

  const fetchSprintData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`/api/boards/${boardId}/sprints/${sprintId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setSprint(data.data);
      } else {
        setError(data.message || 'Failed to load sprint');
      }
    } catch (error) {
      console.error('Error fetching sprint:', error);
      setError('Failed to load sprint');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBacklogTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/backlog`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setBacklogTasks(data.data.tasks);
      }
    } catch (error) {
      console.error('Error fetching backlog:', error);
    }
  };

  const handleAddTasksClick = async () => {
    await fetchBacklogTasks();
    setShowAddTasksModal(true);
    setSelectedTaskIds([]);
  };

  const handleToggleTask = (taskId: number) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleAddTasks = async () => {
    if (selectedTaskIds.length === 0) return;

    setIsAddingTasks(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints/${sprintId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ task_ids: selectedTaskIds }),
      });

      const data = await response.json();
      if (data.success) {
        setShowAddTasksModal(false);
        setSelectedTaskIds([]);
        await fetchSprintData();
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error adding tasks:', error);
      setError('Failed to add tasks to sprint');
    } finally {
      setIsAddingTasks(false);
    }
  };

  const handleRemoveTask = async (taskId: number) => {
    if (!confirm('Remove this task from the sprint?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints/${sprintId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchSprintData();
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error removing task:', error);
      setError('Failed to remove task');
    }
  };

  const handleStartSprint = async () => {
    if (!confirm('Start this sprint? It will become the active sprint.')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints/${sprintId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        router.push(`/boards/${boardId}/sprints`);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error starting sprint:', error);
      setError('Failed to start sprint');
    }
  };

  const handleCompleteSprintClick = () => {
    if (!sprint) return;
    setShowCompleteModal(true);
  };

  const handleConfirmComplete = async () => {
    if (!sprint) return;

    setIsCompletingSprint(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints/${sprintId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ move_incomplete_tasks_to_backlog: true }),
      });

      const data = await response.json();
      if (data.success) {
        setCompletionStats(data.data.statistics);
        setShowCompleteModal(false);
        setShowCompletedModal(true);
      } else {
        setError(data.message);
        setShowCompleteModal(false);
      }
    } catch (error) {
      console.error('Error completing sprint:', error);
      setError('Failed to complete sprint');
      setShowCompleteModal(false);
    } finally {
      setIsCompletingSprint(false);
    }
  };

  const handleCloseCompletedModal = () => {
    setShowCompletedModal(false);
    setCompletionStats(null);
    router.push(`/boards/${boardId}/sprints`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">Active</span>;
      case 'planning':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">Planning</span>;
      case 'completed':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-800">Completed</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading sprint...</div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sprint not found</h2>
          <button
            onClick={() => router.push(`/boards/${boardId}/sprints`)}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Back to Sprints
          </button>
        </div>
      </div>
    );
  }

  const completedTasks = sprint.tasks.filter(t => t.completed_at).length;
  const totalTasks = sprint.tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/boards/${boardId}/sprints`)}
                className="text-gray-600 hover:text-gray-900 p-1 rounded"
                title="Back to Sprints"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{sprint.name}</h1>
                  {getStatusBadge(sprint.status)}
                </div>
                {sprint.description && (
                  <p className="text-sm text-gray-600 mt-1">{sprint.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sprint.status === 'planning' && (
                <>
                  <button
                    onClick={handleAddTasksClick}
                    className="text-indigo-600 hover:text-indigo-800 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Tasks
                  </button>
                  <button
                    onClick={handleStartSprint}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                    disabled={totalTasks === 0}
                  >
                    <Play className="w-4 h-4" />
                    Start Sprint
                  </button>
                </>
              )}
              {sprint.status === 'active' && (
                <button
                  onClick={handleCompleteSprintClick}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Sprint
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Sprint Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sprint Goal */}
            {sprint.goal && (
              <div className="md:col-span-3">
                <div className="flex items-start gap-2">
                  <Target className="w-5 h-5 text-indigo-600 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Sprint Goal</h3>
                    <p className="text-gray-900 mt-1">{sprint.goal}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dates */}
            <div>
              <div className="flex items-start gap-2">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Duration</h3>
                  <div className="text-sm text-gray-900 mt-1 space-y-1">
                    {sprint.start_date && (
                      <div>Start: {new Date(sprint.start_date).toLocaleDateString()}</div>
                    )}
                    {sprint.end_date && (
                      <div>End: {new Date(sprint.end_date).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-700">Progress</h3>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-900">{completedTasks} of {totalTasks} tasks</span>
                      <span className="font-medium text-gray-900">{completionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Sprint Tasks</h2>
            {sprint.status === 'planning' && (
              <button
                onClick={handleAddTasksClick}
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Tasks
              </button>
            )}
          </div>

          {sprint.tasks.length > 0 ? (
            <div className="space-y-2">
              {sprint.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-medium text-gray-900 ${task.completed_at ? 'line-through' : ''}`}>
                        {task.title}
                      </h3>
                      {task.completed_at && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                      <span className="text-gray-600">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1"
                          style={{ backgroundColor: task.column.color }}
                        />
                        {task.column.name}
                      </span>
                      {task.assignee && (
                        <span className="text-gray-600">
                          Assigned to: {task.assignee.email}
                        </span>
                      )}
                      {task.due_date && (
                        <span className={`flex items-center gap-1 ${
                          new Date(task.due_date) < new Date() && !task.completed_at
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {sprint.status === 'planning' && (
                    <button
                      onClick={() => handleRemoveTask(task.id)}
                      className="text-red-600 hover:text-red-800 p-2 rounded"
                      title="Remove from sprint"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="mb-2">No tasks in this sprint yet</p>
              {sprint.status === 'planning' && (
                <button
                  onClick={handleAddTasksClick}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  Add tasks from backlog
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Tasks Modal */}
      {showAddTasksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Add Tasks to Sprint</h2>
              <button
                onClick={() => setShowAddTasksModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {backlogTasks.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-4">
                    Select tasks from the backlog to add to this sprint
                  </p>
                  {backlogTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTaskIds.includes(task.id)
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => handleToggleTask(task.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.id)}
                        onChange={() => handleToggleTask(task.id)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{task.title}</h3>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                            task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                          {task.assignee && (
                            <span className="text-gray-600">{task.assignee.email}</span>
                          )}
                          {task.due_date && (
                            <span className={`flex items-center gap-1 ${
                              new Date(task.due_date) < new Date()
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No tasks available in backlog</p>
                  <p className="text-sm mt-1">All tasks are already assigned to sprints</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-6 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddTasksModal(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isAddingTasks}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTasks}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  disabled={selectedTaskIds.length === 0 || isAddingTasks}
                >
                  {isAddingTasks ? 'Adding...' : `Add ${selectedTaskIds.length} Task${selectedTaskIds.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Sprint Modal */}
      {sprint && (
        <CompleteSprintModal
          isOpen={showCompleteModal}
          sprintName={sprint.name}
          totalTasks={sprint.tasks.length}
          completedTasks={sprint.tasks.filter(t => t.completed_at).length}
          incompleteTasks={sprint.tasks.filter(t => !t.completed_at).length}
          onConfirm={handleConfirmComplete}
          onCancel={() => setShowCompleteModal(false)}
          isLoading={isCompletingSprint}
        />
      )}

      {/* Sprint Completed Modal */}
      {completionStats && (
        <SprintCompletedModal
          isOpen={showCompletedModal}
          sprintName={sprint?.name || ''}
          completedTasks={completionStats.completedTasks}
          incompleteTasks={completionStats.incompleteTasks}
          completionRate={Math.round((completionStats.completedTasks / completionStats.totalTasks) * 100)}
          onClose={handleCloseCompletedModal}
        />
      )}
    </div>
  );
}
