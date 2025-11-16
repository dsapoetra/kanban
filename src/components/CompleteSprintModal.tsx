'use client';

import { CheckCircle, AlertCircle, X, TrendingUp } from 'lucide-react';

interface CompleteSprintModalProps {
  isOpen: boolean;
  sprintName: string;
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CompleteSprintModal({
  isOpen,
  sprintName,
  totalTasks,
  completedTasks,
  incompleteTasks,
  onConfirm,
  onCancel,
  isLoading = false,
}: CompleteSprintModalProps) {
  if (!isOpen) return null;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Complete Sprint</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            Are you sure you want to complete <strong>&quot;{sprintName}&quot;</strong>?
          </p>

          {/* Statistics */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Tasks</span>
              <span className="font-semibold text-gray-900">{totalTasks}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Completed
              </span>
              <span className="font-semibold text-green-600">{completedTasks}</span>
            </div>

            {incompleteTasks > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  Incomplete
                </span>
                <span className="font-semibold text-orange-600">{incompleteTasks}</span>
              </div>
            )}

            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Completion Rate
                </span>
                <span className="font-semibold text-indigo-600">{completionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Warning */}
          {incompleteTasks > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-orange-900 mb-1">
                    Incomplete Tasks
                  </h4>
                  <p className="text-sm text-orange-800">
                    {incompleteTasks} incomplete task{incompleteTasks !== 1 ? 's' : ''} will be 
                    moved back to the backlog. You can add them to a future sprint.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success message for 100% completion */}
          {completionRate === 100 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-green-900 mb-1">
                    Perfect Sprint! 🎉
                  </h4>
                  <p className="text-sm text-green-800">
                    All tasks completed successfully. Great work!
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            This action cannot be undone.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Complete Sprint
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

