import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { TududuClient } from '../tududi-client.js';

interface RecordedRequest {
  method: string;
  url: string;
  fullUrl: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers: Record<string, unknown>;
}

function attachMockAdapter(
  client: TududuClient,
  responder: (
    req: RecordedRequest,
    config: InternalAxiosRequestConfig
  ) => { status?: number; data?: unknown; headers?: Record<string, string | string[]> }
): RecordedRequest[] {
  const recorded: RecordedRequest[] = [];
  const axiosInstance = (client as unknown as { client: AxiosInstance }).client;

  axiosInstance.defaults.adapter = async (
    config: InternalAxiosRequestConfig
  ): Promise<AxiosResponse> => {
    const parsedData =
      typeof config.data === 'string' && config.data.length > 0
        ? (JSON.parse(config.data) as unknown)
        : config.data;
    const rawHeaders =
      config.headers instanceof AxiosHeaders
        ? (config.headers.toJSON() as Record<string, unknown>)
        : ({ ...(config.headers as Record<string, unknown>) } as Record<string, unknown>);

    const req: RecordedRequest = {
      method: (config.method || 'get').toUpperCase(),
      url: config.url || '',
      fullUrl: axios.getUri(config),
      params: config.params as Record<string, unknown> | undefined,
      data: parsedData,
      headers: rawHeaders,
    };
    recorded.push(req);

    const mockRes = responder(req, config);
    const status = mockRes.status ?? 200;
    if (status >= 400) {
      throw new Error(`Request failed with status code ${status}`);
    }
    return {
      data: mockRes.data,
      status,
      statusText: 'OK',
      headers: mockRes.headers ?? {},
      config,
    };
  };

  return recorded;
}

