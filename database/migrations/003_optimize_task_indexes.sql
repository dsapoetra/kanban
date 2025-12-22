-- Optimization migration for task movement performance
-- This adds additional indexes to speed up task reordering operations

-- Drop old index and create more specific one for task reordering
DROP INDEX IF EXISTS idx_tasks_position;

-- Create composite index optimized for move operations
-- This index supports queries with WHERE column_id = X AND position conditions
CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks(column_id, position)
  WHERE column_id IS NOT NULL;

-- Add index for task lookups by ID and board_id (used in move validation)
CREATE INDEX IF NOT EXISTS idx_tasks_id_board ON tasks(id, board_id);

-- Add partial index for active tasks (if you implement soft deletes later)
-- CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(column_id, position)
--   WHERE deleted_at IS NULL;

ANALYZE tasks;
