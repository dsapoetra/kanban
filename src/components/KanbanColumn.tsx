import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import TaskCard from './TaskCard';
import { ColumnWithTasks, TaskWithDetails } from '@/types/kanban';

interface KanbanColumnProps {
  column: ColumnWithTasks;
  onTaskClick: (task: TaskWithDetails) => void;
  onCreateTask: (columnId: number) => void;
}

export default function KanbanColumn({ column, onTaskClick, onCreateTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
  });

  const taskIds = column.tasks.map(task => task.id);

  return (
    <div className="flex-shrink-0 w-80">
      <div className="bg-gray-100 rounded-lg p-4">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: column.color }}
            />
            <h3 className="font-semibold text-gray-900">{column.name}</h3>
            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
              {column.tasks.length}
            </span>
          </div>
          <button
            onClick={() => onCreateTask(column.id)}
            className="text-gray-500 hover:text-gray-700 p-1 rounded"
            title="Add task"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Tasks Container */}
        <div
          ref={setNodeRef}
          className={`min-h-[200px] space-y-3 ${
            isOver ? 'bg-blue-50 border-2 border-blue-200 border-dashed rounded-lg p-2' : ''
          }`}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {column.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
              />
            ))}
          </SortableContext>

          {/* Empty state */}
          {column.tasks.length === 0 && !isOver && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No tasks yet</p>
              <button
                onClick={() => onCreateTask(column.id)}
                className="text-indigo-600 hover:text-indigo-800 text-sm mt-2"
              >
                Add your first task
              </button>
            </div>
          )}

          {/* Drop indicator */}
          {isOver && column.tasks.length === 0 && (
            <div className="text-center py-8 text-blue-600">
              <p className="text-sm">Drop task here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
