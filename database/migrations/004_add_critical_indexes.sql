-- Migration: Add critical and necessary indexes for performance optimization
-- Description: Adds indexes for frequently queried columns and common WHERE/JOIN patterns
-- Created: 2025-12-23

-- ============================================================================
-- SPRINT INDEXES - For sprint status filtering and board queries
-- ============================================================================

-- Index for filtering sprints by board_id and status (commonly used in analytics)
CREATE INDEX IF NOT EXISTS idx_sprints_board_status ON sprints(board_id, status)
  WHERE status IN ('active', 'completed');

-- Index for completed sprints ordered by end_date (used in velocity/analytics)
CREATE INDEX IF NOT EXISTS idx_sprints_completed_end_date ON sprints(board_id, end_date DESC)
  WHERE status = 'completed';

-- ============================================================================
-- TEAM INVITATION INDEXES - For invitation lookups and filtering
-- ============================================================================

-- Index for looking up pending invitations by email
CREATE INDEX IF NOT EXISTS idx_team_invitations_email_status ON team_invitations(invitee_email, status);

-- Index for pending invitations with expiration checks
CREATE INDEX IF NOT EXISTS idx_team_invitations_status_expires ON team_invitations(board_id, status, expires_at)
  WHERE status = 'pending';

-- ============================================================================
-- TASK INDEXES - For task filtering and queries
-- ============================================================================

-- Index for filtering tasks by board_id and assignee (used in analytics)
CREATE INDEX IF NOT EXISTS idx_tasks_board_assignee ON tasks(board_id, assignee_id)
  WHERE assignee_id IS NOT NULL;

-- Index for task creator lookups
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);

-- Index for completed tasks filtering
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(board_id, completed_at)
  WHERE completed_at IS NOT NULL;

-- Index for tasks with due dates (for deadline tracking)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(board_id, due_date)
  WHERE due_date IS NOT NULL;

-- Index for task priority filtering
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(board_id, priority);

-- ============================================================================
-- TASK HISTORY INDEXES - For audit trail and analytics queries
-- ============================================================================

-- Index for task history by board (used in analytics recent activity)
CREATE INDEX IF NOT EXISTS idx_task_history_board_created ON task_history(created_at DESC)
  INCLUDE (task_id, user_id, action);

-- Index for user activity tracking
CREATE INDEX IF NOT EXISTS idx_task_history_user_id ON task_history(user_id, created_at DESC);

-- Composite index for task history with action filtering
CREATE INDEX IF NOT EXISTS idx_task_history_task_action ON task_history(task_id, action, created_at DESC);

-- ============================================================================
-- BOARD MEMBER INDEXES - For authorization and member queries
-- ============================================================================

-- Composite index for board member role filtering
CREATE INDEX IF NOT EXISTS idx_board_members_board_role ON board_members(board_id, role);

-- Index for checking admin permissions quickly
CREATE INDEX IF NOT EXISTS idx_board_members_admin ON board_members(board_id, user_id)
  WHERE role = 'admin';

-- ============================================================================
-- COLUMN INDEXES - For board column ordering
-- ============================================================================

-- Already exists: idx_columns_position (board_id, position)
-- Additional index for column lookups by board
-- CREATE INDEX IF NOT EXISTS idx_columns_board_position ON columns(board_id, position ASC);

-- ============================================================================
-- SPRINT TASKS INDEXES - For sprint-task relationship queries
-- ============================================================================

-- Composite index for sprint tasks with task details (reverse lookup)
CREATE INDEX IF NOT EXISTS idx_sprint_tasks_task_sprint ON sprint_tasks(task_id, sprint_id);

-- ============================================================================
-- USER TABLE OPTIMIZATION
-- ============================================================================

-- The email column already has UNIQUE constraint which creates an index
-- Additional index on email already exists from migration 001
-- No additional indexes needed for users table

-- ============================================================================
-- UPDATE STATISTICS
-- ============================================================================

-- Analyze all tables to update query planner statistics
ANALYZE users;
ANALYZE boards;
ANALYZE board_members;
ANALYZE columns;
ANALYZE tasks;
ANALYZE sprints;
ANALYZE sprint_tasks;
ANALYZE team_invitations;
ANALYZE task_history;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_sprints_board_status IS 'Optimizes sprint filtering by status for analytics queries';
COMMENT ON INDEX idx_sprints_completed_end_date IS 'Optimizes completed sprint queries ordered by end date';
COMMENT ON INDEX idx_team_invitations_email_status IS 'Optimizes invitation lookups by email and status';
COMMENT ON INDEX idx_team_invitations_status_expires IS 'Optimizes pending invitation queries with expiration checks';
COMMENT ON INDEX idx_tasks_board_assignee IS 'Optimizes task queries filtered by assignee for analytics';
COMMENT ON INDEX idx_tasks_creator_id IS 'Optimizes task creator lookups';
COMMENT ON INDEX idx_tasks_completed_at IS 'Optimizes completed task filtering';
COMMENT ON INDEX idx_tasks_due_date IS 'Optimizes deadline tracking queries';
COMMENT ON INDEX idx_tasks_priority IS 'Optimizes task priority filtering';
COMMENT ON INDEX idx_task_history_board_created IS 'Optimizes recent activity queries with included columns';
COMMENT ON INDEX idx_task_history_user_id IS 'Optimizes user activity tracking';
COMMENT ON INDEX idx_task_history_task_action IS 'Optimizes task history queries with action filtering';
COMMENT ON INDEX idx_board_members_board_role IS 'Optimizes board member role filtering';
COMMENT ON INDEX idx_board_members_admin IS 'Optimizes admin permission checks';
COMMENT ON INDEX idx_sprint_tasks_task_sprint IS 'Optimizes reverse sprint-task lookups';
