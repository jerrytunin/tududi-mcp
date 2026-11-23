import { AddressInfo } from 'net';
import request from 'supertest';
import { createExpressApp } from '../server.js';
import { TududuClient } from '../tududi-client.js';
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
} from '../types.js';

interface JsonRpcResponse {
  jsonrpc: string;
  id?: string | number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

function parseMcpResponse(res: request.Response): JsonRpcResponse {
  const contentType = String(res.headers['content-type'] || '');
  if (contentType.includes('application/json')) {
    return res.body as JsonRpcResponse;
  }

  const dataLines = res.text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .filter((line) => line.length > 0);

  if (dataLines.length === 0) {
    throw new Error(`No JSON or SSE data found in MCP response: ${res.text}`);
  }
  return JSON.parse(dataLines[dataLines.length - 1]) as JsonRpcResponse;
}

interface MockClientResult {
  client: TududuClient;
  calls: {
    listTasks: Array<ListTasksParams | undefined>;
    getTask: string[];
    createTask: CreateTaskInput[];
    updateTask: Array<{ id: string; data: UpdateTaskInput }>;
    deleteTask: string[];
    completeTask: string[];
    searchTasks: SearchTasksParams[];
    getTaskMetrics: Array<string | undefined>;
    listSubtasks: string[];
    createSubtask: Array<{ taskId: string; data: CreateSubtaskInput }>;
    listComments: string[];
    createComment: Array<{ taskId: string; data: CreateCommentInput }>;
    deleteComment: string[];
    listProjects: number;
    getProject: string[];
    createProject: CreateProjectInput[];
    updateProject: Array<{ id: string; data: UpdateProjectInput }>;
    completeProject: Array<{ id: string; completeOpenTasks: boolean }>;
    deleteProject: string[];
    listAreas: number;
    getArea: string[];
    createArea: CreateAreaInput[];
    updateArea: Array<{ id: string; data: UpdateAreaInput }>;
    deleteArea: string[];
    listTags: number;
    createTag: CreateTagInput[];
    updateTag: Array<{ identifier: string; data: UpdateTagInput }>;
    deleteTag: string[];
    listNotes: number;
    getNote: string[];
    createNote: CreateNoteInput[];
    updateNote: Array<{ id: string; data: UpdateNoteInput }>;
    deleteNote: string[];
    listInboxItems: number;
    getInboxItem: string[];
    createInboxItem: CreateInboxItemInput[];
    updateInboxItem: Array<{ id: string; data: UpdateInboxItemInput }>;
    processInboxItem: Array<{ id: string; data: ProcessInboxItemInput | undefined }>;
    deleteInboxItem: string[];
    listGoals: number;
    getGoal: string[];
    createGoal: CreateGoalInput[];
    updateGoal: Array<{ id: string; data: UpdateGoalInput }>;
    deleteGoal: string[];
    listHabits: number;
    getHabit: string[];
    createHabit: CreateHabitInput[];
    updateHabit: Array<{ id: string; data: UpdateHabitInput }>;
    logHabitCompletion: Array<{ id: string; data: LogHabitCompletionInput | undefined }>;
    skipHabitDay: Array<{ id: string; data: SkipHabitDayInput | undefined }>;
    getHabitStats: Array<{ id: string; params: HabitStatsParams | undefined }>;
    deleteHabit: string[];
  };
}

function createFakeClient(options?: { throwOnListTasks?: boolean }): MockClientResult {
  const calls: MockClientResult['calls'] = {
    listTasks: [],
    getTask: [],
    createTask: [],
    updateTask: [],
    deleteTask: [],
    completeTask: [],
    searchTasks: [],
    getTaskMetrics: [],
    listSubtasks: [],
    createSubtask: [],
    listComments: [],
    createComment: [],
    deleteComment: [],
    listProjects: 0,
    getProject: [],
    createProject: [],
    updateProject: [],
    completeProject: [],
    deleteProject: [],
    listAreas: 0,
    getArea: [],
    createArea: [],
    updateArea: [],
    deleteArea: [],
    listTags: 0,
    createTag: [],
    updateTag: [],
    deleteTag: [],
    listNotes: 0,
    getNote: [],
    createNote: [],
    updateNote: [],
    deleteNote: [],
    listInboxItems: 0,
    getInboxItem: [],
    createInboxItem: [],
    updateInboxItem: [],
    processInboxItem: [],
    deleteInboxItem: [],
    listGoals: 0,
    getGoal: [],
    createGoal: [],
    updateGoal: [],
    deleteGoal: [],
    listHabits: 0,
    getHabit: [],
    createHabit: [],
    updateHabit: [],
    logHabitCompletion: [],
    skipHabitDay: [],
    getHabitStats: [],
    deleteHabit: [],
  };

  const fakeClient: Partial<TududuClient> = {
    listTasks: async (params?: ListTasksParams): Promise<TududuTask[]> => {
      calls.listTasks.push(params);
      if (options?.throwOnListTasks) {
        throw new Error('Upstream Tududi unavailable');
      }
      return [{ id: 1, uid: 'task-uid-1', name: 'Sample task' }];
    },
    getTask: async (id: string): Promise<TududuTask> => {
      calls.getTask.push(id);
      return { id: 1, uid: id, name: 'Sample task' };
    },
    createTask: async (input: CreateTaskInput): Promise<TududuTask> => {
      calls.createTask.push(input);
      return { id: 2, uid: 'task-uid-2', name: input.title };
    },
    updateTask: async (id: string, input: UpdateTaskInput): Promise<TududuTask> => {
      calls.updateTask.push({ id, data: input });
      return { id: 2, uid: id, name: input.title || 'Updated task' };
    },
    deleteTask: async (id: string): Promise<void> => {
      calls.deleteTask.push(id);
    },
    completeTask: async (id: string): Promise<TududuTask> => {
      calls.completeTask.push(id);
      return { id: 2, uid: id, status: 'done' };
    },
    searchTasks: async (params: SearchTasksParams): Promise<TududuTask[]> => {
      calls.searchTasks.push(params);
      return [{ id: 1, uid: 'task-uid-1', name: 'Matched task' }];
    },
    getTaskMetrics: async (type?: string): Promise<TududuTaskMetrics> => {
      calls.getTaskMetrics.push(type);
      return { total: 10, today: 2 };
    },
    listSubtasks: async (taskId: string): Promise<TududuTask[]> => {
      calls.listSubtasks.push(taskId);
      return [{ id: 3, uid: 'sub-uid-1', name: 'Subtask' }];
    },
    createSubtask: async (taskId: string, input: CreateSubtaskInput): Promise<TududuTask> => {
      calls.createSubtask.push({ taskId, data: input });
      return { id: 4, uid: 'sub-uid-2', name: input.title };
    },
    listComments: async (taskId: string): Promise<TududuComment[]> => {
      calls.listComments.push(taskId);
      return [{ uid: 'comment-uid-1', body: 'Looks good' }];
    },
    createComment: async (taskId: string, input: CreateCommentInput): Promise<TududuComment> => {
      calls.createComment.push({ taskId, data: input });
      return { uid: 'comment-uid-2', body: input.content };
    },
    deleteComment: async (commentId: string): Promise<TududuComment> => {
      calls.deleteComment.push(commentId);
      return { uid: commentId, body: '' };
    },
    listProjects: async (): Promise<TududuProject[]> => {
      calls.listProjects += 1;
      return [{ id: 10, uid: 'proj-uid-1', name: 'Sample project' }];
    },
    getProject: async (id: string): Promise<TududuProject> => {
      calls.getProject.push(id);
      return { id: 10, uid: id, name: 'Sample project' };
    },
    createProject: async (input: CreateProjectInput): Promise<TududuProject> => {
      calls.createProject.push(input);
      return { id: 11, uid: 'proj-uid-2', name: input.name };
    },
    updateProject: async (id: string, input: UpdateProjectInput): Promise<TududuProject> => {
      calls.updateProject.push({ id, data: input });
      return { id: 10, uid: id, name: input.name || 'Updated project' };
    },
    completeProject: async (
      id: string,
      completeOpenTasks = false
    ): Promise<Record<string, unknown>> => {
      calls.completeProject.push({ id, completeOpenTasks });
      return { project: { uid: id, status: 'done' }, completed_tasks: 2 };
    },
    deleteProject: async (id: string): Promise<void> => {
      calls.deleteProject.push(id);
    },
    listAreas: async (): Promise<TududuArea[]> => {
      calls.listAreas += 1;
      return [{ id: 20, uid: 'area-uid-1', name: 'Work' }];
    },
    getArea: async (id: string): Promise<TududuArea> => {
      calls.getArea.push(id);
      return { id: 20, uid: id, name: 'Work' };
    },
    createArea: async (input: CreateAreaInput): Promise<TududuArea> => {
      calls.createArea.push(input);
      return { id: 21, uid: 'area-uid-2', name: input.name };
    },
    updateArea: async (id: string, input: UpdateAreaInput): Promise<TududuArea> => {
      calls.updateArea.push({ id, data: input });
      return { id: 20, uid: id, name: input.name || 'Updated area' };
    },
    deleteArea: async (id: string): Promise<void> => {
      calls.deleteArea.push(id);
    },
    listTags: async (): Promise<TududuTag[]> => {
      calls.listTags += 1;
      return [{ uid: 'tag-uid-1', name: 'focus' }];
    },
    createTag: async (input: CreateTagInput): Promise<TududuTag> => {
      calls.createTag.push(input);
      return { uid: 'tag-uid-2', name: input.name };
    },
    updateTag: async (identifier: string, input: UpdateTagInput): Promise<TududuTag> => {
      calls.updateTag.push({ identifier, data: input });
      return { uid: 'tag-uid-1', name: input.name || identifier };
    },
    deleteTag: async (identifier: string): Promise<void> => {
      calls.deleteTag.push(identifier);
    },
    listNotes: async (): Promise<TududuNote[]> => {
      calls.listNotes += 1;
      return [{ uid: 'note-uid-1', title: 'Architecture Note' }];
    },
    getNote: async (id: string): Promise<TududuNote> => {
      calls.getNote.push(id);
      return { uid: id, title: 'Architecture Note', content: 'Details' };
    },
    createNote: async (input: CreateNoteInput): Promise<TududuNote> => {
      calls.createNote.push(input);
      return { uid: 'note-uid-2', title: input.title };
    },
    updateNote: async (id: string, input: UpdateNoteInput): Promise<TududuNote> => {
      calls.updateNote.push({ id, data: input });
      return { uid: id, title: input.title || 'Updated Note' };
    },
    deleteNote: async (id: string): Promise<void> => {
      calls.deleteNote.push(id);
    },
    listInboxItems: async (): Promise<TududuInboxItem[]> => {
      calls.listInboxItems += 1;
      return [{ uid: 'inbox-uid-1', content: 'Review roadmap' }];
    },
    getInboxItem: async (id: string): Promise<TududuInboxItem> => {
      calls.getInboxItem.push(id);
      return { uid: id, content: 'Review roadmap' };
    },
    createInboxItem: async (input: CreateInboxItemInput): Promise<TududuInboxItem> => {
      calls.createInboxItem.push(input);
      return { uid: 'inbox-uid-2', content: input.content };
    },
    updateInboxItem: async (id: string, input: UpdateInboxItemInput): Promise<TududuInboxItem> => {
      calls.updateInboxItem.push({ id, data: input });
      return { uid: id, content: input.content || 'Updated' };
    },
    processInboxItem: async (
      id: string,
      input?: ProcessInboxItemInput
    ): Promise<TududuInboxItem> => {
      calls.processInboxItem.push({ id, data: input });
      return { uid: id, content: 'Processed', status: 'processed' };
    },
    deleteInboxItem: async (id: string): Promise<void> => {
      calls.deleteInboxItem.push(id);
    },
    listGoals: async (): Promise<TududuGoal[]> => {
      calls.listGoals += 1;
      return [{ uid: 'goal-uid-1', title: 'Ship v0.3.0' }];
    },
    getGoal: async (id: string): Promise<TududuGoal> => {
      calls.getGoal.push(id);
      return { uid: id, title: 'Ship v0.3.0' };
    },
    createGoal: async (input: CreateGoalInput): Promise<TududuGoal> => {
      calls.createGoal.push(input);
      return { uid: 'goal-uid-2', title: input.title };
    },
    updateGoal: async (id: string, input: UpdateGoalInput): Promise<TududuGoal> => {
      calls.updateGoal.push({ id, data: input });
      return { uid: id, title: input.title || 'Updated Goal' };
    },
    deleteGoal: async (id: string): Promise<void> => {
      calls.deleteGoal.push(id);
    },
    listHabits: async (): Promise<TududuHabit[]> => {
      calls.listHabits += 1;
      return [{ uid: 'habit-uid-1', name: 'Read 20m' }];
    },
    getHabit: async (id: string): Promise<TududuHabit> => {
      calls.getHabit.push(id);
      return { uid: id, name: 'Read 20m' };
    },
    createHabit: async (input: CreateHabitInput): Promise<TududuHabit> => {
      calls.createHabit.push(input);
      return { uid: 'habit-uid-2', name: input.name };
    },
    updateHabit: async (id: string, input: UpdateHabitInput): Promise<TududuHabit> => {
      calls.updateHabit.push({ id, data: input });
      return { uid: id, name: input.name || 'Updated Habit' };
    },
    logHabitCompletion: async (
      id: string,
      input?: LogHabitCompletionInput
    ): Promise<Record<string, unknown>> => {
      calls.logHabitCompletion.push({ id, data: input });
      return { completion: { id: 1 }, task: { uid: id } };
    },
    skipHabitDay: async (
      id: string,
      input?: SkipHabitDayInput
    ): Promise<Record<string, unknown>> => {
      calls.skipHabitDay.push({ id, data: input });
      return { completion: { id: 2 }, task: { uid: id } };
    },
    getHabitStats: async (
      id: string,
      params?: HabitStatsParams
    ): Promise<Record<string, unknown>> => {
      calls.getHabitStats.push({ id, params });
      return { streak: 5 };
    },
    deleteHabit: async (id: string): Promise<void> => {
      calls.deleteHabit.push(id);
    },
  };

  return {
    client: fakeClient as unknown as TududuClient,
    calls,
  };
}

const MCP_ACCEPT = 'application/json, text/event-stream';

async function initializeMcpSession(
  app: ReturnType<typeof createExpressApp>,
  authToken?: string
): Promise<string> {
  const req = request(app)
    .post('/mcp')
    .set('Accept', MCP_ACCEPT)
    .set('Content-Type', 'application/json');
  if (authToken) {
    req.set('Authorization', `Bearer ${authToken}`);
  }

  const initRes = await req.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'jest-client', version: '1.0.0' },
    },
  });

  expect(initRes.status).toBe(200);
  const sessionId = initRes.headers['mcp-session-id'];
  expect(typeof sessionId).toBe('string');

  const notifyReq = request(app)
    .post('/mcp')
    .set('Accept', MCP_ACCEPT)
    .set('Content-Type', 'application/json')
    .set('mcp-session-id', sessionId);
  if (authToken) {
    notifyReq.set('Authorization', `Bearer ${authToken}`);
  }

  const notifyRes = await notifyReq.send({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });
  expect(notifyRes.status).toBe(202);

  return sessionId;
}