describe('TududuClient', () => {
  beforeAll(() => {
    process.env.LOG_LEVEL = 'silent';
  });

  it('normalizes base URL and uses Bearer token auth', async () => {
    const client = new TududuClient('http://localhost:3000/api/v1/', 'test-api-key');
    const requests = attachMockAdapter(client, () => ({ data: { tasks: [] } }));

    await client.listTasks();

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('/api/v1/tasks');
    expect(requests[0].fullUrl).toBe('http://localhost:3000/api/v1/tasks');
    expect(requests[0].headers['Authorization']).toBe('Bearer test-api-key');
  });

  it('unwraps both { tasks } envelopes and bare arrays in listTasks', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    let call = 0;
    attachMockAdapter(client, () => {
      call += 1;
      if (call === 1) {
        return { data: { tasks: [{ id: 1, uid: 'task-uid-1', name: 'Wrapped' }] } };
      }
      return { data: [{ id: 2, uid: 'task-uid-2', name: 'Array' }] };
    });

    const first = await client.listTasks();
    const second = await client.listTasks();

    expect(first).toEqual([{ id: 1, uid: 'task-uid-1', name: 'Wrapped' }]);
    expect(second).toEqual([{ id: 2, uid: 'task-uid-2', name: 'Array' }]);
  });

  it('fetches, creates, updates, completes, and deletes tasks on singular /api/v1/task routes', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    const requests = attachMockAdapter(client, (req) => {
      if (req.method === 'DELETE') {
        return { status: 204, data: null };
      }
      return { data: { id: 42, uid: 'abc123', name: 'Task' } };
    });

    await client.getTask('abc/123');
    await client.createTask({
      title: 'Write tests',
      description: 'Cover all routes',
      projectId: '12',
      areaId: '7',
      dueDate: '2026-12-01',
      priority: 'high',
      tags: ['dev', 'mcp'],
    });
    await client.updateTask('abc123', {
      title: 'Updated',
      description: 'Updated note',
      completed: false,
      projectId: '15',
      areaId: '9',
      dueDate: '2026-12-05',
      priority: 'low',
      tags: ['urgent'],
    });
    await client.completeTask('abc123');
    await client.deleteTask('abc123');

    expect(requests[0].url).toBe('/api/v1/task/abc%2F123');

    expect(requests[1].method).toBe('POST');
    expect(requests[1].url).toBe('/api/v1/task');
    expect(requests[1].data).toEqual({
      name: 'Write tests',
      note: 'Cover all routes',
      project_id: '12',
      area_id: '7',
      due_date: '2026-12-01',
      priority: 2,
      tags: ['dev', 'mcp'],
    });

    expect(requests[2].method).toBe('PATCH');
    expect(requests[2].url).toBe('/api/v1/task/abc123');
    expect(requests[2].data).toEqual({
      name: 'Updated',
      note: 'Updated note',
      status: 'not_started',
      project_id: '15',
      area_id: '9',
      due_date: '2026-12-05',
      priority: 0,
      tags: ['urgent'],
    });

    expect(requests[3].method).toBe('PATCH');
    expect(requests[3].url).toBe('/api/v1/task/abc123');
    expect(requests[3].data).toEqual({ status: 'done' });

    expect(requests[4].method).toBe('DELETE');
    expect(requests[4].url).toBe('/api/v1/task/abc123');
  });

  it('uses GET /api/v1/search when query is provided and handles UID vs numeric scope filters', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    const requests = attachMockAdapter(client, () => ({
      data: {
        results: [
          { id: 1, uid: 't1', name: 'Match', project_id: 5, area_id: 2 },
          { id: 2, uid: 't2', name: 'Wrong project', project_id: 9, area_id: 2 },
          { id: 3, uid: 't3', name: 'Wrong area', project_id: 5, area_id: 8 },
        ],
      },
    }));

    const uidResults = await client.searchTasks({
      query: '  deploy ',
      projectId: 'proj-uid-1',
      areaId: 'area-uid-1',
      completed: true,
      priority: 'high',
      tags: ['ops', 'prod'],
    });

    expect(uidResults).toHaveLength(3);
    expect(requests[0].url).toBe('/api/v1/search');
    expect(requests[0].params).toEqual({
      q: 'deploy',
      filters: 'Task',
      status: 'completed',
      priority: 'high',
      tags: 'ops,prod',
      project_uid: 'proj-uid-1',
      area_uid: 'area-uid-1',
    });

    const numericResults = await client.searchTasks({
      query: 'deploy',
      projectId: '5',
      areaId: '2',
      completed: false,
    });

    expect(requests[1].url).toBe('/api/v1/search');
    expect(requests[1].params).toEqual({
      q: 'deploy',
      filters: 'Task',
      status: 'active',
    });
    expect(numericResults).toEqual([
      { id: 1, uid: 't1', name: 'Match', project_id: 5, area_id: 2 },
    ]);
  });

  it('uses GET /api/v1/tasks when query is omitted or blank', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    const requests = attachMockAdapter(client, () => ({
      data: { tasks: [{ id: 10, uid: 't10', name: 'Filtered' }] },
    }));

    const numericFiltered = await client.searchTasks({
      query: '   ',
      projectId: '4',
      areaId: '7',
      completed: true,
      priority: 'low',
      tags: ['alpha', 'beta'],
    });

    expect(numericFiltered).toEqual([{ id: 10, uid: 't10', name: 'Filtered' }]);
    expect(requests[0].url).toBe('/api/v1/tasks');
    expect(requests[0].params).toEqual({
      project_id: '4',
      area_id: '7',
      status: 'done',
      priority: 'low',
      tags: 'alpha,beta',
    });

    await client.searchTasks({
      projectId: 'proj-uid-2',
      areaId: 'area-uid-2',
      completed: false,
    });

    expect(requests[1].url).toBe('/api/v1/tasks');
    expect(requests[1].params).toEqual({
      project_uid: 'proj-uid-2',
      area_uid: 'area-uid-2',
      status: 'active',
    });
  });

  it('handles project and area endpoints under /api/v1', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    const requests = attachMockAdapter(client, (req) => {
      if (req.url === '/api/v1/projects') {
        return { data: { projects: [{ id: 1, uid: 'p1', name: 'Proj' }] } };
      }
      if (req.url === '/api/v1/areas') {
        return { data: [{ id: 2, uid: 'a1', name: 'Area' }] };
      }
      return { data: { id: 1, name: 'Created' } };
    });

    const projects = await client.listProjects();
    await client.getProject('p1');
    await client.createProject({
      name: 'Roadmap',
      description: 'Q4',
      areaId: 'a1',
      color: '#3b82f6',
    });
    const areas = await client.listAreas();
    await client.getArea('a1');
    await client.createArea({ name: 'Work', description: 'Office', color: '#10b981' });

    expect(projects).toEqual([{ id: 1, uid: 'p1', name: 'Proj' }]);
    expect(requests[1].url).toBe('/api/v1/project/p1');
    expect(requests[2].url).toBe('/api/v1/project');
    expect(requests[2].data).toEqual({
      name: 'Roadmap',
      description: 'Q4',
      area_id: 'a1',
      color: '#3b82f6',
    });

    expect(areas).toEqual([{ id: 2, uid: 'a1', name: 'Area' }]);
    expect(requests[4].url).toBe('/api/v1/areas/a1');
    expect(requests[5].url).toBe('/api/v1/areas');
  });

  it('performs lazy session login on first request and retries after failure', async () => {
    const client = new TududuClient(
      'http://localhost:3000',
      undefined,
      'user@example.com',
      'pw123'
    );

    let loginAttempts = 0;
    const requests = attachMockAdapter(client, (req) => {
      if (req.url === '/api/v1/login') {
        loginAttempts += 1;
        if (loginAttempts === 1) {
          return { status: 401, data: { error: 'Temporary failure' } };
        }
        return {
          status: 200,
          data: { ok: true },
          headers: { 'set-cookie': ['connect.sid=session123; Path=/; HttpOnly'] },
        };
      }
      if (req.url === '/api/v1/areas') {
        return { data: [] };
      }
      return { data: { tasks: [] } };
    });

    // Construction alone must not have triggered login yet
    expect(requests).toHaveLength(0);

    // First request fails during login
    await expect(client.listTasks()).rejects.toThrow('Failed to authenticate with Tududi');

    // Concurrent calls after failed login trigger a single fresh login and attach session cookie
    await Promise.all([client.listTasks(), client.listAreas()]);

    expect(loginAttempts).toBe(2);
    const nonLoginRequests = requests.filter((r) => r.url !== '/api/v1/login');
    expect(nonLoginRequests).toHaveLength(2);
    expect(nonLoginRequests[0].headers['Cookie']).toBe('connect.sid=session123');
    expect(nonLoginRequests[1].headers['Cookie']).toBe('connect.sid=session123');
  });

  it('supports GTD listTasks filters, metrics, rich task fields, and subtasks', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    const requests = attachMockAdapter(client, (req) => {
      if (req.url === '/api/v1/task/parent-uid-1') {
        return { data: { id: 77, uid: 'parent-uid-1', name: 'Parent' } };
      }
      if (req.url === '/api/v1/task/parent-uid-1/subtasks') {
        return { data: [{ id: 78, uid: 'sub-1', name: 'Subtask 1' }] };
      }
      if (req.url === '/api/v1/tasks/metrics') {
        return { data: { total: 5, completed: 2 } };
      }
      return { data: { tasks: [{ id: 1, uid: 't1', name: 'Today task' }] } };
    });

    const filtered = await client.listTasks({
      type: 'today',
      status: 'active',
      priority: 'high',
      projectId: 'proj-uid-9',
      areaId: '9',
      tags: ['focus', 'deep'],
      orderBy: 'due_date:asc',
      includeSubtasks: true,
      limit: 10,
      offset: 5,
    });
    expect(filtered).toHaveLength(1);
    expect(requests[0].url).toBe('/api/v1/tasks');
    expect(requests[0].params).toEqual({
      type: 'today',
      status: 'active',
      priority: 'high',
      project_uid: 'proj-uid-9',
      area_id: '9',
      tags: 'focus,deep',
      order_by: 'due_date:asc',
      include_subtasks: 'true',
      limit: 10,
      offset: 5,
    });

    const metrics = await client.getTaskMetrics('today');
    expect(metrics).toEqual({ total: 5, completed: 2 });
    expect(requests[1].url).toBe('/api/v1/tasks/metrics');
    expect(requests[1].params).toEqual({ type: 'today' });

    await client.createTask({
      title: 'Deep work',
      goalId: '3',
      dueDate: '2026-12-10',
      dueTime: '14:30',
      deferUntil: '2026-12-08',
      startDate: '2026-12-09',
      startTime: '09:00',
      estimatedMinutes: 90,
      status: 'planned',
      today: true,
      recurrenceType: 'weekly',
      recurrenceInterval: 1,
      recurrenceWeekdays: [1, 3, 5],
      completionBased: false,
      subtasks: [{ name: 'Step 1', priority: 'high' }],
    });
    expect(requests[2].url).toBe('/api/v1/task');
    expect(requests[2].data).toEqual({
      name: 'Deep work',
      goal_id: '3',
      due_date: '2026-12-10',
      due_time: '14:30',
      defer_until: '2026-12-08',
      start_date: '2026-12-09',
      start_time: '09:00',
      estimated_minutes: 90,
      status: 'planned',
      today: true,
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      recurrence_weekdays: [1, 3, 5],
      completion_based: false,
      subtasks: [{ name: 'Step 1', priority: 2 }],
    });

    const subtasks = await client.listSubtasks('parent-uid-1');
    expect(subtasks).toHaveLength(1);
    expect(requests[3].url).toBe('/api/v1/task/parent-uid-1/subtasks');

    await client.createSubtask('parent-uid-1', {
      title: 'Resolved subtask',
      priority: 'medium',
      status: 'in_progress',
    });
    expect(requests[4].url).toBe('/api/v1/task/parent-uid-1');
    expect(requests[5].url).toBe('/api/v1/task');
    expect(requests[5].data).toEqual({
      name: 'Resolved subtask',
      parent_task_id: 77,
      priority: 1,
      status: 'in_progress',
    });

    await client.createSubtask('88', { title: 'Numeric subtask' });
    expect(requests[6].url).toBe('/api/v1/task');
    expect(requests[6].data).toEqual({
      name: 'Numeric subtask',
      parent_task_id: 88,
    });
  });

  it('handles task comments, extended project operations, and area updates/deletes', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    const requests = attachMockAdapter(client, (req) => {
      if (req.url === '/api/v1/task/t1/comments') {
        return { data: { comments: [{ uid: 'c1', body: 'Hello' }] } };
      }
      if (req.url === '/api/v1/projects') {
        return { data: { projects: [{ id: 1, uid: 'p1', name: 'P1' }] } };
      }
      return { data: { ok: true } };
    });

    const comments = await client.listComments('t1');
    expect(comments).toEqual([{ uid: 'c1', body: 'Hello' }]);

    await client.createComment('t1', { content: 'Reply', parentCommentUid: 'c1' });
    expect(requests[1].method).toBe('POST');
    expect(requests[1].url).toBe('/api/v1/task/t1/comments');
    expect(requests[1].data).toEqual({ body: 'Reply', parent_comment_uid: 'c1' });

    await client.deleteComment('c1');
    expect(requests[2].method).toBe('DELETE');
    expect(requests[2].url).toBe('/api/v1/comment/c1');

    await client.listProjects({
      status: 'in_progress',
      active: true,
      areaId: 'area-uid-1',
      pinned: true,
      tags: ['q4'],
    });
    expect(requests[3].params).toEqual({
      status: 'in_progress',
      active: 'true',
      area_uid: 'area-uid-1',
      pin_to_sidebar: 'true',
      tags: 'q4',
    });

    await client.updateProject('p1', {
      name: 'Renamed Project',
      priority: 'high',
      dueDate: '2026-12-31',
      pinned: false,
      tags: ['launch'],
    });
    expect(requests[4].method).toBe('PATCH');
    expect(requests[4].url).toBe('/api/v1/project/p1');
    expect(requests[4].data).toEqual({
      name: 'Renamed Project',
      priority: 2,
      due_date_at: '2026-12-31',
      pin_to_sidebar: false,
      tags: [{ name: 'launch' }],
    });

    await client.completeProject('p1', true);
    expect(requests[5].method).toBe('POST');
    expect(requests[5].url).toBe('/api/v1/project/p1/complete');
    expect(requests[5].data).toEqual({ complete_open_tasks: true });

    await client.deleteProject('p1');
    expect(requests[6].method).toBe('DELETE');
    expect(requests[6].url).toBe('/api/v1/project/p1');

    await client.updateArea('a1', { name: 'Personal', color: '#22c55e' });
    expect(requests[7].method).toBe('PATCH');
    expect(requests[7].url).toBe('/api/v1/areas/a1');

    await client.deleteArea('a1');
    expect(requests[8].method).toBe('DELETE');
    expect(requests[8].url).toBe('/api/v1/areas/a1');
  });

  it('handles tags, notes, and inbox CRUD + processing endpoints', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    let inboxCall = 0;
    const requests = attachMockAdapter(client, (req) => {
      if (req.url === '/api/v1/tags') {
        return { data: [{ uid: 'tag1', name: 'work' }] };
      }
      if (req.url === '/api/v1/notes') {
        return { data: [{ uid: 'n1', title: 'Spec' }] };
      }
      if (req.url === '/api/v1/inbox') {
        inboxCall += 1;
        return inboxCall === 1
          ? { data: [{ uid: 'in1', content: 'Idea 1' }] }
          : { data: { items: [{ uid: 'in2', content: 'Idea 2' }], pagination: { total: 1 } } };
      }
      return { data: { uid: 'ok' } };
    });

    expect(await client.listTags({ areaUid: 'a1', projectUid: 'p1' })).toHaveLength(1);
    expect(requests[0].params).toEqual({ area_uid: 'a1', project_uid: 'p1' });

    await client.createTag({ name: 'deep work' });
    expect(requests[1].url).toBe('/api/v1/tag');

    await client.updateTag('deep work', { name: 'deep-work', pinned: true, color: '#000000' });
    expect(requests[2].url).toBe('/api/v1/tag/deep%20work');

    await client.deleteTag('deep-work');
    expect(requests[3].method).toBe('DELETE');
    expect(requests[3].url).toBe('/api/v1/tag/deep-work');

    expect(
      await client.listNotes({ orderBy: 'title:asc', tag: 'work', tags: ['work', 'mcp'] })
    ).toHaveLength(1);
    expect(requests[4].params).toEqual({
      order_by: 'title:asc',
      tag: 'work',
      tags: 'work,mcp',
    });

    await client.getNote('n1');
    expect(requests[5].url).toBe('/api/v1/note/n1');

    await client.createNote({ title: 'Note A', content: 'Body', projectId: '12', tags: ['docs'] });
    expect(requests[6].url).toBe('/api/v1/note');
    expect(requests[6].data).toEqual({
      title: 'Note A',
      content: 'Body',
      project_id: 12,
      tags: ['docs'],
    });

    await client.updateNote('n1', { projectId: 'proj-uid-1', pinned: true });
    expect(requests[7].url).toBe('/api/v1/note/n1');
    expect(requests[7].data).toEqual({
      project_uid: 'proj-uid-1',
      pin_to_sidebar: true,
    });

    await client.deleteNote('n1');
    expect(requests[8].method).toBe('DELETE');

    expect(await client.listInboxItems()).toHaveLength(1);
    expect(await client.listInboxItems({ limit: 5, offset: 0 })).toEqual([
      { uid: 'in2', content: 'Idea 2' },
    ]);
    await client.getInboxItem('in1');
    await client.createInboxItem({ content: 'Buy milk', source: 'mcp' });
    await client.updateInboxItem('in1', { content: 'Buy oat milk', status: 'added' });
    await client.processInboxItem('in1', { taskUid: 't99' });
    await client.deleteInboxItem('in1');

    expect(requests[12].url).toBe('/api/v1/inbox');
    expect(requests[14].url).toBe('/api/v1/inbox/in1/process');
    expect(requests[14].data).toEqual({ task_uid: 't99' });
    expect(requests[15].method).toBe('DELETE');
  });

  it('handles goals (resolving non-numeric area UIDs) and habits (PUT + archive/completion/stats)', async () => {
    const client = new TududuClient('http://localhost:3000', 'test-api-key');
    const requests = attachMockAdapter(client, (req) => {
      if (req.url === '/api/v1/areas/area-uid-9') {
        return { data: { id: 44, uid: 'area-uid-9', name: 'Health' } };
      }
      if (req.url === '/api/v1/goals') {
        return req.method === 'GET'
          ? { data: { goals: [{ uid: 'g1', title: 'Run 10k' }] } }
          : { data: { goal: { uid: 'g2', title: 'Created Goal' } } };
      }
      if (req.url === '/api/v1/goals/g1') {
        return { data: { goal: { uid: 'g1', title: 'Run 10k' } } };
      }
      if (req.url === '/api/v1/habits') {
        return req.method === 'GET'
          ? { data: { habits: [{ uid: 'h1', name: 'Read' }] } }
          : { data: { habit: { uid: 'h2', name: 'Hydrate' } } };
      }
      if (req.url.startsWith('/api/v1/habits/h1')) {
        if (req.url.endsWith('/stats')) {
          return { data: { streak: 7, rate: 0.85 } };
        }
        return { data: { habit: { uid: 'h1', name: 'Read', habit_archived: true } } };
      }
      return { data: { ok: true } };
    });

    expect(await client.listGoals({ areaId: 'area-uid-9' })).toEqual([
      { uid: 'g1', title: 'Run 10k' },
    ]);
    expect(requests[0].params).toEqual({ area_uid: 'area-uid-9' });

    expect(await client.getGoal('g1')).toEqual({ uid: 'g1', title: 'Run 10k' });

    const createdGoal = await client.createGoal({
      title: 'Run Marathon',
      areaId: 'area-uid-9',
      horizon: 'year',
      targetDate: '2027-05-01',
    });
    expect(createdGoal).toEqual({ uid: 'g2', title: 'Created Goal' });
    expect(requests[2].url).toBe('/api/v1/areas/area-uid-9');
    expect(requests[3].url).toBe('/api/v1/goals');
    expect(requests[3].data).toEqual({
      title: 'Run Marathon',
      area_id: 44,
      horizon: 'year',
      target_date: '2027-05-01',
    });

    await client.updateGoal('g1', { areaId: '12', status: 'completed' });
    expect(requests[4].method).toBe('PATCH');
    expect(requests[4].data).toEqual({ area_id: 12, status: 'completed' });

    await client.deleteGoal('g1');
    expect(requests[5].method).toBe('DELETE');

    expect(await client.listHabits({ archived: true })).toEqual([{ uid: 'h1', name: 'Read' }]);
    expect(requests[6].params).toEqual({ archived: 'true' });

    expect(await client.getHabit('h1')).toMatchObject({ uid: 'h1' });

    await client.createHabit({
      name: 'Hydrate',
      polarity: 'build',
      frequencyPeriod: 'daily',
      targetCount: 1,
      targetValue: 2000,
      unit: 'ml',
      timeOfDay: 'morning',
      reminderTime: '08:30',
      color: '#3b82f6',
    });
    expect(requests[8].method).toBe('POST');
    expect(requests[8].data).toEqual({
      name: 'Hydrate',
      habit_polarity: 'build',
      habit_frequency_period: 'daily',
      habit_target_count: 1,
      habit_target_value: 2000,
      habit_unit: 'ml',
      habit_time_of_day: 'morning',
      habit_reminder_time: '08:30',
      habit_color: '#3b82f6',
    });

    await client.updateHabit('h1', { name: 'Read 30m', archived: true });
    expect(requests[9].method).toBe('PUT');
    expect(requests[9].url).toBe('/api/v1/habits/h1');
    expect(requests[9].data).toEqual({ name: 'Read 30m' });
    expect(requests[10].method).toBe('POST');
    expect(requests[10].url).toBe('/api/v1/habits/h1/archive');

    await client.logHabitCompletion('h1', { value: 30, note: 'Evening reading' });
    expect(requests[11].url).toBe('/api/v1/habits/h1/complete');
    expect(requests[11].data).toEqual({ value: 30, note: 'Evening reading' });

    await client.skipHabitDay('h1', { date: '2026-11-23', note: 'Travel' });
    expect(requests[12].url).toBe('/api/v1/habits/h1/skip');
    expect(requests[12].data).toEqual({ date: '2026-11-23', note: 'Travel' });

    const stats = await client.getHabitStats('h1', {
      startDate: '2026-11-01',
      endDate: '2026-11-23',
    });
    expect(stats).toEqual({ streak: 7, rate: 0.85 });
    expect(requests[13].params).toEqual({
      start_date: '2026-11-01',
      end_date: '2026-11-23',
    });

    await client.deleteHabit('h1');
    expect(requests[14].method).toBe('DELETE');
  });
});
