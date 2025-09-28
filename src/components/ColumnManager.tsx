'use client';

import { useState, useEffect } from 'react';
import { X, Plus, GripVertical, Edit2, Trash2, Save } from 'lucide-react';
import { Column, CreateColumnRequest, UpdateColumnRequest } from '@/types/kanban';

interface ColumnManagerProps {
  boardId: number;
  isOpen: boolean;
  onClose: () => void;
  onColumnsUpdated: () => void;
}

interface ColumnWithEditing extends Column {
  isEditing?: boolean;
  tempName?: string;
  tempColor?: string;
}

export default function ColumnManager({ boardId, isOpen, onClose, onColumnsUpdated }: ColumnManagerProps) {
  const [columns, setColumns] = useState<ColumnWithEditing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);

  // Predefined color options
  const colorOptions = [
    '#6B7280', // Gray
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#EAB308', // Yellow
    '#84CC16', // Lime
    '#10B981', // Emerald
    '#06B6D4', // Cyan
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
  ];

  useEffect(() => {
    if (isOpen) {
      fetchColumns();
    }
  }, [isOpen, boardId]);

  const fetchColumns = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/columns`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setColumns(data.data);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error fetching columns:', error);
      setError('Failed to load columns');
    } finally {
      setIsLoading(false);
    }
  };

  const addColumn = async () => {
    const newColumn: CreateColumnRequest = {
      name: 'New Column',
      position: columns.length,
      color: '#6B7280',
    };

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newColumn),
      });

      const data = await response.json();
      if (data.success) {
        const newColumnWithEditing = { ...data.data, isEditing: true, tempName: data.data.name, tempColor: data.data.color };
        setColumns([...columns, newColumnWithEditing]);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error adding column:', error);
      setError('Failed to add column');
    }
  };

  const startEditing = (columnId: number) => {
    setColumns(columns.map(col => 
      col.id === columnId 
        ? { ...col, isEditing: true, tempName: col.name, tempColor: col.color }
        : col
    ));
  };

  const cancelEditing = (columnId: number) => {
    setColumns(columns.map(col => 
      col.id === columnId 
        ? { ...col, isEditing: false, tempName: undefined, tempColor: undefined }
        : col
    ));
  };

  const saveColumn = async (columnId: number) => {
    const column = columns.find(col => col.id === columnId);
    if (!column || !column.tempName?.trim()) return;

    const updateData: UpdateColumnRequest = {
      name: column.tempName.trim(),
      color: column.tempColor,
    };

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/columns/${columnId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();
      if (data.success) {
        setColumns(columns.map(col => 
          col.id === columnId 
            ? { ...data.data, isEditing: false, tempName: undefined, tempColor: undefined }
            : col
        ));
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error updating column:', error);
      setError('Failed to update column');
    }
  };

  const deleteColumn = async (columnId: number) => {
    if (!confirm('Are you sure you want to delete this column? All tasks in this column will be moved to the first column.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/columns/${columnId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setColumns(columns.filter(col => col.id !== columnId));
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error deleting column:', error);
      setError('Failed to delete column');
    }
  };

  const handleDragStart = (e: React.DragEvent, columnId: number) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: number) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) return;

    const draggedIndex = columns.findIndex(col => col.id === draggedColumn);
    const targetIndex = columns.findIndex(col => col.id === targetColumnId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder columns locally
    const newColumns = [...columns];
    const [draggedCol] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, draggedCol);

    // Update positions
    const updatedColumns = newColumns.map((col, index) => ({ ...col, position: index }));
    setColumns(updatedColumns);

    // Send reorder request to server
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/boards/${boardId}/columns`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          columns: updatedColumns.map(col => ({ id: col.id, position: col.position }))
        }),
      });

      const data = await response.json();
      if (!data.success) {
        setError(data.message);
        // Revert on error
        fetchColumns();
      }
    } catch (error) {
      console.error('Error reordering columns:', error);
      setError('Failed to reorder columns');
      fetchColumns();
    }

    setDraggedColumn(null);
  };

  const handleClose = () => {
    onColumnsUpdated();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Manage Columns</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading columns...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {columns.map((column, index) => (
                <div
                  key={column.id}
                  draggable={!column.isEditing}
                  onDragStart={(e) => handleDragStart(e, column.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`flex items-center gap-3 p-4 border rounded-lg ${
                    draggedColumn === column.id ? 'opacity-50' : ''
                  } ${column.isEditing ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  {/* Drag Handle */}
                  {!column.isEditing && (
                    <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                  )}

                  {/* Color Indicator */}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: column.isEditing ? column.tempColor : column.color }}
                  />

                  {/* Column Content */}
                  <div className="flex-1">
                    {column.isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={column.tempName || ''}
                          onChange={(e) => setColumns(columns.map(col => 
                            col.id === column.id ? { ...col, tempName: e.target.value } : col
                          ))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Column name"
                        />
                        <div className="flex gap-2">
                          {colorOptions.map(color => (
                            <button
                              key={color}
                              onClick={() => setColumns(columns.map(col => 
                                col.id === column.id ? { ...col, tempColor: color } : col
                              ))}
                              className={`w-6 h-6 rounded-full border-2 ${
                                column.tempColor === color ? 'border-gray-900' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium text-gray-900">{column.name}</span>
                        <span className="ml-2 text-sm text-gray-500">Position {index + 1}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {column.isEditing ? (
                      <>
                        <button
                          onClick={() => saveColumn(column.id)}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => cancelEditing(column.id)}
                          className="text-gray-600 hover:text-gray-800 p-1"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(column.id)}
                          className="text-indigo-600 hover:text-indigo-800 p-1"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {columns.length > 1 && (
                          <button
                            onClick={() => deleteColumn(column.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Column Button */}
              <button
                onClick={addColumn}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add New Column
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
