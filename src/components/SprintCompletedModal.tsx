'use client';

import { CheckCircle, TrendingUp, ArrowLeft, X } from 'lucide-react';

interface SprintCompletedModalProps {
  isOpen: boolean;
  sprintName: string;
  completedTasks: number;
  incompleteTasks: number;
  completionRate: number;
  onClose: () => void;
}

export default function SprintCompletedModal({
  isOpen,
  sprintName,
  completedTasks,
  incompleteTasks,
  completionRate,
  onClose,
}: SprintCompletedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="relative p-6 border-b">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Sprint Completed! 🎉
            </h2>
            <p className="text-gray-600">
              <strong>&quot;{sprintName}&quot;</strong> has been successfully completed
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Completion Rate */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Completion Rate
              </span>
              <span className="text-2xl font-bold text-indigo-600">{completionRate}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-3 shadow-inner">
              <div
                className="bg-gradient-to-r from-indigo-600 to-purple-600 h-3 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {completedTasks}
              </div>
              <div className="text-sm text-green-800">
                Task{completedTasks !== 1 ? 's' : ''} Completed
              </div>
            </div>

            {incompleteTasks > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {incompleteTasks}
                </div>
                <div className="text-sm text-orange-800">
                  Moved to Backlog
                </div>
              </div>
            )}

            {incompleteTasks === 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  100%
                </div>
                <div className="text-sm text-purple-800">
                  Perfect Sprint!
                </div>
              </div>
            )}
          </div>

          {/* Message */}
          {completionRate === 100 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-sm text-green-900 font-medium">
                🌟 Outstanding work! All tasks completed successfully.
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                {incompleteTasks} incomplete task{incompleteTasks !== 1 ? 's have' : ' has'} been 
                moved back to the backlog. You can add {incompleteTasks !== 1 ? 'them' : 'it'} to 
                your next sprint.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-center p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sprints
          </button>
        </div>
      </div>
    </div>
  );
}

