'use client';

import { useState } from 'react';
import { X, Plus, GripVertical, Trash2 } from 'lucide-react';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBoardCreated: (board: any) => void;
}

interface ColumnTemplate {
  id?: string;
  name: string;
  color: string;
  position: number;
}

const defaultColumns: ColumnTemplate[] = [
  { id: 'todo', name: 'To Do', color: '#6B7280', position: 0 },
  { id: 'inprogress', name: 'In Progress', color: '#3B82F6', position: 1 },
  { id: 'testing', name: 'Testing', color: '#F59E0B', position: 2 },
  { id: 'done', name: 'Done', color: '#10B981', position: 3 },
];

const workflowTemplates = {
  'Basic Kanban': [
    { id: 'basic-todo', name: 'To Do', color: '#6B7280', position: 0 },
    { id: 'basic-inprogress', name: 'In Progress', color: '#3B82F6', position: 1 },
    { id: 'basic-done', name: 'Done', color: '#10B981', position: 2 },
  ],
  'Development': [
    { id: 'dev-backlog', name: 'Backlog', color: '#6B7280', position: 0 },
    { id: 'dev-inprogress', name: 'In Progress', color: '#3B82F6', position: 1 },
    { id: 'dev-review', name: 'Code Review', color: '#F59E0B', position: 2 },
    { id: 'dev-testing', name: 'Testing', color: '#8B5CF6', position: 3 },
    { id: 'dev-done', name: 'Done', color: '#10B981', position: 4 },
  ],
  'Marketing': [
    { id: 'mkt-ideas', name: 'Ideas', color: '#6B7280', position: 0 },
    { id: 'mkt-planning', name: 'Planning', color: '#3B82F6', position: 1 },
    { id: 'mkt-inprogress', name: 'In Progress', color: '#F59E0B', position: 2 },
    { id: 'mkt-review', name: 'Review', color: '#8B5CF6', position: 3 },
    { id: 'mkt-published', name: 'Published', color: '#10B981', position: 4 },
  ],
  'Support': [
    { id: 'sup-new', name: 'New Tickets', color: '#EF4444', position: 0 },
    { id: 'sup-inprogress', name: 'In Progress', color: '#F59E0B', position: 1 },
    { id: 'sup-waiting', name: 'Waiting for Customer', color: '#6B7280', position: 2 },
    { id: 'sup-resolved', name: 'Resolved', color: '#10B981', position: 3 },
  ],
};

const colorOptions = [
  '#6B7280', '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

export default function CreateBoardModal({ isOpen, onClose, onBoardCreated }: CreateBoardModalProps) {
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [columns, setColumns] = useState<ColumnTemplate[]>(defaultColumns);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);

  const resetForm = () => {
    setBoardName('');
    setBoardDescription('');
    setColumns(defaultColumns);
    setSelectedTemplate('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const applyTemplate = (templateName: string) => {
    if (templateName && workflowTemplates[templateName as keyof typeof workflowTemplates]) {
      setColumns([...workflowTemplates[templateName as keyof typeof workflowTemplates]]);
      setSelectedTemplate(templateName);
    }
  };

  const addColumn = () => {
    console.log('addColumn clicked, current columns:', columns);
    const newColumn: ColumnTemplate = {
      id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'New Column',
      color: '#6B7280',
      position: columns.length,
    };
    const updatedColumns = [...columns, newColumn];
    console.log('Setting new columns:', updatedColumns);
    setColumns(updatedColumns);
  };

  const updateColumn = (index: number, field: keyof ColumnTemplate, value: string | number) => {
    const updatedColumns = columns.map((col, i) => 
      i === index ? { ...col, [field]: value } : col
    );
    setColumns(updatedColumns);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) return; // Keep at least one column
    const updatedColumns = columns.filter((_, i) => i !== index)
      .map((col, i) => ({ ...col, position: i }));
    setColumns(updatedColumns);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColumn(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedColumn === null || draggedColumn === targetIndex) return;

    const newColumns = [...columns];
    const [draggedCol] = newColumns.splice(draggedColumn, 1);
    newColumns.splice(targetIndex, 0, draggedCol);

    // Update positions
    const updatedColumns = newColumns.map((col, index) => ({ ...col, position: index }));
    setColumns(updatedColumns);
    setDraggedColumn(null);
  };

  const createBoard = async () => {
    if (!boardName.trim()) {
      setError('Board name is required');
      return;
    }

    if (columns.length === 0) {
      setError('At least one column is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: boardName.trim(),
          description: boardDescription.trim() || undefined,
          columns: columns.map(col => ({
            name: col.name,
            position: col.position,
            color: col.color,
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        onBoardCreated(data.data);
        handleClose();
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error creating board:', error);
      setError('Failed to create board');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create New Board</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Board Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Board Details</h3>
              
              <div>
                <label htmlFor="boardName" className="block text-sm font-medium text-gray-700 mb-1">
                  Board Name *
                </label>
                <input
                  id="boardName"
                  type="text"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter board name"
                />
              </div>

              <div>
                <label htmlFor="boardDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="boardDescription"
                  value={boardDescription}
                  onChange={(e) => setBoardDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional board description"
                />
              </div>

              {/* Workflow Templates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Templates
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(workflowTemplates).map((template) => (
                    <button
                      key={template}
                      onClick={() => applyTemplate(template)}
                      className={`p-2 text-sm border rounded-md transition-colors ${
                        selectedTemplate === template
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Column Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Columns</h3>
                <button
                  onClick={addColumn}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Column
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {columns.map((column, index) => (
                  <div
                    key={column.id || index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`flex items-center gap-2 p-3 border rounded-md ${
                      draggedColumn === index ? 'opacity-50' : 'bg-gray-50'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                    
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: column.color }}
                    />

                    <input
                      type="text"
                      value={column.name}
                      onChange={(e) => updateColumn(index, 'name', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Column name"
                    />

                    <div className="flex gap-1">
                      {colorOptions.slice(0, 6).map(color => (
                        <button
                          key={color}
                          onClick={() => updateColumn(index, 'color', color)}
                          className={`w-5 h-5 rounded-full border ${
                            column.color === color ? 'border-gray-900' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>

                    {columns.length > 1 && (
                      <button
                        onClick={() => removeColumn(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={createBoard}
            disabled={isCreating || !boardName.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Board'}
          </button>
        </div>
      </div>
    </div>
  );
}
