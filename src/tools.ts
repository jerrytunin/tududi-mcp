import { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { TududuClient } from './tududi-client.js';
import {
  CreateAreaInput,
  CreateCommentInput,
  CreateGoalInput,
  CreateHabitInput,
  CreateInboxItemInput,
  CreateNoteInput,
  CreateProjectInput,
  CreateSubtaskInput,
  CreateTagInput,
  CreateTaskInput,
  HabitStatsParams,
  ListGoalsParams,
  ListHabitsParams,
  ListInboxParams,
  ListNotesParams,
  ListProjectsParams,
  ListTagsParams,
  ListTasksParams,
  LogHabitCompletionInput,
  ProcessInboxItemInput,
  SearchTasksParams,
  SkipHabitDayInput,
  UpdateAreaInput,
  UpdateGoalInput,
  UpdateHabitInput,
  UpdateInboxItemInput,
  UpdateNoteInput,
  UpdateProjectInput,
  UpdateTagInput,
  UpdateTaskInput,
} from './types.js';

const PRIORITY_PROP = {
  type: 'string',
  enum: ['low', 'medium', 'high'],
  description: 'Priority level',
};

const TASK_STATUS_VALUES = [
  'not_started',
  'in_progress',
  'done',
  'archived',
  'waiting',
  'cancelled',
  'planned',
];

const RECURRENCE_VALUES = ['none', 'daily', 'weekly', 'monthly', 'monthly_last_day', 'yearly'];

const STRING_ARRAY_PROP = {
  type: 'array',
  items: { type: 'string' },
};

const SHARED_TASK_WRITE_PROPS = {
  description: {
    type: 'string',
    description: 'Task description/notes (mapped to note in Tududi)',
  },
  projectId: { type: 'string', description: 'Project numeric ID or UID to assign task to' },
  areaId: { type: 'string', description: 'Area numeric ID or UID to assign task to' },
  goalId: { type: 'string', description: 'Goal numeric ID or UID to assign task to' },
  parentTaskId: { type: 'string', description: 'Parent task numeric ID (for subtasks)' },
  dueDate: {
    type: 'string',
    description: 'Due date in ISO format (YYYY-MM-DD or full ISO)',
  },
  dueTime: { type: 'string', description: 'Due time in HH:mm format (24-hour)' },
  deferUntil: { type: 'string', description: 'Defer-until date/time in ISO format' },
  startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
  startTime: { type: 'string', description: 'Start time in HH:mm format (24-hour)' },
  estimatedMinutes: { type: 'number', description: 'Estimated duration in minutes' },
  priority: PRIORITY_PROP,
  status: {
    type: 'string',
    enum: TASK_STATUS_VALUES,
    description: 'Task workflow status',
  },
  today: { type: 'boolean', description: 'Include task on Today / Daily Plan' },
  recurrenceType: {
    type: 'string',
    enum: RECURRENCE_VALUES,
    description: 'Recurrence cadence',
  },
  recurrenceInterval: { type: 'number', description: 'Recurrence interval (e.g. every N units)' },
  recurrenceEndDate: { type: 'string', description: 'Recurrence end date in ISO format' },
  recurrenceWeekday: { type: 'number', description: 'Day of week (0-6) for weekly recurrence' },
  recurrenceWeekdays: {
    type: 'array',
    items: { type: 'number' },
    description: 'List of weekdays (0-6) for weekly recurrence',
  },
  recurrenceMonthDay: { type: 'number', description: 'Day of month (1-31) for monthly recurrence' },
  completionBased: {
    type: 'boolean',
    description: 'Calculate next recurrence relative to completion date',
  },
  tags: { ...STRING_ARRAY_PROP, description: 'Tag names to assign to the task' },
};

const SHARED_PROJECT_WRITE_PROPS = {
  description: { type: 'string', description: 'Project description' },
  areaId: { type: 'string', description: 'Area ID or UID to assign project to' },
  goalId: { type: 'string', description: 'Goal ID or UID to assign project to' },
  color: { type: 'string', description: 'Project color (hex code or name)' },
  status: {
    type: 'string',
    enum: ['not_started', 'planned', 'in_progress', 'waiting', 'done', 'cancelled'],
    description: 'Project status',
  },
  priority: PRIORITY_PROP,
  dueDate: { type: 'string', description: 'Project due date in ISO format' },
  pinned: { type: 'boolean', description: 'Pin project to sidebar' },
  tags: { ...STRING_ARRAY_PROP, description: 'Tag names to assign to the project' },
};

const SHARED_GOAL_WRITE_PROPS = {
  areaId: { type: 'string', description: 'Area numeric ID or UID (empty string clears area)' },
  why: { type: 'string', description: 'Motivation or purpose behind the goal' },
  horizon: { type: 'string', description: 'Time horizon (e.g. season, year, quarter)' },
  targetDate: { type: 'string', description: 'Target completion date (YYYY-MM-DD)' },
  status: {
    type: 'string',
    enum: ['active', 'paused', 'completed', 'archived'],
    description: 'Goal status',
  },
  color: { type: 'string', description: 'Goal color hex code' },
};

const SHARED_HABIT_WRITE_PROPS = {
  description: { type: 'string', description: 'Habit notes or instructions' },
  priority: PRIORITY_PROP,
  polarity: {
    type: 'string',
    enum: ['build', 'quit'],
    description: 'Whether to build or quit this habit',
  },
  frequencyPeriod: {
    type: 'string',
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Tracking period for target count',
  },
  targetCount: { type: 'number', description: 'Target completions per period (1-1000)' },
  targetValue: { type: 'number', description: 'Optional numeric measurement target (e.g. 2000)' },
  unit: { type: 'string', description: 'Optional measurement unit (e.g. ml, pages, mins)' },
  scheduleDays: {
    type: 'array',
    items: { type: 'number' },
    description: 'Scheduled days of week (0-6)',
  },
  intervalDays: { type: 'number', description: 'Interval in days (>= 2) for custom schedules' },
  timeOfDay: {
    type: 'string',
    enum: ['morning', 'afternoon', 'evening'],
    description: 'Preferred time of day',
  },
  reminderTime: { type: 'string', description: 'Reminder time in HH:mm format' },
  color: { type: 'string', description: 'Hex color (#rrggbb)' },
};

export const TUDUDI_TOOLS: Tool[] = [
  // Tasks & Subtasks (10)
  {
    name: 'tududi_list_tasks',
    description: 'List tasks from Tududi with optional GTD view and scope filters',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['today', 'upcoming', 'inbox', 'next', 'someday', 'waiting', 'all'],
          description: 'GTD view filter',
        },
        status: {
          type: 'string',
          enum: ['active', 'done', 'completed', 'all'],
          description: 'Completion/status filter',
        },
        priority: PRIORITY_PROP,
        projectId: { type: 'string', description: 'Filter by project numeric ID or UID' },
        areaId: { type: 'string', description: 'Filter by area numeric ID or UID' },
        tags: { ...STRING_ARRAY_PROP, description: 'Filter by tag names (AND semantics)' },
        orderBy: {
          type: 'string',
          description: 'Sort order (e.g. due_date:asc, priority:desc, created_at:desc)',
        },
        includeSubtasks: { type: 'boolean', description: 'Include subtasks in top-level list' },
        limit: { type: 'number', description: 'Max tasks to return' },
        offset: { type: 'number', description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'tududi_get_task',
    description: 'Get full details of a single task by UID or numeric ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task uid (string hash from tududi_list_tasks, or numeric id)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_create_task',
    description:
      'Create a new task in Tududi with full scheduling, recurrence, and subtask support',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        ...SHARED_TASK_WRITE_PROPS,
        subtasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Subtask title' },
              priority: PRIORITY_PROP,
              status: { type: 'string', enum: TASK_STATUS_VALUES },
            },
            required: ['name'],
          },
          description: 'Optional inline subtasks to create with this task',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'tududi_update_task',
    description: 'Update an existing task',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task uid (string hash from tududi_list_tasks, or numeric id)',
        },
        title: { type: 'string', description: 'New task title' },
        completed: { type: 'boolean', description: 'Task completion status' },
        ...SHARED_TASK_WRITE_PROPS,
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_complete_task',
    description: 'Mark a task as complete',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task uid (string hash from tududi_list_tasks, or numeric id)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_delete_task',
    description: 'Delete a task',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task uid (string hash from tududi_list_tasks, or numeric id)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_search_tasks',
    description: 'Search tasks by text query and/or structured filters',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        projectId: { type: 'string', description: 'Filter by project ID or UID' },
        areaId: { type: 'string', description: 'Filter by area ID or UID' },
        completed: { type: 'boolean', description: 'Filter by completion status' },
        priority: PRIORITY_PROP,
        tags: { ...STRING_ARRAY_PROP, description: 'Filter by tag names' },
      },
    },
  },
  {
    name: 'tududi_get_task_metrics',
    description: 'Get task counts and productivity metrics from Tududi',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Optional metrics view type' },
      },
    },
  },
  {
    name: 'tududi_list_subtasks',
    description: 'List subtasks for a parent task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Parent task UID or numeric ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'tududi_create_subtask',
    description: 'Create a subtask under an existing parent task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Parent task UID or numeric ID' },
        title: { type: 'string', description: 'Subtask title' },
        priority: PRIORITY_PROP,
        status: { type: 'string', enum: TASK_STATUS_VALUES, description: 'Initial subtask status' },
      },
      required: ['taskId', 'title'],
    },
  },

  // Comments (3)
  {
    name: 'tududi_list_comments',
    description: 'List comments on a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task UID or numeric ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'tududi_create_comment',
    description: 'Add a comment to a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task UID or numeric ID' },
        content: { type: 'string', description: 'Comment text body' },
        parentCommentUid: {
          type: 'string',
          description: 'Optional parent comment UID for threaded replies',
        },
      },
      required: ['taskId', 'content'],
    },
  },
  {
    name: 'tududi_delete_comment',
    description: 'Delete a task comment by comment UID',
    inputSchema: {
      type: 'object',
      properties: {
        commentId: { type: 'string', description: 'Comment UID' },
      },
      required: ['commentId'],
    },
  },

  // Projects (6)
  {
    name: 'tududi_list_projects',
    description: 'List projects from Tududi with optional status, area, and tag filters',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by project status' },
        active: { type: 'boolean', description: 'Filter active vs inactive projects' },
        areaId: { type: 'string', description: 'Filter by area ID or UID' },
        pinned: { type: 'boolean', description: 'Filter pinned projects' },
        tags: { ...STRING_ARRAY_PROP, description: 'Filter by tag names' },
      },
    },
  },
  {
    name: 'tududi_get_project',
    description: 'Get details of a single project by UID or numeric ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project UID or numeric ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_create_project',
    description: 'Create a new project in Tududi',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
        ...SHARED_PROJECT_WRITE_PROPS,
      },
      required: ['name'],
    },
  },
  {
    name: 'tududi_update_project',
    description: 'Update an existing project',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project UID or numeric ID' },
        name: { type: 'string', description: 'New project name' },
        ...SHARED_PROJECT_WRITE_PROPS,
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_complete_project',
    description: 'Mark a project done, optionally completing its open tasks',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project UID or numeric ID' },
        completeOpenTasks: {
          type: 'boolean',
          description: 'Also mark all open tasks in this project as done',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_delete_project',
    description: 'Delete a project',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project UID or numeric ID' },
      },
      required: ['id'],
    },
  },

  // Areas (5)
  {
    name: 'tududi_list_areas',
    description: 'List all areas from Tududi',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tududi_get_area',
    description: 'Get a single area by UID or numeric ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Area UID or numeric ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_create_area',
    description: 'Create a new area in Tududi',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Area name' },
        description: { type: 'string', description: 'Area description' },
        color: { type: 'string', description: 'Area color hex code' },
      },
      required: ['name'],
    },
  },
  {
    name: 'tududi_update_area',
    description: 'Update an existing area',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Area UID or numeric ID' },
        name: { type: 'string', description: 'New area name' },
        description: { type: 'string', description: 'New area description' },
        color: { type: 'string', description: 'New area color hex code' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_delete_area',
    description: 'Delete an area',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Area UID or numeric ID' },
      },
      required: ['id'],
    },
  },

  // Tags (4)
  {
    name: 'tududi_list_tags',
    description: 'List tags with optional area or project scope filtering',
    inputSchema: {
      type: 'object',
      properties: {
        areaUid: { type: 'string', description: 'Filter tags used within an area UID' },
        projectUid: { type: 'string', description: 'Filter tags used within a project UID' },
      },
    },
  },
  {
    name: 'tududi_create_tag',
    description: 'Create a new tag',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tag name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'tududi_update_tag',
    description: 'Update a tag name, pinned state, or color by UID or current name',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Tag UID or current tag name' },
        name: { type: 'string', description: 'New tag name' },
        pinned: { type: 'boolean', description: 'Pin tag to sidebar' },
        color: { type: 'string', description: 'Tag color hex code (empty string clears)' },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'tududi_delete_tag',
    description: 'Delete a tag by UID or name',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Tag UID or tag name' },
      },
      required: ['identifier'],
    },
  },

  // Notes (5)
  {
    name: 'tududi_list_notes',
    description: 'List notes with optional sort order, tag, or scope filters',
    inputSchema: {
      type: 'object',
      properties: {
        orderBy: { type: 'string', description: 'Sort order (e.g. title:asc, updated_at:desc)' },
        tag: { type: 'string', description: 'Filter by single tag name' },
        areaUid: { type: 'string', description: 'Filter by area UID' },
        projectUid: { type: 'string', description: 'Filter by project UID' },
        tags: { ...STRING_ARRAY_PROP, description: 'Filter by tag names (AND semantics)' },
      },
    },
  },
  {
    name: 'tududi_get_note',
    description: 'Get a single note by UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Note UID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_create_note',
    description: 'Create a new note in Tududi',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note markdown content' },
        projectId: { type: 'string', description: 'Project numeric ID or UID' },
        tags: { ...STRING_ARRAY_PROP, description: 'Tag names to assign to the note' },
        color: { type: 'string', description: 'Note color' },
      },
      required: ['title'],
    },
  },
  {
    name: 'tududi_update_note',
    description: 'Update an existing note',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Note UID' },
        title: { type: 'string', description: 'New note title' },
        content: { type: 'string', description: 'New note markdown content' },
        projectId: { type: 'string', description: 'Project numeric ID or UID (empty clears)' },
        tags: { ...STRING_ARRAY_PROP, description: 'Updated tag names' },
        color: { type: 'string', description: 'Note color' },
        pinned: { type: 'boolean', description: 'Pin note to sidebar' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_delete_note',
    description: 'Delete a note by UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Note UID' },
      },
      required: ['id'],
    },
  },

  // Inbox (6)
  {
    name: 'tududi_list_inbox',
    description: 'List active GTD inbox capture items',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max inbox items to return' },
        offset: { type: 'number', description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'tududi_get_inbox_item',
    description: 'Get a single inbox item by UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Inbox item UID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_create_inbox_item',
    description: 'Quick-capture a raw item into the Tududi GTD inbox',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Captured text or idea' },
        source: { type: 'string', description: 'Optional capture source label' },
      },
      required: ['content'],
    },
  },
  {
    name: 'tududi_update_inbox_item',
    description: 'Update an inbox item content or status',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Inbox item UID' },
        content: { type: 'string', description: 'Updated content' },
        status: { type: 'string', description: 'Updated inbox item status' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_process_inbox_item',
    description: 'Mark an inbox item as processed, optionally linking the resulting entity UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Inbox item UID' },
        taskUid: { type: 'string', description: 'UID of task created from this inbox item' },
        projectUid: { type: 'string', description: 'UID of project created from this inbox item' },
        noteUid: { type: 'string', description: 'UID of note created from this inbox item' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_delete_inbox_item',
    description: 'Delete an inbox item by UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Inbox item UID' },
      },
      required: ['id'],
    },
  },

  // Goals (5)
  {
    name: 'tududi_list_goals',
    description: 'List goals with optional area filter',
    inputSchema: {
      type: 'object',
      properties: {
        areaId: { type: 'string', description: 'Filter by area numeric ID or UID' },
      },
    },
  },
  {
    name: 'tududi_get_goal',
    description: 'Get a single goal by UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Goal UID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_create_goal',
    description: 'Create a new goal in Tududi',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Goal title' },
        ...SHARED_GOAL_WRITE_PROPS,
      },
      required: ['title'],
    },
  },
  {
    name: 'tududi_update_goal',
    description: 'Update an existing goal',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Goal UID' },
        title: { type: 'string', description: 'New goal title' },
        ...SHARED_GOAL_WRITE_PROPS,
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_delete_goal',
    description: 'Delete a goal by UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Goal UID' },
      },
      required: ['id'],
    },
  },

  // Habits (8)
  {
    name: 'tududi_list_habits',
    description: 'List active or archived habits with current streak/progress evaluations',
    inputSchema: {
      type: 'object',
      properties: {
        archived: { type: 'boolean', description: 'When true, list archived habits instead' },
      },
    },
  },
  {
    name: 'tududi_get_habit',
    description: 'Get details and evaluation for a single habit by UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Habit UID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_create_habit',
    description: 'Create a new habit in Tududi',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Habit name' },
        ...SHARED_HABIT_WRITE_PROPS,
      },
      required: ['name'],
    },
  },
  {
    name: 'tududi_update_habit',
    description: 'Update habit settings and/or archive state',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Habit UID' },
        name: { type: 'string', description: 'New habit name' },
        ...SHARED_HABIT_WRITE_PROPS,
        archived: { type: 'boolean', description: 'Archive (true) or unarchive (false) the habit' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_log_habit_completion',
    description: 'Log a completion for a habit',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Habit UID' },
        completedAt: { type: 'string', description: 'Optional ISO completion timestamp' },
        value: { type: 'number', description: 'Optional measured value (for targetValue habits)' },
        note: { type: 'string', description: 'Optional completion note' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_skip_habit_day',
    description: 'Skip a habit for a specific day without breaking streak logic',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Habit UID' },
        date: { type: 'string', description: 'Date to skip (YYYY-MM-DD)' },
        note: { type: 'string', description: 'Optional reason note' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_get_habit_stats',
    description: 'Get completion statistics and streaks for a habit',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Habit UID' },
        startDate: { type: 'string', description: 'Optional range start date (ISO/YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'Optional range end date (ISO/YYYY-MM-DD)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'tududi_delete_habit',
    description: 'Delete a habit by UID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Habit UID' },
      },
      required: ['id'],
    },
  },
];

