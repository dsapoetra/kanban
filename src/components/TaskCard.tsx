import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Calendar, 
  User, 
  AlertCircle, 
  Clock,
  CheckCircle2
} from 'lucide-react';
import { TaskWithDetails } from '@/types/kanban';

interface TaskCardProps {
  task: TaskWithDetails;
  onClick: () => void;
}

const priorityColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
};

const priorityIcons = {
  low: <div className="w-2 h-2 rounded-full bg-green-500" />,
  medium: <div className="w-2 h-2 rounded-full bg-yellow-500" />,
  high: <div className="w-2 h-2 rounded-full bg-orange-500" />,
  urgent: <AlertCircle className="w-3 h-3 text-red-500" />,
};

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed_at;
  const isCompleted = !!task.completed_at;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        bg-white rounded-lg p-4 shadow-sm border cursor-pointer transition-all
        hover:shadow-md hover:border-gray-300
        ${isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''}
        ${isCompleted ? 'opacity-75' : ''}
        ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'}
      `}
    >
      {/* Task Title */}
      <div className="flex items-start justify-between mb-2">
        <h4 className={`font-medium text-gray-900 text-sm leading-tight ${isCompleted ? 'line-through' : ''}`}>
          {task.title}
        </h4>
        {isCompleted && (
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 ml-2" />
        )}
      </div>

      {/* Task Description */}
      {task.description && (
        <p className="text-gray-600 text-xs mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Task Metadata */}
      <div className="space-y-2">
        {/* Priority */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {priorityIcons[task.priority]}
            <span className="text-xs text-gray-600 capitalize">
              {task.priority}
            </span>
          </div>
          
          {/* Overdue indicator */}
          {isOverdue && (
            <div className="flex items-center gap-1 text-red-600">
              <Clock className="w-3 h-3" />
              <span className="text-xs">Overdue</span>
            </div>
          )}
        </div>

        {/* Due Date */}
        {task.due_date && (
          <div className="flex items-center gap-1 text-gray-500">
            <Calendar className="w-3 h-3" />
            <span className="text-xs">
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Assignee */}
        {task.assignee && (
          <div className="flex items-center gap-1 text-gray-500">
            <User className="w-3 h-3" />
            <span className="text-xs truncate">
              {task.assignee.email}
            </span>
          </div>
        )}
      </div>

      {/* Priority Badge */}
      {task.priority !== 'medium' && (
        <div className="mt-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
        </div>
      )}
    </div>
  );
}
