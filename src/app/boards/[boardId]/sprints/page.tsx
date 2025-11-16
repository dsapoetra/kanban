'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  ArrowLeft,
  Plus,
  Play,
  CheckCircle,
  Calendar,
  Target,
  Clock,
  AlertCircle,
  ListTodo,
  MoreVertical,
  X,
  GripVertical
} from 'lucide-react';
import { Sprint, SprintWithTasks, TaskWithDetails, SprintCompletionStats } from '@/types/kanban';
import CompleteSprintModal from '@/components/CompleteSprintModal';
import SprintCompletedModal from '@/components/SprintCompletedModal';

interface BacklogData {
  tasks: TaskWithDetails[];
  statistics: {
    total_tasks: number;
    urgent_tasks: number;
    high_priority_tasks: number;
    overdue_tasks: number;
  };
}

export default function SprintsPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = parseInt(params.boardId as string);

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<SprintWithTasks | null>(null);
  const [backlog, setBacklog] = useState<BacklogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [isCompletingSprint, setIsCompletingSprint] = useState(false);
  const [completionStats, setCompletionStats] = useState<SprintCompletionStats | null>(null);
  const [openTaskMenu, setOpenTaskMenu] = useState<number | null>(null);
  const [isAddingTaskToSprint, setIsAddingTaskToSprint] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  useEffect(() => {
    if (boardId) {
      fetchSprintData();
    }
  }, [boardId]);

  const fetchSprintData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // Fetch sprints and backlog in parallel
      const [sprintsResponse, backlogResponse] = await Promise.all([
        fetch(`/api/boards/${boardId}/sprints`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/boards/${boardId}/backlog`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (sprintsResponse.status === 401 || backlogResponse.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
        return;
      }

      const [sprintsData, backlogData] = await Promise.all([
        sprintsResponse.json(),
        backlogResponse.json(),
      ]);

      if (sprintsData.success && backlogData.success) {
        setSprints(sprintsData.data);
        setBacklog(backlogData.data);
        
        // Find active sprint and fetch its details
        const active = sprintsData.data.find((s: Sprint) => s.status === 'active');
        if (active) {
          await fetchSprintDetails(active.id);
        }
      } else {
        setError(sprintsData.message || backlogData.message || 'Failed to load sprint data');
      }
    } catch (error) {
      console.error('Error fetching sprint data:', error);
      setError('Failed to load sprint data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSprintDetails = async (sprintId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints/${sprintId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setActiveSprint(data.data);
      }
    } catch (error) {
      console.error('Error fetching sprint details:', error);
    }
  };

  const handleCreateSprint = () => {
    setShowCreateModal(true);
  };

  const handleViewSprint = (sprint: Sprint) => {
    router.push(`/boards/${boardId}/sprints/${sprint.id}`);
  };

  const handleStartSprint = async (sprintId: number) => {
    if (!confirm('Are you sure you want to start this sprint?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints/${sprintId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchSprintData();
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error starting sprint:', error);
      setError('Failed to start sprint');
    }
  };

  const handleCompleteSprintClick = () => {
    if (!activeSprint) return;
    setShowCompleteModal(true);
  };

  const handleAddTaskToSprint = async (taskId: number, sprintId: number, sprintName: string) => {
    setIsAddingTaskToSprint(true);
    setOpenTaskMenu(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints/${sprintId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ task_ids: [taskId] }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccessMessage(`Task added to "${sprintName}"`);
        setTimeout(() => setSuccessMessage(null), 3000);
        await fetchSprintData();
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error adding task to sprint:', error);
      setError('Failed to add task to sprint');
    } finally {
      setIsAddingTaskToSprint(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as number;
    const task = backlog?.tasks.find(t => t.id === taskId);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as number;
    const sprintId = over.id as number;

    // Find sprint name for success message
    let sprintName = '';
    if (activeSprint && activeSprint.id === sprintId) {
      sprintName = activeSprint.name;
    } else {
      const sprint = planningSprints.find(s => s.id === sprintId);
      if (sprint) sprintName = sprint.name;
    }

    if (sprintName) {
      await handleAddTaskToSprint(taskId, sprintId, sprintName);
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  const handleConfirmComplete = async () => {
    if (!activeSprint) return;

    setIsCompletingSprint(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints/${activeSprint.id}/complete`, {
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
        await fetchSprintData();
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

  const getSprintStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active</span>;
      case 'planning':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Planning</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Completed</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading sprints...</div>
      </div>
    );
  }

  const planningSprints = sprints.filter(s => s.status === 'planning');
  const completedSprints = sprints.filter(s => s.status === 'completed');

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/boards/${boardId}`)}
                className="text-gray-600 hover:text-gray-900 p-1 rounded"
                title="Back to Board"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sprint Management</h1>
                <p className="text-sm text-gray-600">Manage your sprints and backlog</p>
              </div>
            </div>
            <button
              onClick={handleCreateSprint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Sprint
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Active Sprint */}
        {activeSprint && (
          <DroppableSprint sprint={activeSprint}>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900">Active Sprint</h2>
                {getSprintStatusBadge(activeSprint.status)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/boards/${boardId}`)}
                  className="text-indigo-600 hover:text-indigo-800 px-3 py-2 rounded-md text-sm font-medium"
                >
                  View on Board
                </button>
                <button
                  onClick={handleCompleteSprintClick}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Sprint
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900">{activeSprint.name}</h3>
              {activeSprint.description && (
                <p className="text-gray-600">{activeSprint.description}</p>
              )}
              {activeSprint.goal && (
                <div className="flex items-start gap-2 text-sm">
                  <Target className="w-4 h-4 text-gray-500 mt-0.5" />
                  <span className="text-gray-700"><strong>Goal:</strong> {activeSprint.goal}</span>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {activeSprint.start_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Started: {new Date(activeSprint.start_date).toLocaleDateString()}</span>
                  </div>
                )}
                {activeSprint.end_date && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Due: {new Date(activeSprint.end_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-700">
                    <strong>{activeSprint.tasks.length}</strong> tasks
                  </span>
                  <span className="text-gray-700">
                    <strong>{activeSprint.tasks.filter(t => t.completed_at).length}</strong> completed
                  </span>
                </div>
              </div>
            </div>
          </div>
          </DroppableSprint>
        )}

        {/* Backlog */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ListTodo className="w-6 h-6 text-indigo-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Backlog</h2>
                <p className="text-xs text-gray-500">Tasks not assigned to any sprint</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {backlog && (
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span><strong>{backlog.statistics.total_tasks}</strong> tasks</span>
                  {backlog.statistics.urgent_tasks > 0 && (
                    <span className="text-red-600">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      <strong>{backlog.statistics.urgent_tasks}</strong> urgent
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowCreateTaskModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Task
              </button>
            </div>
          </div>

          {backlog && backlog.tasks.length > 0 ? (
            <div className="space-y-2">
              <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3 mb-3">
                <p className="text-sm text-indigo-900">
                  <strong>💡 Tip:</strong> The backlog contains all tasks that aren&apos;t in any sprint.
                  Create a sprint and add tasks from here to start working on them.
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {backlog.tasks.slice(0, 10).map((task) => (
                  <DraggableTask
                    key={task.id}
                    task={task}
                    openTaskMenu={openTaskMenu}
                    setOpenTaskMenu={setOpenTaskMenu}
                    isAddingTaskToSprint={isAddingTaskToSprint}
                    activeSprint={activeSprint}
                    planningSprints={planningSprints}
                    handleAddTaskToSprint={handleAddTaskToSprint}
                  />
                ))}
                {backlog.tasks.length > 10 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    And {backlog.tasks.length - 10} more tasks...
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ListTodo className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No tasks in backlog</p>
              <p className="text-sm">All tasks are assigned to sprints</p>
            </div>
          )}
        </div>

        {/* Planning Sprints */}
        {planningSprints.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Planning Sprints</h2>
            </div>

            <div className="space-y-3">
              {planningSprints.map((sprint) => (
                <DroppableSprint key={sprint.id} sprint={sprint}>
                  <div className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{sprint.name}</h3>
                        {getSprintStatusBadge(sprint.status)}
                      </div>
                      {sprint.description && (
                        <p className="text-sm text-gray-600 mb-2">{sprint.description}</p>
                      )}
                      {sprint.goal && (
                        <div className="flex items-start gap-2 text-sm mb-2">
                          <Target className="w-4 h-4 text-gray-500 mt-0.5" />
                          <span className="text-gray-700">{sprint.goal}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {sprint.start_date && (
                          <span>Start: {new Date(sprint.start_date).toLocaleDateString()}</span>
                        )}
                        {sprint.end_date && (
                          <span>End: {new Date(sprint.end_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleViewSprint(sprint)}
                        className="text-indigo-600 hover:text-indigo-800 px-3 py-2 rounded-md text-sm font-medium"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleStartSprint(sprint.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start Sprint
                      </button>
                    </div>
                  </div>
                </div>
                </DroppableSprint>
              ))}
            </div>
          </div>
        )}

        {/* Completed Sprints */}
        {completedSprints.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Completed Sprints</h2>
            </div>

            <div className="space-y-2">
              {completedSprints.slice(0, 5).map((sprint) => (
                <div
                  key={sprint.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewSprint(sprint)}
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{sprint.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                      {sprint.end_date && (
                        <span>Completed: {new Date(sprint.end_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {getSprintStatusBadge(sprint.status)}
                </div>
              ))}
              {completedSprints.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  And {completedSprints.length - 5} more completed sprints...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {sprints.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Target className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sprints yet</h3>
            <p className="text-gray-600 mb-4">
              Create your first sprint to start organizing your work
            </p>
            <button
              onClick={handleCreateSprint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md font-medium"
            >
              Create Your First Sprint
            </button>
          </div>
        )}
      </main>

      {/* Create Sprint Modal */}
      {showCreateModal && (
        <CreateSprintModal
          boardId={boardId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchSprintData();
          }}
        />
      )}

      {/* Complete Sprint Modal */}
      {activeSprint && (
        <CompleteSprintModal
          isOpen={showCompleteModal}
          sprintName={activeSprint.name}
          totalTasks={activeSprint.tasks.length}
          completedTasks={activeSprint.tasks.filter(t => t.completed_at).length}
          incompleteTasks={activeSprint.tasks.filter(t => !t.completed_at).length}
          onConfirm={handleConfirmComplete}
          onCancel={() => setShowCompleteModal(false)}
          isLoading={isCompletingSprint}
        />
      )}

      {/* Sprint Completed Modal */}
      {completionStats && (
        <SprintCompletedModal
          isOpen={showCompletedModal}
          sprintName={activeSprint?.name || ''}
          completedTasks={completionStats.completedTasks}
          incompleteTasks={completionStats.incompleteTasks}
          completionRate={Math.round((completionStats.completedTasks / completionStats.totalTasks) * 100)}
          onClose={() => {
            setShowCompletedModal(false);
            setCompletionStats(null);
          }}
        />
      )}

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="bg-white border-2 border-indigo-500 rounded-md p-3 shadow-lg opacity-90 cursor-grabbing">
            <h4 className="font-medium text-gray-900 text-sm">{activeTask.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded ${
                activeTask.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                activeTask.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                activeTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {activeTask.priority}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <CreateTaskModal
          boardId={boardId}
          onClose={() => setShowCreateTaskModal(false)}
          onSuccess={() => {
            setShowCreateTaskModal(false);
            fetchSprintData();
          }}
        />
      )}
    </div>
    </DndContext>
  );
}

// Draggable Task Component
interface DraggableTaskProps {
  task: TaskWithDetails;
  openTaskMenu: number | null;
  setOpenTaskMenu: (id: number | null) => void;
  isAddingTaskToSprint: boolean;
  activeSprint: SprintWithTasks | null;
  planningSprints: Sprint[];
  handleAddTaskToSprint: (taskId: number, sprintId: number, sprintName: string) => void;
}

function DraggableTask({
  task,
  openTaskMenu,
  setOpenTaskMenu,
  isAddingTaskToSprint,
  activeSprint,
  planningSprints,
  handleAddTaskToSprint,
}: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 group ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
        title="Drag to add to sprint"
      >
        <GripVertical className="w-5 h-5" />
      </div>

      <div className="flex-1 px-2">
        <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded ${
            task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
            task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {task.priority}
          </span>
          {task.assignee && (
            <span className="text-xs text-gray-600">{task.assignee.email}</span>
          )}
        </div>
      </div>

      {/* Add to Sprint Menu */}
      <div className="relative">
        <button
          onClick={() => setOpenTaskMenu(openTaskMenu === task.id ? null : task.id)}
          className="p-2 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all"
          disabled={isAddingTaskToSprint}
          title="Add to sprint"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {openTaskMenu === task.id && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpenTaskMenu(null)}
            />

            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
              <div className="py-1">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Add to Sprint
                </div>

                {planningSprints.length === 0 && !activeSprint && (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No sprints available
                  </div>
                )}

                {activeSprint && (
                  <button
                    onClick={() => handleAddTaskToSprint(task.id, activeSprint.id, activeSprint.name)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    disabled={isAddingTaskToSprint}
                  >
                    <Target className="w-4 h-4 text-green-600" />
                    <div>
                      <div className="font-medium">{activeSprint.name}</div>
                      <div className="text-xs text-gray-500">Active Sprint</div>
                    </div>
                  </button>
                )}

                {planningSprints.map((sprint) => (
                  <button
                    key={sprint.id}
                    onClick={() => handleAddTaskToSprint(task.id, sprint.id, sprint.name)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    disabled={isAddingTaskToSprint}
                  >
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="font-medium">{sprint.name}</div>
                      <div className="text-xs text-gray-500">Planning</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Droppable Sprint Card Component
interface DroppableSprintProps {
  sprint: Sprint | SprintWithTasks;
  children: React.ReactNode;
}

function DroppableSprint({ sprint, children }: DroppableSprintProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: sprint.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${
        isOver ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Create Sprint Modal Component
interface CreateSprintModalProps {
  boardId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateSprintModal({ boardId, onClose, onSuccess }: CreateSprintModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Sprint name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/sprints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          goal: goal.trim() || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error creating sprint:', error);
      setError('Failed to create sprint');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create New Sprint</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sprint Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Sprint 1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="What will you work on in this sprint?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sprint Goal
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="What do you want to achieve?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Task Modal Component
interface CreateTaskModalProps {
  boardId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateTaskModal({ boardId, onClose, onSuccess }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      // First, get the first column of the board to assign the task to
      const boardResponse = await fetch(`/api/boards/${boardId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const boardData = await boardResponse.json();
      if (!boardData.success || !boardData.data.columns || boardData.data.columns.length === 0) {
        setError('No columns found in board');
        setIsLoading(false);
        return;
      }

      const firstColumnId = boardData.data.columns[0].id;

      // Create the task
      const response = await fetch(`/api/boards/${boardId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description: description || undefined, // Don't send empty string
          priority,
          column_id: firstColumnId,
          position: 0, // Add to top of column
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setError('Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Task for Backlog</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter task title"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter task description (optional)"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isLoading}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
            <p className="text-sm text-indigo-900">
              <strong>💡 Note:</strong> This task will be created in the backlog and can be added to sprints later.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

