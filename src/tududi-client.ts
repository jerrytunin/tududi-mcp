import axios, { AxiosInstance } from 'axios';
import { normalizeTududiApiUrl } from './config.js';
import { logger } from './logger.js';
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
  TududuArea,
  TududuComment,
  TududuGoal,
  TududuHabit,
  TududuInboxItem,
  TududuNote,
  TududuProject,
  TududuTag,
  TududuTask,
  TududuTaskMetrics,
  UpdateAreaInput,
  UpdateGoalInput,
  UpdateHabitInput,
  UpdateInboxItemInput,
  UpdateNoteInput,
  UpdateProjectInput,
  UpdateTagInput,
  UpdateTaskInput,
} from './types.js';

const PRIORITY_MAP: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function unwrapList<T>(data: T[] | Record<string, unknown>, key: string): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  const nested = data?.[key];
  return Array.isArray(nested) ? (nested as T[]) : [];
}

function unwrapEntity<T>(data: T | Record<string, unknown>, key: string): T {
  if (data && typeof data === 'object' && key in data) {
    const nested = (data as Record<string, unknown>)[key];
    if (nested && typeof nested === 'object') {
      return nested as T;
    }
  }
  return data as T;
}

function formatCookieHeader(setCookie: string | string[]): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((cookie) => cookie.split(';')[0].trim()).join('; ');
}

function assignIdOrUidParam(
  qp: Record<string, unknown>,
  value: string | undefined,
  idKey: string,
  uidKey: string
): void {
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  if (isNumericId(trimmed)) {
    qp[idKey] = trimmed;
  } else {
    qp[uidKey] = trimmed;
  }
}

function optionalParams(
  qp: Record<string, unknown>
): { params: Record<string, unknown> } | undefined {
  return Object.keys(qp).length > 0 ? { params: qp } : undefined;
}

// Tududi 1.1+ expects snake_case fields with `name` instead of `title` and `note` instead of `description`
function mapTaskInput(input: CreateTaskInput | UpdateTaskInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.name = input.title;
  if (input.description !== undefined) out.note = input.description;
  if (input.projectId !== undefined) out.project_id = input.projectId;
  if (input.areaId !== undefined) out.area_id = input.areaId;
  if (input.goalId !== undefined) out.goal_id = input.goalId;
  if (input.parentTaskId !== undefined) {
    out.parent_task_id = isNumericId(input.parentTaskId)
      ? Number(input.parentTaskId.trim())
      : input.parentTaskId;
  }
  if (input.dueDate !== undefined) out.due_date = input.dueDate;
  if (input.dueTime !== undefined) out.due_time = input.dueTime;
  if (input.deferUntil !== undefined) out.defer_until = input.deferUntil;
  if (input.startDate !== undefined) out.start_date = input.startDate;
  if (input.startTime !== undefined) out.start_time = input.startTime;
  if (input.estimatedMinutes !== undefined) out.estimated_minutes = input.estimatedMinutes;
  if (input.priority !== undefined) {
    out.priority = PRIORITY_MAP[input.priority] ?? input.priority;
  }
  if (input.status !== undefined) {
    out.status = input.status;
  } else if ('completed' in input && input.completed !== undefined) {
    out.status = input.completed ? 'done' : 'not_started';
  }
  if (input.today !== undefined) out.today = input.today;
  if (input.recurrenceType !== undefined) out.recurrence_type = input.recurrenceType;
  if (input.recurrenceInterval !== undefined) out.recurrence_interval = input.recurrenceInterval;
  if (input.recurrenceEndDate !== undefined) out.recurrence_end_date = input.recurrenceEndDate;
  if (input.recurrenceWeekday !== undefined) out.recurrence_weekday = input.recurrenceWeekday;
  if (input.recurrenceWeekdays !== undefined) out.recurrence_weekdays = input.recurrenceWeekdays;
  if (input.recurrenceMonthDay !== undefined) out.recurrence_month_day = input.recurrenceMonthDay;
  if (input.completionBased !== undefined) out.completion_based = input.completionBased;
  if (Array.isArray(input.tags)) {
    out.tags = input.tags;
  }
  if ('subtasks' in input && Array.isArray(input.subtasks)) {
    out.subtasks = input.subtasks.map((sub) => ({
      name: sub.name,
      ...(sub.priority !== undefined
        ? { priority: PRIORITY_MAP[sub.priority] ?? sub.priority }
        : {}),
      ...(sub.status !== undefined ? { status: sub.status } : {}),
    }));
  }
  return out;
}

