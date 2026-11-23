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
});