function requireString(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing or invalid required parameter: ${field}`);
  }
  return value.trim();
}

function optionalObject<T>(args: Record<string, unknown>): T | undefined {
  return Object.keys(args).length > 0 ? (args as unknown as T) : undefined;
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

function jsonResult(data: unknown, prefix?: string): CallToolResult {
  const json = JSON.stringify(data, null, 2);
  return textResult(prefix ? `${prefix}\n${json}` : json);
}

export async function executeToolCall(
  client: TududuClient,
  name: string,
  rawArgs: unknown
): Promise<CallToolResult> {
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  switch (name) {
    // Tasks & Subtasks
    case 'tududi_list_tasks':
      return jsonResult(await client.listTasks(optionalObject<ListTasksParams>(args)));
    case 'tududi_get_task':
      return jsonResult(await client.getTask(requireString(args, 'id')));
    case 'tududi_create_task':
      requireString(args, 'title');
      return jsonResult(
        await client.createTask(args as unknown as CreateTaskInput),
        'Task created successfully:'
      );
    case 'tududi_update_task': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...updateData } = args as unknown as UpdateTaskInput & { id: string };
      void _omitted;
      return jsonResult(await client.updateTask(id, updateData), 'Task updated successfully:');
    }
    case 'tududi_complete_task':
      return jsonResult(
        await client.completeTask(requireString(args, 'id')),
        'Task completed successfully:'
      );
    case 'tududi_delete_task': {
      const id = requireString(args, 'id');
      await client.deleteTask(id);
      return textResult(`Task ${id} deleted successfully`);
    }
    case 'tududi_search_tasks':
      return jsonResult(await client.searchTasks(args as unknown as SearchTasksParams));
    case 'tududi_get_task_metrics': {
      const type = typeof args.type === 'string' ? args.type : undefined;
      return jsonResult(await client.getTaskMetrics(type));
    }
    case 'tududi_list_subtasks':
      return jsonResult(await client.listSubtasks(requireString(args, 'taskId')));
    case 'tududi_create_subtask': {
      const taskId = requireString(args, 'taskId');
      requireString(args, 'title');
      const { taskId: _omitted, ...subtaskInput } = args as unknown as CreateSubtaskInput & {
        taskId: string;
      };
      void _omitted;
      return jsonResult(
        await client.createSubtask(taskId, subtaskInput),
        'Subtask created successfully:'
      );
    }

    // Comments
    case 'tududi_list_comments':
      return jsonResult(await client.listComments(requireString(args, 'taskId')));
    case 'tududi_create_comment': {
      const taskId = requireString(args, 'taskId');
      requireString(args, 'content');
      const { taskId: _omitted, ...commentInput } = args as unknown as CreateCommentInput & {
        taskId: string;
      };
      void _omitted;
      return jsonResult(
        await client.createComment(taskId, commentInput),
        'Comment created successfully:'
      );
    }
    case 'tududi_delete_comment': {
      const commentId = requireString(args, 'commentId');
      const result = await client.deleteComment(commentId);
      return result
        ? jsonResult(result, 'Comment deleted:')
        : textResult(`Comment ${commentId} deleted successfully`);
    }

    // Projects
    case 'tududi_list_projects':
      return jsonResult(await client.listProjects(optionalObject<ListProjectsParams>(args)));
    case 'tududi_get_project':
      return jsonResult(await client.getProject(requireString(args, 'id')));
    case 'tududi_create_project':
      requireString(args, 'name');
      return jsonResult(
        await client.createProject(args as unknown as CreateProjectInput),
        'Project created successfully:'
      );
    case 'tududi_update_project': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...projectData } = args as unknown as UpdateProjectInput & {
        id: string;
      };
      void _omitted;
      return jsonResult(
        await client.updateProject(id, projectData),
        'Project updated successfully:'
      );
    }
    case 'tududi_complete_project': {
      const id = requireString(args, 'id');
      const completeOpenTasks = args.completeOpenTasks === true;
      return jsonResult(
        await client.completeProject(id, completeOpenTasks),
        'Project completed successfully:'
      );
    }
    case 'tududi_delete_project': {
      const id = requireString(args, 'id');
      await client.deleteProject(id);
      return textResult(`Project ${id} deleted successfully`);
    }

    // Areas
    case 'tududi_list_areas':
      return jsonResult(await client.listAreas());
    case 'tududi_get_area':
      return jsonResult(await client.getArea(requireString(args, 'id')));
    case 'tududi_create_area':
      requireString(args, 'name');
      return jsonResult(
        await client.createArea(args as unknown as CreateAreaInput),
        'Area created successfully:'
      );
    case 'tududi_update_area': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...areaData } = args as unknown as UpdateAreaInput & { id: string };
      void _omitted;
      return jsonResult(await client.updateArea(id, areaData), 'Area updated successfully:');
    }
    case 'tududi_delete_area': {
      const id = requireString(args, 'id');
      await client.deleteArea(id);
      return textResult(`Area ${id} deleted successfully`);
    }

    // Tags
    case 'tududi_list_tags':
      return jsonResult(await client.listTags(optionalObject<ListTagsParams>(args)));
    case 'tududi_create_tag':
      requireString(args, 'name');
      return jsonResult(
        await client.createTag(args as unknown as CreateTagInput),
        'Tag created successfully:'
      );
    case 'tududi_update_tag': {
      const identifier = requireString(args, 'identifier');
      const { identifier: _omitted, ...tagData } = args as unknown as UpdateTagInput & {
        identifier: string;
      };
      void _omitted;
      return jsonResult(await client.updateTag(identifier, tagData), 'Tag updated successfully:');
    }
    case 'tududi_delete_tag': {
      const identifier = requireString(args, 'identifier');
      await client.deleteTag(identifier);
      return textResult(`Tag ${identifier} deleted successfully`);
    }

    // Notes
    case 'tududi_list_notes':
      return jsonResult(await client.listNotes(optionalObject<ListNotesParams>(args)));
    case 'tududi_get_note':
      return jsonResult(await client.getNote(requireString(args, 'id')));
    case 'tududi_create_note':
      requireString(args, 'title');
      return jsonResult(
        await client.createNote(args as unknown as CreateNoteInput),
        'Note created successfully:'
      );
    case 'tududi_update_note': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...noteData } = args as unknown as UpdateNoteInput & { id: string };
      void _omitted;
      return jsonResult(await client.updateNote(id, noteData), 'Note updated successfully:');
    }
    case 'tududi_delete_note': {
      const id = requireString(args, 'id');
      await client.deleteNote(id);
      return textResult(`Note ${id} deleted successfully`);
    }

    // Inbox
    case 'tududi_list_inbox':
      return jsonResult(await client.listInboxItems(optionalObject<ListInboxParams>(args)));
    case 'tududi_get_inbox_item':
      return jsonResult(await client.getInboxItem(requireString(args, 'id')));
    case 'tududi_create_inbox_item':
      requireString(args, 'content');
      return jsonResult(
        await client.createInboxItem(args as unknown as CreateInboxItemInput),
        'Inbox item captured:'
      );
    case 'tududi_update_inbox_item': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...inboxData } = args as unknown as UpdateInboxItemInput & {
        id: string;
      };
      void _omitted;
      return jsonResult(
        await client.updateInboxItem(id, inboxData),
        'Inbox item updated successfully:'
      );
    }
    case 'tududi_process_inbox_item': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...processData } = args as unknown as ProcessInboxItemInput & {
        id: string;
      };
      void _omitted;
      return jsonResult(
        await client.processInboxItem(id, optionalObject<ProcessInboxItemInput>(processData)),
        'Inbox item processed:'
      );
    }
    case 'tududi_delete_inbox_item': {
      const id = requireString(args, 'id');
      await client.deleteInboxItem(id);
      return textResult(`Inbox item ${id} deleted successfully`);
    }

    // Goals
    case 'tududi_list_goals':
      return jsonResult(await client.listGoals(optionalObject<ListGoalsParams>(args)));
    case 'tududi_get_goal':
      return jsonResult(await client.getGoal(requireString(args, 'id')));
    case 'tududi_create_goal':
      requireString(args, 'title');
      return jsonResult(
        await client.createGoal(args as unknown as CreateGoalInput),
        'Goal created successfully:'
      );
    case 'tududi_update_goal': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...goalData } = args as unknown as UpdateGoalInput & { id: string };
      void _omitted;
      return jsonResult(await client.updateGoal(id, goalData), 'Goal updated successfully:');
    }
    case 'tududi_delete_goal': {
      const id = requireString(args, 'id');
      await client.deleteGoal(id);
      return textResult(`Goal ${id} deleted successfully`);
    }

    // Habits
    case 'tududi_list_habits':
      return jsonResult(await client.listHabits(optionalObject<ListHabitsParams>(args)));
    case 'tududi_get_habit':
      return jsonResult(await client.getHabit(requireString(args, 'id')));
    case 'tududi_create_habit':
      requireString(args, 'name');
      return jsonResult(
        await client.createHabit(args as unknown as CreateHabitInput),
        'Habit created successfully:'
      );
    case 'tududi_update_habit': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...habitData } = args as unknown as UpdateHabitInput & { id: string };
      void _omitted;
      return jsonResult(await client.updateHabit(id, habitData), 'Habit updated successfully:');
    }
    case 'tududi_log_habit_completion': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...completionData } = args as unknown as LogHabitCompletionInput & {
        id: string;
      };
      void _omitted;
      return jsonResult(
        await client.logHabitCompletion(
          id,
          optionalObject<LogHabitCompletionInput>(completionData)
        ),
        'Habit completion logged:'
      );
    }
    case 'tududi_skip_habit_day': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...skipData } = args as unknown as SkipHabitDayInput & { id: string };
      void _omitted;
      return jsonResult(
        await client.skipHabitDay(id, optionalObject<SkipHabitDayInput>(skipData)),
        'Habit day skipped:'
      );
    }
    case 'tududi_get_habit_stats': {
      const id = requireString(args, 'id');
      const { id: _omitted, ...statsParams } = args as unknown as HabitStatsParams & { id: string };
      void _omitted;
      return jsonResult(
        await client.getHabitStats(id, optionalObject<HabitStatsParams>(statsParams))
      );
    }
    case 'tududi_delete_habit': {
      const id = requireString(args, 'id');
      await client.deleteHabit(id);
      return textResult(`Habit ${id} deleted successfully`);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