function mapProjectInput(input: CreateProjectInput | UpdateProjectInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.description !== undefined) out.description = input.description;
  if (input.areaId !== undefined) out.area_id = input.areaId;
  if (input.goalId !== undefined) out.goal_id = input.goalId;
  if (input.color !== undefined) out.color = input.color;
  if (input.status !== undefined) out.status = input.status;
  if (input.priority !== undefined) {
    out.priority = PRIORITY_MAP[input.priority] ?? input.priority;
  }
  if (input.dueDate !== undefined) out.due_date_at = input.dueDate;
  if (input.pinned !== undefined) out.pin_to_sidebar = input.pinned;
  if (Array.isArray(input.tags)) {
    out.tags = input.tags.map((tag) => (typeof tag === 'string' ? { name: tag } : tag));
  }
  return out;
}

function mapNoteInput(input: CreateNoteInput | UpdateNoteInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.content !== undefined) out.content = input.content;
  if (input.projectId !== undefined) {
    const trimmed = input.projectId.trim();
    if (trimmed === '') {
      out.project_id = null;
    } else if (isNumericId(trimmed)) {
      out.project_id = Number(trimmed);
    } else {
      out.project_uid = trimmed;
    }
  }
  if (Array.isArray(input.tags)) {
    out.tags = input.tags;
  }
  if (input.color !== undefined) out.color = input.color;
  if ('pinned' in input && input.pinned !== undefined) {
    out.pin_to_sidebar = input.pinned;
  }
  return out;
}

function mapHabitInput(input: CreateHabitInput | UpdateHabitInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.description !== undefined) out.note = input.description;
  if (input.priority !== undefined) {
    out.priority = PRIORITY_MAP[input.priority] ?? input.priority;
  }
  if (input.polarity !== undefined) out.habit_polarity = input.polarity;
  if (input.frequencyPeriod !== undefined) out.habit_frequency_period = input.frequencyPeriod;
  if (input.targetCount !== undefined) out.habit_target_count = input.targetCount;
  if (input.targetValue !== undefined) out.habit_target_value = input.targetValue;
  if (input.unit !== undefined) out.habit_unit = input.unit;
  if (input.scheduleDays !== undefined) out.habit_schedule_days = input.scheduleDays;
  if (input.intervalDays !== undefined) out.habit_interval_days = input.intervalDays;
  if (input.timeOfDay !== undefined) out.habit_time_of_day = input.timeOfDay;
  if (input.reminderTime !== undefined) out.habit_reminder_time = input.reminderTime;
  if (input.color !== undefined) out.habit_color = input.color;
  return out;
}

export class TududuClient {
  private client: AxiosInstance;
  private sessionCookie?: string;
  private readonly hasApiKey: boolean;
  private readonly email?: string;
  private readonly password?: string;
  private loginPromise?: Promise<void>;
  private isAuthenticated = false;

  constructor(apiUrl: string, apiKey?: string, email?: string, password?: string) {
    this.hasApiKey = Boolean(apiKey);
    this.email = email;
    this.password = password;

    this.client = axios.create({
      baseURL: normalizeTududiApiUrl(apiUrl),
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
    });

    if (apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
    }

    this.client.interceptors.request.use(async (reqConfig) => {
      if (reqConfig.url !== '/api/v1/login') {
        await this.ensureAuthenticated();
        if (this.sessionCookie && reqConfig.headers) {
          if (typeof reqConfig.headers.set === 'function') {
            reqConfig.headers.set('Cookie', this.sessionCookie);
          } else {
            (reqConfig.headers as Record<string, string>)['Cookie'] = this.sessionCookie;
          }
        }
      }
      return reqConfig;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error({ error: error.message }, 'Tududi API error');
        throw error;
      }
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.hasApiKey || this.isAuthenticated || !this.email || !this.password) {
      return;
    }
    if (!this.loginPromise) {
      this.loginPromise = this.login(this.email, this.password).catch((error) => {
        this.loginPromise = undefined;
        throw error;
      });
    }
    await this.loginPromise;
  }

