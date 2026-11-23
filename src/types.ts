/**
 * Tududi API Types
 */

export type PriorityLevel = 'low' | 'medium' | 'high';

export type TaskViewType = 'today' | 'upcoming' | 'inbox' | 'next' | 'someday' | 'waiting' | 'all';

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'archived'
  | 'waiting'
  | 'cancelled'
  | 'planned';

export type TaskRecurrenceType =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'monthly_last_day'
  | 'yearly';

export interface TududuTaskTag {
  id?: number | string;
  uid?: string;
  name: string;
  color?: string;
}

export interface TududuTask {
  id: string | number;
  uid?: string;
  name?: string;
  title?: string;
  note?: string;
  description?: string;
  status?: string | number;
  completed?: boolean;
  projectId?: string;
  project_id?: string | number | null;
  project_uid?: string | null;
  areaId?: string;
  area_id?: string | number | null;
  area_uid?: string | null;
  goal_id?: string | number | null;
  parent_task_id?: string | number | null;
  dueDate?: string;
  due_date?: string | null;
  due_time?: string | null;
  defer_until?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  estimated_minutes?: number | null;
  priority?: PriorityLevel | number;
  tags?: Array<string | TududuTaskTag>;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type TududuTaskMetrics = Record<string, unknown>;

export interface ListTasksParams {
  type?: TaskViewType;
  status?: 'active' | 'done' | 'completed' | 'all';
  priority?: PriorityLevel;
  projectId?: string;
  areaId?: string;
  tags?: string[];
  orderBy?: string;
  includeSubtasks?: boolean;
  limit?: number;
  offset?: number;
}

export interface InlineSubtaskInput {
  name: string;
  priority?: PriorityLevel;
  status?: TaskStatus;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId?: string;
  areaId?: string;
  goalId?: string;
  parentTaskId?: string;
  dueDate?: string;
  dueTime?: string;
  deferUntil?: string;
  startDate?: string;
  startTime?: string;
  estimatedMinutes?: number;
  priority?: PriorityLevel;
  status?: TaskStatus;
  today?: boolean;
  recurrenceType?: TaskRecurrenceType;
  recurrenceInterval?: number;
  recurrenceEndDate?: string;
  recurrenceWeekday?: number;
  recurrenceWeekdays?: number[];
  recurrenceMonthDay?: number;
  completionBased?: boolean;
  tags?: string[];
  subtasks?: InlineSubtaskInput[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  completed?: boolean;
  projectId?: string;
  areaId?: string;
  goalId?: string;
  parentTaskId?: string;
  dueDate?: string;
  dueTime?: string;
  deferUntil?: string;
  startDate?: string;
  startTime?: string;
  estimatedMinutes?: number;
  priority?: PriorityLevel;
  status?: TaskStatus;
  today?: boolean;
  recurrenceType?: TaskRecurrenceType;
  recurrenceInterval?: number;
  recurrenceEndDate?: string;
  recurrenceWeekday?: number;
  recurrenceWeekdays?: number[];
  recurrenceMonthDay?: number;
  completionBased?: boolean;
  tags?: string[];
}

export interface CreateSubtaskInput {
  title: string;
  priority?: PriorityLevel;
  status?: TaskStatus;
}

export interface SearchTasksParams {
  query?: string;
  projectId?: string;
  areaId?: string;
  completed?: boolean;
  priority?: PriorityLevel;
  tags?: string[];
}

// Comments
export interface TududuComment {
  id?: string | number;
  uid?: string;
  body?: string;
  task_id?: number | string;
  parent_comment_uid?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CreateCommentInput {
  content: string;
  parentCommentUid?: string;
}

// Projects
export interface TududuProject {
  id: string | number;
  uid?: string;
  name: string;
  description?: string;
  areaId?: string;
  area_id?: string | number | null;
  goal_id?: string | number | null;
  color?: string;
  status?: string;
  priority?: PriorityLevel | number | null;
  due_date_at?: string | null;
  pin_to_sidebar?: boolean;
  archived?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ListProjectsParams {
  status?: string;
  active?: boolean;
  areaId?: string;
  pinned?: boolean;
  tags?: string[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  areaId?: string;
  goalId?: string;
  color?: string;
  status?: string;
  priority?: PriorityLevel;
  dueDate?: string;
  pinned?: boolean;
  tags?: Array<string | { name: string }>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  areaId?: string;
  goalId?: string;
  color?: string;
  status?: string;
  priority?: PriorityLevel;
  dueDate?: string;
  pinned?: boolean;
  tags?: Array<string | { name: string }>;
}

// Areas
export interface TududuArea {
  id: string | number;
  uid?: string;
  name: string;
  description?: string;
  color?: string;
  archived?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CreateAreaInput {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateAreaInput {
  name?: string;
  description?: string;
  color?: string;
}

// Tags
export interface TududuTag {
  id?: string | number;
  uid?: string;
  name: string;
  tag_type?: string;
  pinned?: boolean;
  color?: string | null;
  usage_count?: number;
  [key: string]: unknown;
}

export interface ListTagsParams {
  areaUid?: string;
  projectUid?: string;
}

export interface CreateTagInput {
  name: string;
}

export interface UpdateTagInput {
  name?: string;
  pinned?: boolean;
  color?: string;
}

// Notes
export interface TududuNote {
  id?: string | number;
  uid?: string;
  title: string;
  content?: string;
  project_id?: string | number | null;
  color?: string | null;
  pin_to_sidebar?: boolean;
  tags?: Array<string | TududuTaskTag>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ListNotesParams {
  orderBy?: string;
  tag?: string;
  areaUid?: string;
  projectUid?: string;
  tags?: string[];
}

export interface CreateNoteInput {
  title: string;
  content?: string;
  projectId?: string;
  tags?: string[];
  color?: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  projectId?: string;
  tags?: string[];
  color?: string;
  pinned?: boolean;
}

// Inbox
export interface TududuInboxItem {
  id?: string | number;
  uid?: string;
  title?: string;
  content: string;
  source?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ListInboxParams {
  limit?: number;
  offset?: number;
}

export interface CreateInboxItemInput {
  content: string;
  source?: string;
}

export interface UpdateInboxItemInput {
  content?: string;
  status?: string;
}

export interface ProcessInboxItemInput {
  taskUid?: string;
  projectUid?: string;
  noteUid?: string;
}

// Goals
export interface TududuGoal {
  id?: string | number;
  uid?: string;
  title: string;
  area_id?: string | number | null;
  why?: string | null;
  horizon?: string;
  target_date?: string | null;
  status?: string;
  color?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ListGoalsParams {
  areaId?: string;
}

export interface CreateGoalInput {
  title: string;
  areaId?: string;
  why?: string;
  horizon?: string;
  targetDate?: string;
  status?: string;
  color?: string;
}

export interface UpdateGoalInput {
  title?: string;
  areaId?: string;
  why?: string;
  horizon?: string;
  targetDate?: string;
  status?: string;
  color?: string;
}

// Habits
export type HabitPolarity = 'build' | 'quit';
export type HabitFrequencyPeriod = 'daily' | 'weekly' | 'monthly';
export type HabitTimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface TududuHabit {
  id?: string | number;
  uid?: string;
  name: string;
  note?: string | null;
  habit_polarity?: HabitPolarity;
  habit_frequency_period?: HabitFrequencyPeriod;
  habit_target_count?: number;
  habit_target_value?: number | null;
  habit_unit?: string | null;
  habit_schedule_days?: number[] | null;
  habit_interval_days?: number | null;
  habit_time_of_day?: HabitTimeOfDay | null;
  habit_reminder_time?: string | null;
  habit_color?: string | null;
  habit_archived?: boolean;
  habit_progress?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ListHabitsParams {
  archived?: boolean;
}

export interface CreateHabitInput {
  name: string;
  description?: string;
  priority?: PriorityLevel;
  polarity?: HabitPolarity;
  frequencyPeriod?: HabitFrequencyPeriod;
  targetCount?: number;
  targetValue?: number;
  unit?: string;
  scheduleDays?: number[];
  intervalDays?: number;
  timeOfDay?: HabitTimeOfDay;
  reminderTime?: string;
  color?: string;
}

export interface UpdateHabitInput {
  name?: string;
  description?: string;
  priority?: PriorityLevel;
  polarity?: HabitPolarity;
  frequencyPeriod?: HabitFrequencyPeriod;
  targetCount?: number;
  targetValue?: number;
  unit?: string;
  scheduleDays?: number[];
  intervalDays?: number;
  timeOfDay?: HabitTimeOfDay;
  reminderTime?: string;
  color?: string;
  archived?: boolean;
}

export interface LogHabitCompletionInput {
  completedAt?: string;
  value?: number;
  note?: string;
}

export interface SkipHabitDayInput {
  date?: string;
  note?: string;
}

export interface HabitStatsParams {
  startDate?: string;
  endDate?: string;
}
