'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X, User, Users } from 'lucide-react';

interface TaskFilterProps {
  members: Array<{
    id: number;
    board_id: number;
    user_id: number;
    role: string;
    joined_at: string;
    user: { id: number; email: string };
  }>;
  selectedAssignee: number | null;
  onAssigneeChange: (assigneeId: number | null) => void;
  totalTasks?: number;
  visibleTasks?: number;
}

export default function TaskFilter({ members, selectedAssignee, onAssigneeChange, totalTasks, visibleTasks }: TaskFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAssigneeSelect = (assigneeId: number | null) => {
    onAssigneeChange(assigneeId);
    setIsOpen(false);
  };

  const clearFilter = () => {
    onAssigneeChange(null);
    setIsOpen(false);
  };

  const getSelectedAssigneeName = () => {
    if (!selectedAssignee) return null;
    const member = members.find(m => m.user.id === selectedAssignee);
    return member?.user.email || 'Unknown User';
  };

  const selectedName = getSelectedAssigneeName();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
          selectedAssignee
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
        title="Filter by assignee"
      >
        <Filter className="w-4 h-4" />
        {selectedAssignee ? (
          <>
            <span className="truncate max-w-32">{selectedName}</span>
            {totalTasks !== undefined && visibleTasks !== undefined && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                {visibleTasks}/{totalTasks}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFilter();
              }}
              className="text-indigo-500 hover:text-indigo-700"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <span>Filter</span>
            {totalTasks !== undefined && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {totalTasks}
              </span>
            )}
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1 mb-1">
              Filter by Assignee
            </div>
            
            {/* All Tasks Option */}
            <button
              onClick={() => handleAssigneeSelect(null)}
              className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors ${
                !selectedAssignee
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>All Tasks</span>
              {!selectedAssignee && (
                <div className="ml-auto w-2 h-2 bg-indigo-600 rounded-full" />
              )}
            </button>

            {/* Unassigned Tasks Option */}
            <button
              onClick={() => handleAssigneeSelect(-1)}
              className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors ${
                selectedAssignee === -1
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-4 h-4 border-2 border-gray-400 rounded-full" />
              <span>Unassigned</span>
              {selectedAssignee === -1 && (
                <div className="ml-auto w-2 h-2 bg-indigo-600 rounded-full" />
              )}
            </button>

            {/* Divider */}
            {members.length > 0 && (
              <div className="border-t border-gray-200 my-2" />
            )}

            {/* Member Options */}
            {members.map((member) => (
              <button
                key={member.user.id}
                onClick={() => handleAssigneeSelect(member.user.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors ${
                  selectedAssignee === member.user.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="truncate">{member.user.email}</span>
                <span className="ml-auto text-xs text-gray-500 capitalize">
                  {member.role}
                </span>
                {selectedAssignee === member.user.id && (
                  <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                )}
              </button>
            ))}

            {/* Empty State */}
            {members.length === 0 && (
              <div className="px-2 py-4 text-center text-gray-500 text-sm">
                No team members found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