  private async login(email: string, password: string): Promise<void> {
    try {
      const response = await this.client.post('/api/v1/login', { email, password });
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        this.sessionCookie = formatCookieHeader(setCookie);
        this.client.defaults.headers.common['Cookie'] = this.sessionCookie;
      }
      this.isAuthenticated = true;
      logger.info('Successfully logged in to Tududi');
    } catch (error) {
      logger.error({ error }, 'Failed to login to Tududi');
      throw new Error('Failed to authenticate with Tududi');
    }
  }

  private async resolveNumericAreaId(areaId?: string): Promise<number | null | undefined> {
    if (areaId === undefined) {
      return undefined;
    }
    const trimmed = areaId.trim();
    if (trimmed === '') {
      return null;
    }
    if (isNumericId(trimmed)) {
      return Number(trimmed);
    }
    const area = await this.getArea(trimmed);
    const numericId = Number(area.id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Unable to resolve numeric area ID for "${areaId}"`);
    }
    return numericId;
  }

  // Tasks & Subtasks
  async listTasks(params?: ListTasksParams): Promise<TududuTask[]> {
    const qp: Record<string, unknown> = {};
    if (params?.type !== undefined) qp.type = params.type;
    if (params?.status !== undefined) qp.status = params.status;
    if (params?.priority !== undefined) qp.priority = params.priority;
    assignIdOrUidParam(qp, params?.projectId, 'project_id', 'project_uid');
    assignIdOrUidParam(qp, params?.areaId, 'area_id', 'area_uid');
    if (Array.isArray(params?.tags) && params.tags.length > 0) {
      qp.tags = params.tags.join(',');
    }
    if (params?.orderBy !== undefined) qp.order_by = params.orderBy;
    if (params?.includeSubtasks !== undefined) {
      qp.include_subtasks = String(params.includeSubtasks);
    }
    if (params?.limit !== undefined) qp.limit = params.limit;
    if (params?.offset !== undefined) qp.offset = params.offset;

    const response = await this.client.get<TududuTask[] | Record<string, unknown>>(
      '/api/v1/tasks',
      optionalParams(qp)
    );
    return unwrapList<TududuTask>(response.data, 'tasks');
  }

  async getTask(id: string): Promise<TududuTask> {
    const response = await this.client.get<TududuTask>(`/api/v1/task/${encodeURIComponent(id)}`);
    return response.data;
  }

  async createTask(input: CreateTaskInput): Promise<TududuTask> {
    const body = mapTaskInput(input);
    const response = await this.client.post<TududuTask>('/api/v1/task', body);
    return response.data;
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<TududuTask> {
    const body = mapTaskInput(input);
    const response = await this.client.patch<TududuTask>(
      `/api/v1/task/${encodeURIComponent(id)}`,
      body
    );
    return response.data;
  }

  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/api/v1/task/${encodeURIComponent(id)}`);
  }

  async completeTask(id: string): Promise<TududuTask> {
    return this.updateTask(id, { completed: true });
  }

  async searchTasks(params: SearchTasksParams): Promise<TududuTask[]> {
    const query = params.query?.trim();
    const qp: Record<string, unknown> = {};

    if (query) {
      qp.q = query;
      qp.filters = 'Task';
      if (params.completed !== undefined) {
        qp.status = params.completed ? 'completed' : 'active';
      }
      if (params.priority !== undefined) {
        qp.priority = params.priority;
      }
      if (Array.isArray(params.tags) && params.tags.length > 0) {
        qp.tags = params.tags.join(',');
      }
      if (params.projectId && !isNumericId(params.projectId)) {
        qp.project_uid = params.projectId.trim();
      }
      if (params.areaId && !isNumericId(params.areaId)) {
        qp.area_uid = params.areaId.trim();
      }

      const response = await this.client.get<TududuTask[] | Record<string, unknown>>(
        '/api/v1/search',
        { params: qp }
      );
      const data = response.data;
      let results: TududuTask[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? (data.results as TududuTask[])
          : unwrapList<TududuTask>(data, 'tasks');

      if (params.projectId && isNumericId(params.projectId)) {
        const targetProjectId = params.projectId.trim();
        results = results.filter((task) => {
          const projectObj = task.Project as { id?: string | number } | undefined;
          const idValue = task.project_id ?? task.projectId ?? projectObj?.id;
          return idValue !== undefined && idValue !== null && String(idValue) === targetProjectId;
        });
      }

      if (params.areaId && isNumericId(params.areaId)) {
        const targetAreaId = params.areaId.trim();
        results = results.filter((task) => {
          const areaObj = task.Area as { id?: string | number } | undefined;
          const idValue = task.area_id ?? task.areaId ?? areaObj?.id;
          return idValue !== undefined && idValue !== null && String(idValue) === targetAreaId;
        });
      }

      return results;
    }

    assignIdOrUidParam(qp, params.projectId, 'project_id', 'project_uid');
    assignIdOrUidParam(qp, params.areaId, 'area_id', 'area_uid');
    if (params.completed !== undefined) {
      qp.status = params.completed ? 'done' : 'active';
    }
    if (params.priority !== undefined) {
      qp.priority = params.priority;
    }
    if (Array.isArray(params.tags) && params.tags.length > 0) {
      qp.tags = params.tags.join(',');
    }

    const response = await this.client.get<TududuTask[] | Record<string, unknown>>(
      '/api/v1/tasks',
      { params: qp }
    );
    return unwrapList<TududuTask>(response.data, 'tasks');
  }

  async getTaskMetrics(type?: string): Promise<TududuTaskMetrics> {
    const qp: Record<string, unknown> = {};
    if (type !== undefined && type.trim().length > 0) {
      qp.type = type.trim();
    }
    const response = await this.client.get<TududuTaskMetrics>(
      '/api/v1/tasks/metrics',
      optionalParams(qp)
    );
    return response.data;
  }

  async listSubtasks(taskId: string): Promise<TududuTask[]> {
    const response = await this.client.get<TududuTask[] | Record<string, unknown>>(
      `/api/v1/task/${encodeURIComponent(taskId)}/subtasks`
    );
    return unwrapList<TududuTask>(response.data, 'subtasks');
  }

  async createSubtask(taskId: string, input: CreateSubtaskInput): Promise<TududuTask> {
    let parentNumericId: number;
    if (isNumericId(taskId)) {
      parentNumericId = Number(taskId.trim());
    } else {
      const parentTask = await this.getTask(taskId);
      parentNumericId = Number(parentTask.id);
      if (!Number.isFinite(parentNumericId)) {
        throw new Error(`Unable to resolve numeric parent task ID for "${taskId}"`);
      }
    }

    const body: Record<string, unknown> = {
      name: input.title,
      parent_task_id: parentNumericId,
    };
    if (input.priority !== undefined) {
      body.priority = PRIORITY_MAP[input.priority] ?? input.priority;
    }
    if (input.status !== undefined) {
      body.status = input.status;
    }

    const response = await this.client.post<TududuTask>('/api/v1/task', body);
    return response.data;
  }

  // Comments
  async listComments(taskId: string): Promise<TududuComment[]> {
    const response = await this.client.get<TududuComment[] | Record<string, unknown>>(
      `/api/v1/task/${encodeURIComponent(taskId)}/comments`
    );
    return unwrapList<TududuComment>(response.data, 'comments');
  }

  async createComment(taskId: string, input: CreateCommentInput): Promise<TududuComment> {
    const body: Record<string, unknown> = { body: input.content };
    if (input.parentCommentUid !== undefined) {
      body.parent_comment_uid = input.parentCommentUid;
    }
    const response = await this.client.post<TududuComment>(
      `/api/v1/task/${encodeURIComponent(taskId)}/comments`,
      body
    );
    return response.data;
  }

  async deleteComment(commentId: string): Promise<TududuComment | void> {
    const response = await this.client.delete<TududuComment | undefined>(
      `/api/v1/comment/${encodeURIComponent(commentId)}`
    );
    return response.data;
  }

  // Projects
  async listProjects(params?: ListProjectsParams): Promise<TududuProject[]> {
    const qp: Record<string, unknown> = {};
    if (params?.status !== undefined) qp.status = params.status;
    if (params?.active !== undefined) qp.active = String(params.active);
    assignIdOrUidParam(qp, params?.areaId, 'area_id', 'area_uid');
    if (params?.pinned !== undefined) qp.pin_to_sidebar = String(params.pinned);
    if (Array.isArray(params?.tags) && params.tags.length > 0) {
      qp.tags = params.tags.join(',');
    }

    const response = await this.client.get<TududuProject[] | Record<string, unknown>>(
      '/api/v1/projects',
      optionalParams(qp)
    );
    return unwrapList<TududuProject>(response.data, 'projects');
  }

  async getProject(id: string): Promise<TududuProject> {
    const response = await this.client.get<TududuProject>(
      `/api/v1/project/${encodeURIComponent(id)}`
    );
    return response.data;
  }

  async createProject(input: CreateProjectInput): Promise<TududuProject> {
    const body = mapProjectInput(input);
    const response = await this.client.post<TududuProject>('/api/v1/project', body);
    return response.data;
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<TududuProject> {
    const body = mapProjectInput(input);
    const response = await this.client.patch<TududuProject>(
      `/api/v1/project/${encodeURIComponent(id)}`,
      body
    );
    return response.data;
  }

  async completeProject(id: string, completeOpenTasks = false): Promise<Record<string, unknown>> {
    const response = await this.client.post<Record<string, unknown>>(
      `/api/v1/project/${encodeURIComponent(id)}/complete`,
      { complete_open_tasks: completeOpenTasks }
    );
    return response.data;
  }

  async deleteProject(id: string): Promise<void> {
    await this.client.delete(`/api/v1/project/${encodeURIComponent(id)}`);
  }

  // Areas
  async listAreas(): Promise<TududuArea[]> {
    const response = await this.client.get<TududuArea[] | Record<string, unknown>>('/api/v1/areas');
    return unwrapList<TududuArea>(response.data, 'areas');
  }

  async getArea(id: string): Promise<TududuArea> {
    const response = await this.client.get<TududuArea>(`/api/v1/areas/${encodeURIComponent(id)}`);
    return response.data;
  }

  async createArea(input: CreateAreaInput): Promise<TududuArea> {
    const response = await this.client.post<TududuArea>('/api/v1/areas', input);
    return response.data;
  }

  async updateArea(id: string, input: UpdateAreaInput): Promise<TududuArea> {
    const response = await this.client.patch<TududuArea>(
      `/api/v1/areas/${encodeURIComponent(id)}`,
      input
    );
    return response.data;
  }

  async deleteArea(id: string): Promise<void> {
    await this.client.delete(`/api/v1/areas/${encodeURIComponent(id)}`);
  }

  // Tags
  async listTags(params?: ListTagsParams): Promise<TududuTag[]> {
    const qp: Record<string, unknown> = {};
    if (params?.areaUid !== undefined) qp.area_uid = params.areaUid;
    if (params?.projectUid !== undefined) qp.project_uid = params.projectUid;

    const response = await this.client.get<TududuTag[] | Record<string, unknown>>(
      '/api/v1/tags',
      optionalParams(qp)
    );
    return unwrapList<TududuTag>(response.data, 'tags');
  }

  async createTag(input: CreateTagInput): Promise<TududuTag> {
    const response = await this.client.post<TududuTag>('/api/v1/tag', { name: input.name });
    return response.data;
  }

  async updateTag(identifier: string, input: UpdateTagInput): Promise<TududuTag> {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.pinned !== undefined) body.pinned = input.pinned;
    if (input.color !== undefined) body.color = input.color;

    const response = await this.client.patch<TududuTag>(
      `/api/v1/tag/${encodeURIComponent(identifier)}`,
      body
    );
    return response.data;
  }

  async deleteTag(identifier: string): Promise<void> {
    await this.client.delete(`/api/v1/tag/${encodeURIComponent(identifier)}`);
  }

  // Notes
  async listNotes(params?: ListNotesParams): Promise<TududuNote[]> {
    const qp: Record<string, unknown> = {};
    if (params?.orderBy !== undefined) qp.order_by = params.orderBy;
    if (params?.tag !== undefined) qp.tag = params.tag;
    if (params?.areaUid !== undefined) qp.area_uid = params.areaUid;
    if (params?.projectUid !== undefined) qp.project_uid = params.projectUid;
    if (Array.isArray(params?.tags) && params.tags.length > 0) {
      qp.tags = params.tags.join(',');
    }

    const response = await this.client.get<TududuNote[] | Record<string, unknown>>(
      '/api/v1/notes',
      optionalParams(qp)
    );
    return unwrapList<TududuNote>(response.data, 'notes');
  }

  async getNote(id: string): Promise<TududuNote> {
    const response = await this.client.get<TududuNote>(`/api/v1/note/${encodeURIComponent(id)}`);
    return response.data;
  }

  async createNote(input: CreateNoteInput): Promise<TududuNote> {
    const body = mapNoteInput(input);
    const response = await this.client.post<TududuNote>('/api/v1/note', body);
    return response.data;
  }

  async updateNote(id: string, input: UpdateNoteInput): Promise<TududuNote> {
    const body = mapNoteInput(input);
    const response = await this.client.patch<TududuNote>(
      `/api/v1/note/${encodeURIComponent(id)}`,
      body
    );
    return response.data;
  }

  async deleteNote(id: string): Promise<void> {
    await this.client.delete(`/api/v1/note/${encodeURIComponent(id)}`);
  }

  // Inbox
  async listInboxItems(params?: ListInboxParams): Promise<TududuInboxItem[]> {
    const qp: Record<string, unknown> = {};
    if (params?.limit !== undefined) qp.limit = params.limit;
    if (params?.offset !== undefined) qp.offset = params.offset;

    const response = await this.client.get<TududuInboxItem[] | Record<string, unknown>>(
      '/api/v1/inbox',
      optionalParams(qp)
    );
    return unwrapList<TududuInboxItem>(response.data, 'items');
  }

  async getInboxItem(id: string): Promise<TududuInboxItem> {
    const response = await this.client.get<TududuInboxItem>(
      `/api/v1/inbox/${encodeURIComponent(id)}`
    );
    return response.data;
  }

  async createInboxItem(input: CreateInboxItemInput): Promise<TududuInboxItem> {
    const body: Record<string, unknown> = { content: input.content };
    if (input.source !== undefined) {
      body.source = input.source;
    }
    const response = await this.client.post<TududuInboxItem>('/api/v1/inbox', body);
    return response.data;
  }

  async updateInboxItem(id: string, input: UpdateInboxItemInput): Promise<TududuInboxItem> {
    const body: Record<string, unknown> = {};
    if (input.content !== undefined) body.content = input.content;
    if (input.status !== undefined) body.status = input.status;

    const response = await this.client.patch<TududuInboxItem>(
      `/api/v1/inbox/${encodeURIComponent(id)}`,
      body
    );
    return response.data;
  }

  async processInboxItem(id: string, input?: ProcessInboxItemInput): Promise<TududuInboxItem> {
    const body: Record<string, unknown> = {};
    if (input?.taskUid !== undefined) body.task_uid = input.taskUid;
    if (input?.projectUid !== undefined) body.project_uid = input.projectUid;
    if (input?.noteUid !== undefined) body.note_uid = input.noteUid;

    const response = await this.client.patch<TududuInboxItem>(
      `/api/v1/inbox/${encodeURIComponent(id)}/process`,
      body
    );
    return response.data;
  }

  async deleteInboxItem(id: string): Promise<void> {
    await this.client.delete(`/api/v1/inbox/${encodeURIComponent(id)}`);
  }

  // Goals
  async listGoals(params?: ListGoalsParams): Promise<TududuGoal[]> {
    const qp: Record<string, unknown> = {};
    assignIdOrUidParam(qp, params?.areaId, 'area_id', 'area_uid');

    const response = await this.client.get<TududuGoal[] | Record<string, unknown>>(
      '/api/v1/goals',
      optionalParams(qp)
    );
    return unwrapList<TududuGoal>(response.data, 'goals');
  }

  async getGoal(id: string): Promise<TududuGoal> {
    const response = await this.client.get<TududuGoal | Record<string, unknown>>(
      `/api/v1/goals/${encodeURIComponent(id)}`
    );
    return unwrapEntity<TududuGoal>(response.data, 'goal');
  }

  async createGoal(input: CreateGoalInput): Promise<TududuGoal> {
    const body: Record<string, unknown> = { title: input.title };
    const resolvedAreaId = await this.resolveNumericAreaId(input.areaId);
    if (resolvedAreaId !== undefined) body.area_id = resolvedAreaId;
    if (input.why !== undefined) body.why = input.why;
    if (input.horizon !== undefined) body.horizon = input.horizon;
    if (input.targetDate !== undefined) body.target_date = input.targetDate;
    if (input.status !== undefined) body.status = input.status;
    if (input.color !== undefined) body.color = input.color;

    const response = await this.client.post<TududuGoal | Record<string, unknown>>(
      '/api/v1/goals',
      body
    );
    return unwrapEntity<TududuGoal>(response.data, 'goal');
  }

  async updateGoal(id: string, input: UpdateGoalInput): Promise<TududuGoal> {
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.areaId !== undefined) {
      body.area_id = await this.resolveNumericAreaId(input.areaId);
    }
    if (input.why !== undefined) body.why = input.why;
    if (input.horizon !== undefined) body.horizon = input.horizon;
    if (input.targetDate !== undefined) body.target_date = input.targetDate;
    if (input.status !== undefined) body.status = input.status;
    if (input.color !== undefined) body.color = input.color;

    const response = await this.client.patch<TududuGoal | Record<string, unknown>>(
      `/api/v1/goals/${encodeURIComponent(id)}`,
      body
    );
    return unwrapEntity<TududuGoal>(response.data, 'goal');
  }

  async deleteGoal(id: string): Promise<void> {
    await this.client.delete(`/api/v1/goals/${encodeURIComponent(id)}`);
  }

  // Habits
  async listHabits(params?: ListHabitsParams): Promise<TududuHabit[]> {
    const qp: Record<string, unknown> = {};
    if (params?.archived === true) {
      qp.archived = 'true';
    }
    const response = await this.client.get<TududuHabit[] | Record<string, unknown>>(
      '/api/v1/habits',
      optionalParams(qp)
    );
    return unwrapList<TududuHabit>(response.data, 'habits');
  }

  async getHabit(id: string): Promise<TududuHabit> {
    const response = await this.client.get<TududuHabit | Record<string, unknown>>(
      `/api/v1/habits/${encodeURIComponent(id)}`
    );
    return unwrapEntity<TududuHabit>(response.data, 'habit');
  }

  async createHabit(input: CreateHabitInput): Promise<TududuHabit> {
    const body = mapHabitInput(input);
    const response = await this.client.post<TududuHabit | Record<string, unknown>>(
      '/api/v1/habits',
      body
    );
    return unwrapEntity<TududuHabit>(response.data, 'habit');
  }

  async updateHabit(id: string, input: UpdateHabitInput): Promise<TududuHabit> {
    const body = mapHabitInput(input);
    const hasSettingFields = Object.keys(body).length > 0;
    let latestHabit: TududuHabit | undefined;

    if (hasSettingFields || input.archived === undefined) {
      const response = await this.client.put<TududuHabit | Record<string, unknown>>(
        `/api/v1/habits/${encodeURIComponent(id)}`,
        body
      );
      latestHabit = unwrapEntity<TududuHabit>(response.data, 'habit');
    }

    if (input.archived !== undefined) {
      const action = input.archived ? 'archive' : 'unarchive';
      const response = await this.client.post<TududuHabit | Record<string, unknown>>(
        `/api/v1/habits/${encodeURIComponent(id)}/${action}`
      );
      latestHabit = unwrapEntity<TududuHabit>(response.data, 'habit');
    }

    return latestHabit!;
  }

  async logHabitCompletion(
    id: string,
    input?: LogHabitCompletionInput
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {};
    if (input?.completedAt !== undefined) body.completed_at = input.completedAt;
    if (input?.value !== undefined) body.value = input.value;
    if (input?.note !== undefined) body.note = input.note;

    const response = await this.client.post<Record<string, unknown>>(
      `/api/v1/habits/${encodeURIComponent(id)}/complete`,
      body
    );
    return response.data;
  }

  async skipHabitDay(id: string, input?: SkipHabitDayInput): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {};
    if (input?.date !== undefined) body.date = input.date;
    if (input?.note !== undefined) body.note = input.note;

    const response = await this.client.post<Record<string, unknown>>(
      `/api/v1/habits/${encodeURIComponent(id)}/skip`,
      body
    );
    return response.data;
  }

  async getHabitStats(id: string, params?: HabitStatsParams): Promise<Record<string, unknown>> {
    const qp: Record<string, unknown> = {};
    if (params?.startDate !== undefined) qp.start_date = params.startDate;
    if (params?.endDate !== undefined) qp.end_date = params.endDate;

    const response = await this.client.get<Record<string, unknown>>(
      `/api/v1/habits/${encodeURIComponent(id)}/stats`,
      optionalParams(qp)
    );
    return response.data;
  }

  async deleteHabit(id: string): Promise<void> {
    await this.client.delete(`/api/v1/habits/${encodeURIComponent(id)}`);
  }
}