describe('HTTP transport routes', () => {
  beforeAll(() => {
    process.env.LOG_LEVEL = 'silent';
  });

  describe('GET /health', () => {
    it('returns 200 without auth even when MCP_AUTH_TOKEN is configured', async () => {
      const { client } = createFakeClient();
      const appNoAuth = createExpressApp({ client });
      const res1 = await request(appNoAuth).get('/health');
      expect(res1.status).toBe(200);
      expect(res1.body).toEqual({ status: 'ok', transport: 'http' });

      const appWithAuth = createExpressApp({ client, mcpAuthToken: 'top-secret' });
      const res2 = await request(appWithAuth).get('/health');
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual({ status: 'ok', transport: 'http' });
    });
  });

  describe('Session validation', () => {
    it('rejects GET /mcp and DELETE /mcp without a valid session ID', async () => {
      const { client } = createFakeClient();
      const app = createExpressApp({ client });

      const getMissing = await request(app).get('/mcp');
      expect(getMissing.status).toBe(400);
      expect(getMissing.body.error).toBe('Invalid or missing session ID');

      const getUnknown = await request(app).get('/mcp').set('mcp-session-id', 'nonexistent');
      expect(getUnknown.status).toBe(400);

      const deleteMissing = await request(app).delete('/mcp');
      expect(deleteMissing.status).toBe(400);
      expect(deleteMissing.body.error).toBe('Invalid or missing session ID');

      const deleteUnknown = await request(app).delete('/mcp').set('mcp-session-id', 'nonexistent');
      expect(deleteUnknown.status).toBe(400);
    });

    it('rejects POST /mcp with unknown session ID or non-initialize body without session ID', async () => {
      const { client } = createFakeClient();
      const app = createExpressApp({ client });

      const unknownSession = await request(app)
        .post('/mcp')
        .set('Accept', MCP_ACCEPT)
        .set('mcp-session-id', 'unknown-id')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      expect(unknownSession.status).toBe(400);
      expect(unknownSession.body.error).toBe('Invalid or missing session ID');

      const nonInitWithoutSession = await request(app)
        .post('/mcp')
        .set('Accept', MCP_ACCEPT)
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      expect(nonInitWithoutSession.status).toBe(400);
      expect(nonInitWithoutSession.body.error).toBe('Invalid or missing session ID');
    });
  });

  describe('MCP Streamable HTTP lifecycle & tools', () => {
    it('lists all 52 tools with enriched Tududi 1.1+ schemas across all 9 domains', async () => {
      const { client } = createFakeClient();
      const app = createExpressApp({ client });
      const sessionId = await initializeMcpSession(app);

      const listRes = await request(app)
        .post('/mcp')
        .set('Accept', MCP_ACCEPT)
        .set('mcp-session-id', sessionId)
        .send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

      expect(listRes.status).toBe(200);
      const payload = parseMcpResponse(listRes);
      const tools = payload.result?.tools as Array<{
        name: string;
        inputSchema: { properties: Record<string, unknown> };
      }>;
      expect(tools).toHaveLength(52);

      const byName = new Map(tools.map((t) => [t.name, t]));
      expect(Object.keys(byName.get('tududi_list_tasks')!.inputSchema.properties)).toEqual(
        expect.arrayContaining(['type', 'status', 'priority', 'projectId', 'areaId', 'tags'])
      );
      expect(Object.keys(byName.get('tududi_create_task')!.inputSchema.properties)).toEqual(
        expect.arrayContaining([
          'title',
          'description',
          'projectId',
          'areaId',
          'goalId',
          'dueDate',
          'dueTime',
          'deferUntil',
          'startDate',
          'estimatedMinutes',
          'priority',
          'today',
          'recurrenceType',
          'tags',
          'subtasks',
        ])
      );
      expect(Object.keys(byName.get('tududi_update_task')!.inputSchema.properties)).toEqual(
        expect.arrayContaining([
          'id',
          'title',
          'description',
          'completed',
          'status',
          'priority',
          'projectId',
          'areaId',
          'dueDate',
          'tags',
        ])
      );
      expect(Object.keys(byName.get('tududi_create_project')!.inputSchema.properties)).toEqual(
        expect.arrayContaining(['name', 'description', 'areaId', 'goalId', 'color', 'status'])
      );
      expect(Object.keys(byName.get('tududi_search_tasks')!.inputSchema.properties)).toEqual(
        expect.arrayContaining(['query', 'projectId', 'areaId', 'completed', 'priority', 'tags'])
      );
      expect(byName.has('tududi_create_comment')).toBe(true);
      expect(byName.has('tududi_update_tag')).toBe(true);
      expect(byName.has('tududi_create_note')).toBe(true);
      expect(byName.has('tududi_process_inbox_item')).toBe(true);
      expect(byName.has('tududi_create_goal')).toBe(true);
      expect(byName.has('tududi_log_habit_completion')).toBe(true);
    });

    it('dispatches core and expanded domain tools and handles unknown tools with isError: true', async () => {
      const { client, calls } = createFakeClient();
      const app = createExpressApp({ client });
      const sessionId = await initializeMcpSession(app);

      const callTool = async (
        id: number,
        name: string,
        args: Record<string, unknown>
      ): Promise<JsonRpcResponse> => {
        const res = await request(app)
          .post('/mcp')
          .set('Accept', MCP_ACCEPT)
          .set('mcp-session-id', sessionId)
          .send({
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: { name, arguments: args },
          });
        expect(res.status).toBe(200);
        return parseMcpResponse(res);
      };

      const listTasksRes = await callTool(10, 'tududi_list_tasks', {});
      expect(listTasksRes.result?.isError).toBeUndefined();
      expect(calls.listTasks).toEqual([undefined]);

      await callTool(101, 'tududi_list_tasks', { type: 'today', status: 'active' });
      expect(calls.listTasks[1]).toEqual({ type: 'today', status: 'active' });

      await callTool(11, 'tududi_create_task', { title: 'New task', areaId: '5', tags: ['a'] });
      expect(calls.createTask).toEqual([{ title: 'New task', areaId: '5', tags: ['a'] }]);

      await callTool(12, 'tududi_update_task', {
        id: 'task-uid-2',
        title: 'Renamed',
        areaId: '6',
        tags: ['b'],
      });
      expect(calls.updateTask).toEqual([
        { id: 'task-uid-2', data: { title: 'Renamed', areaId: '6', tags: ['b'] } },
      ]);

      await callTool(13, 'tududi_complete_task', { id: 'task-uid-2' });
      expect(calls.completeTask).toEqual(['task-uid-2']);

      await callTool(14, 'tududi_delete_task', { id: 'task-uid-2' });
      expect(calls.deleteTask).toEqual(['task-uid-2']);

      await callTool(15, 'tududi_list_projects', {});
      expect(calls.listProjects).toBe(1);

      await callTool(16, 'tududi_create_project', { name: 'Proj', color: '#fff' });
      expect(calls.createProject).toEqual([{ name: 'Proj', color: '#fff' }]);

      await callTool(17, 'tududi_list_areas', {});
      expect(calls.listAreas).toBe(1);

      await callTool(18, 'tududi_search_tasks', { query: 'hello', completed: false });
      expect(calls.searchTasks).toEqual([{ query: 'hello', completed: false }]);

      await callTool(21, 'tududi_get_task_metrics', { type: 'today' });
      expect(calls.getTaskMetrics).toEqual(['today']);

      await callTool(22, 'tududi_create_subtask', { taskId: 'task-uid-1', title: 'Sub 1' });
      expect(calls.createSubtask).toEqual([{ taskId: 'task-uid-1', data: { title: 'Sub 1' } }]);

      await callTool(23, 'tududi_create_comment', { taskId: 'task-uid-1', content: 'Note' });
      expect(calls.createComment).toEqual([{ taskId: 'task-uid-1', data: { content: 'Note' } }]);

      await callTool(24, 'tududi_complete_project', {
        id: 'proj-uid-1',
        completeOpenTasks: true,
      });
      expect(calls.completeProject).toEqual([{ id: 'proj-uid-1', completeOpenTasks: true }]);

      await callTool(25, 'tududi_update_area', { id: 'area-uid-1', name: 'Personal' });
      expect(calls.updateArea).toEqual([{ id: 'area-uid-1', data: { name: 'Personal' } }]);

      await callTool(26, 'tududi_create_tag', { name: 'deep' });
      expect(calls.createTag).toEqual([{ name: 'deep' }]);

      await callTool(27, 'tududi_create_note', { title: 'ADR', content: 'Markdown' });
      expect(calls.createNote).toEqual([{ title: 'ADR', content: 'Markdown' }]);

      await callTool(28, 'tududi_process_inbox_item', {
        id: 'inbox-uid-1',
        taskUid: 'task-uid-1',
      });
      expect(calls.processInboxItem).toEqual([
        { id: 'inbox-uid-1', data: { taskUid: 'task-uid-1' } },
      ]);

      await callTool(29, 'tududi_create_goal', { title: 'Ship v0.3', horizon: 'quarter' });
      expect(calls.createGoal).toEqual([{ title: 'Ship v0.3', horizon: 'quarter' }]);

      await callTool(30, 'tududi_log_habit_completion', { id: 'habit-uid-1', value: 2 });
      expect(calls.logHabitCompletion).toEqual([{ id: 'habit-uid-1', data: { value: 2 } }]);

      const unknownToolRes = await callTool(19, 'tududi_nonexistent', {});
      expect(unknownToolRes.result?.isError).toBe(true);
    });

    it('lists and reads MCP static resources and URI templates', async () => {
      const { client, calls } = createFakeClient();
      const app = createExpressApp({ client });
      const sessionId = await initializeMcpSession(app);

      const postMcp = async (
        id: number,
        method: string,
        params?: unknown
      ): Promise<JsonRpcResponse> => {
        const res = await request(app)
          .post('/mcp')
          .set('Accept', MCP_ACCEPT)
          .set('mcp-session-id', sessionId)
          .send({ jsonrpc: '2.0', id, method, params });
        expect(res.status).toBe(200);
        return parseMcpResponse(res);
      };

      const resourcesRes = await postMcp(40, 'resources/list');
      const resources = resourcesRes.result?.resources as Array<{ uri: string }>;
      expect(resources).toHaveLength(11);
      expect(resources.map((r) => r.uri)).toContain('tududi://tasks/today');

      const templatesRes = await postMcp(41, 'resources/templates/list');
      const templates = templatesRes.result?.resourceTemplates as Array<{ uriTemplate: string }>;
      expect(templates).toHaveLength(5);
      expect(templates.map((t) => t.uriTemplate)).toContain('tududi://note/{uid}');

      const readToday = await postMcp(42, 'resources/read', { uri: 'tududi://tasks/today' });
      expect(calls.listTasks).toContainEqual({ type: 'today' });
      const todayContents = readToday.result?.contents as Array<{ text: string }>;
      expect(JSON.parse(todayContents[0].text)).toEqual([
        { id: 1, uid: 'task-uid-1', name: 'Sample task' },
      ]);

      const readNote = await postMcp(43, 'resources/read', { uri: 'tududi://note/note-uid-1' });
      expect(calls.getNote).toEqual(['note-uid-1']);
      const noteContents = readNote.result?.contents as Array<{ text: string }>;
      expect(JSON.parse(noteContents[0].text)).toMatchObject({ uid: 'note-uid-1' });

      const invalidUri = await postMcp(44, 'resources/read', { uri: 'tududi://unknown/1' });
      expect(invalidUri.error?.code).toBe(-32602);
    });

    it('lists and renders MCP workflow prompts with argument validation', async () => {
      const { client } = createFakeClient();
      const app = createExpressApp({ client });
      const sessionId = await initializeMcpSession(app);

      const postMcp = async (
        id: number,
        method: string,
        params?: unknown
      ): Promise<JsonRpcResponse> => {
        const res = await request(app)
          .post('/mcp')
          .set('Accept', MCP_ACCEPT)
          .set('mcp-session-id', sessionId)
          .send({ jsonrpc: '2.0', id, method, params });
        expect(res.status).toBe(200);
        return parseMcpResponse(res);
      };

      const promptsRes = await postMcp(50, 'prompts/list');
      const prompts = promptsRes.result?.prompts as Array<{ name: string }>;
      expect(prompts).toHaveLength(4);
      expect(prompts.map((p) => p.name)).toEqual([
        'tududi_daily_plan',
        'tududi_weekly_review',
        'tududi_inbox_triage',
        'tududi_project_breakdown',
      ]);

      const dailyPrompt = await postMcp(51, 'prompts/get', {
        name: 'tududi_daily_plan',
        arguments: { focusArea: 'Engineering' },
      });
      const dailyMessages = dailyPrompt.result?.messages as Array<{ content: { text: string } }>;
      expect(dailyMessages[0].content.text).toContain('Engineering');

      const breakdownPrompt = await postMcp(52, 'prompts/get', {
        name: 'tududi_project_breakdown',
        arguments: { projectName: 'Launch v0.3.0', targetDate: '2026-12-01' },
      });
      const breakdownMessages = breakdownPrompt.result?.messages as Array<{
        content: { text: string };
      }>;
      expect(breakdownMessages[0].content.text).toContain('Launch v0.3.0');

      const missingRequired = await postMcp(53, 'prompts/get', {
        name: 'tududi_project_breakdown',
        arguments: {},
      });
      expect(missingRequired.error?.code).toBe(-32602);

      const unknownPrompt = await postMcp(54, 'prompts/get', {
        name: 'tududi_unknown_prompt',
      });
      expect(unknownPrompt.error?.code).toBe(-32602);
    });

    it('returns isError: true when upstream TududuClient throws', async () => {
      const { client } = createFakeClient({ throwOnListTasks: true });
      const app = createExpressApp({ client });
      const sessionId = await initializeMcpSession(app);

      const res = await request(app)
        .post('/mcp')
        .set('Accept', MCP_ACCEPT)
        .set('mcp-session-id', sessionId)
        .send({
          jsonrpc: '2.0',
          id: 20,
          method: 'tools/call',
          params: { name: 'tududi_list_tasks', arguments: {} },
        });

      expect(res.status).toBe(200);
      const payload = parseMcpResponse(res);
      expect(payload.result?.isError).toBe(true);
      const content = payload.result?.content as Array<{ text: string }>;
      expect(content[0].text).toContain('Upstream Tududi unavailable');
    });

    it('serves SSE stream on GET /mcp and closes session on DELETE /mcp', async () => {
      const { client } = createFakeClient();
      const app = createExpressApp({ client });
      const httpServer = app.listen(0);

      try {
        const { port } = httpServer.address() as AddressInfo;
        const baseUrl = `http://127.0.0.1:${port}`;

        const initResp = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            Accept: MCP_ACCEPT,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-03-26',
              capabilities: {},
              clientInfo: { name: 'sse-test', version: '1.0.0' },
            },
          }),
        });
        expect(initResp.status).toBe(200);
        const sessionId = initResp.headers.get('mcp-session-id');
        expect(sessionId).toBeTruthy();
        await initResp.body?.cancel();

        const abortController = new AbortController();
        const sseResp = await fetch(`${baseUrl}/mcp`, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            'mcp-session-id': sessionId!,
          },
          signal: abortController.signal,
        });
        expect(sseResp.status).toBe(200);
        expect(sseResp.headers.get('content-type')).toContain('text/event-stream');
        abortController.abort();

        const delResp = await fetch(`${baseUrl}/mcp`, {
          method: 'DELETE',
          headers: {
            'mcp-session-id': sessionId!,
          },
        });
        expect(delResp.status).toBe(200);

        const afterDelete = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            Accept: MCP_ACCEPT,
            'Content-Type': 'application/json',
            'mcp-session-id': sessionId!,
          },
          body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
        });
        expect(afterDelete.status).toBe(400);
      } finally {
        httpServer.closeAllConnections?.();
        await new Promise<void>((resolveClose) => {
          httpServer.close(() => resolveClose());
        });
      }
    });
  });

  describe('MCP_AUTH_TOKEN enforcement', () => {
    it('requires matching Bearer token on /mcp when mcpAuthToken is set', async () => {
      const { client } = createFakeClient();
      const expectedToken = 'super-secret-token';
      const app = createExpressApp({ client, mcpAuthToken: expectedToken });

      const missingHeader = await request(app).post('/mcp').set('Accept', MCP_ACCEPT).send({});
      expect(missingHeader.status).toBe(401);
      expect(missingHeader.headers['www-authenticate']).toBe('Bearer');

      const differentLengthToken = await request(app)
        .post('/mcp')
        .set('Accept', MCP_ACCEPT)
        .set('Authorization', 'Bearer short')
        .send({});
      expect(differentLengthToken.status).toBe(401);

      const sameLengthWrongToken = await request(app)
        .post('/mcp')
        .set('Accept', MCP_ACCEPT)
        .set('Authorization', 'Bearer super-secret-tokem')
        .send({});
      expect(sameLengthWrongToken.status).toBe(401);

      const sessionId = await initializeMcpSession(app, expectedToken);
      const authorizedList = await request(app)
        .post('/mcp')
        .set('Accept', MCP_ACCEPT)
        .set('Authorization', `Bearer ${expectedToken}`)
        .set('mcp-session-id', sessionId)
        .send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

      expect(authorizedList.status).toBe(200);
    });
  });
});
