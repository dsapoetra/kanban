import { z } from 'zod';

// Enums for type safety
export type UserRole = 'admin' | 'member' | 'viewer';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SprintStatus = 'planning' | 'active' | 'completed';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type TaskAction = 'created' | 'moved' | 'updated' | 'assigned' | 'completed' | 'deleted';

// Database models
export interface Board {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface BoardMember {
  id: number;
  board_id: number;
  user_id: number;
  role: UserRole;
  joined_at: Date;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  color: string;
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  column_id: number;
  board_id: number;
  assignee_id?: number;
  creator_id: number;
  priority: TaskPriority;
  position: number;
  due_date?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Sprint {
  id: number;
  board_id: number;
  name: string;
  description?: string;
  start_date?: Date;
  end_date?: Date;
  status: SprintStatus;
  goal?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SprintTask {
  id: number;
  sprint_id: number;
  task_id: number;
  added_at: Date;
}

export interface TeamInvitation {
  id: number;
  board_id: number;
  inviter_id: number;
  invitee_email: string;
  role: UserRole;
  token: string;
  status: InvitationStatus;
  expires_at: Date;
  created_at: Date;
  responded_at?: Date;
}

export interface TaskHistory {
  id: number;
  task_id: number;
  user_id: number;
  action: TaskAction;
  old_value?: string;
  new_value?: string;
  field_changed?: string;
  created_at: Date;
}

// Extended types with joined data
export interface BoardWithMembers extends Board {
  members: (BoardMember & { user: { id: number; email: string } })[];
  columns: Column[];
  owner: { id: number; email: string };
}

export interface TaskWithDetails extends Task {
  assignee?: { id: number; email: string };
  creator: { id: number; email: string };
  column: { id: number; name: string; color: string };
}

export interface ColumnWithTasks extends Column {
  tasks: TaskWithDetails[];
}

export interface SprintWithTasks extends Sprint {
  tasks: TaskWithDetails[];
}

// API Request/Response types
export interface CreateBoardRequest {
  name: string;
  description?: string;
  columns?: Array<{
    name: string;
    position: number;
    color?: string;
  }>;
}

export interface UpdateBoardRequest {
  name?: string;
  description?: string;
}

export interface CreateColumnRequest {
  name: string;
  position: number;
  color?: string;
}

export interface UpdateColumnRequest {
  name?: string;
  position?: number;
  color?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  column_id: number;
  assignee_id?: number;
  priority?: TaskPriority;
  position: number;
  due_date?: string; // ISO string
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  column_id?: number;
  assignee_id?: number;
  priority?: TaskPriority;
  position?: number;
  due_date?: string; // ISO string
}

export interface MoveTaskRequest {
  column_id: number;
  position: number;
}

export interface CreateSprintRequest {
  name: string;
  description?: string;
  start_date?: string; // ISO string
  end_date?: string; // ISO string
  goal?: string;
}

export interface UpdateSprintRequest {
  name?: string;
  description?: string;
  start_date?: string; // ISO string
  end_date?: string; // ISO string
  status?: SprintStatus;
  goal?: string;
}

export interface InviteTeamMemberRequest {
  email: string;
  role: UserRole;
}

export interface UpdateMemberRoleRequest {
  role: UserRole;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

// Analytics types
export interface TaskAnalytics {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  tasks_by_priority: Record<TaskPriority, number>;
  tasks_by_column: Record<string, number>;
  completion_rate: number;
}

export interface SprintAnalytics {
  total_story_points?: number;
  completed_story_points?: number;
  velocity?: number;
  burndown_data: { date: string; remaining: number }[];
  completion_rate: number;
}

export interface BoardAnalytics {
  task_analytics: TaskAnalytics;
  sprint_analytics?: SprintAnalytics;
  member_activity: { user_id: number; email: string; task_count: number }[];
  recent_activity: TaskHistory[];
}

// Zod validation schemas
export const userRoleSchema = z.enum(['admin', 'member', 'viewer']);
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const sprintStatusSchema = z.enum(['planning', 'active', 'completed']);

export const createBoardSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(255, 'Board name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  columns: z.array(z.object({
    name: z.string().min(1, 'Column name is required').max(255, 'Column name too long'),
    position: z.number().int().min(0, 'Position must be non-negative'),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  })).optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(255, 'Board name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
});

export const createColumnSchema = z.object({
  name: z.string().min(1, 'Column name is required').max(255, 'Column name too long'),
  position: z.number().int().min(0, 'Position must be non-negative'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1, 'Column name is required').max(255, 'Column name too long').optional(),
  position: z.number().int().min(0, 'Position must be non-negative').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(255, 'Task title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  column_id: z.number().int().positive('Invalid column ID'),
  assignee_id: z.number().int().positive('Invalid assignee ID').optional(),
  priority: taskPrioritySchema.optional(),
  position: z.number().int().min(0, 'Position must be non-negative'),
  due_date: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(255, 'Task title too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  column_id: z.number().int().positive('Invalid column ID').optional(),
  assignee_id: z.number().int().positive('Invalid assignee ID').optional(),
  priority: taskPrioritySchema.optional(),
  position: z.number().int().min(0, 'Position must be non-negative').optional(),
  due_date: z.string().optional(),
});

export const moveTaskSchema = z.object({
  column_id: z.number().int().positive('Invalid column ID'),
  position: z.number().int().min(0, 'Position must be non-negative'),
});

export const createSprintSchema = z.object({
  name: z.string().min(1, 'Sprint name is required').max(255, 'Sprint name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  goal: z.string().max(500, 'Goal too long').optional(),
});

export const updateSprintSchema = z.object({
  name: z.string().min(1, 'Sprint name is required').max(255, 'Sprint name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: sprintStatusSchema.optional(),
  goal: z.string().max(500, 'Goal too long').optional(),
});

export const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: userRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  role: userRoleSchema,
});
