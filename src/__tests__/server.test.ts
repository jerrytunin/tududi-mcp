import { AddressInfo } from 'net';
import request from 'supertest';
import { createExpressApp } from '../server.js';
import { TududuClient } from '../tududi-client.js';
import {
  CreateProjectInput,
  CreateTaskInput,
  SearchTasksParams,
  TududuArea,
  TududuProject,
  TududuTask,
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
    listTasks: number;
    createTask: CreateTaskInput[];
    updateTask: Array<{ id: string; data: UpdateTaskInput }>;
    deleteTask: string[];
    completeTask: string[];
    listProjects: number;
    createProject: CreateProjectInput[];
    listAreas: number;
    searchTasks: SearchTasksParams[];
  };
}

function createFakeClient(options?: { throwOnListTasks?: boolean }): MockClientResult {
  const calls: MockClientResult['calls'] = {
    listTasks: 0,
    createTask: [],
    updateTask: [],
    deleteTask: [],
    completeTask: [],
    listProjects: 0,
    createProject: [],
    listAreas: 0,
    searchTasks: [],
  };

  const fakeClient: Partial<TududuClient> = {
    listTasks: async (): Promise<TududuTask[]> => {
      calls.listTasks += 1;
      if (options?.throwOnListTasks) {
        throw new Error('Upstream Tududi unavailable');
      }
      return [{ id: 1, uid: 'task-uid-1', name: 'Sample task' }];
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
    listProjects: async (): Promise<TududuProject[]> => {
      calls.listProjects += 1;
      return [{ id: 10, uid: 'proj-uid-1', name: 'Sample project' }];
    },
    createProject: async (input: CreateProjectInput): Promise<TududuProject> => {
      calls.createProject.push(input);
      return { id: 11, uid: 'proj-uid-2', name: input.name };
    },
    listAreas: async (): Promise<TududuArea[]> => {
      calls.listAreas += 1;
      return [{ id: 20, uid: 'area-uid-1', name: 'Work' }];
    },
    searchTasks: async (params: SearchTasksParams): Promise<TududuTask[]> => {
      calls.searchTasks.push(params);
      return [{ id: 1, uid: 'task-uid-1', name: 'Matched task' }];
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
    it('lists all 9 tools with enriched Tududi 1.1+ schemas', async () => {
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
      expect(tools).toHaveLength(9);

      const byName = new Map(tools.map((t) => [t.name, t]));
      expect(Object.keys(byName.get('tududi_create_task')!.inputSchema.properties)).toEqual(
        expect.arrayContaining([
          'title',
          'description',
          'projectId',
          'areaId',
          'dueDate',
          'priority',
          'tags',
        ])
      );
      expect(Object.keys(byName.get('tududi_update_task')!.inputSchema.properties)).toEqual(
        expect.arrayContaining([
          'id',
          'title',
          'description',
          'completed',
          'priority',
          'projectId',
          'areaId',
          'dueDate',
          'tags',
        ])
      );
      expect(Object.keys(byName.get('tududi_create_project')!.inputSchema.properties)).toEqual(
        expect.arrayContaining(['name', 'description', 'areaId', 'color'])
      );
      expect(Object.keys(byName.get('tududi_search_tasks')!.inputSchema.properties)).toEqual(
        expect.arrayContaining(['query', 'projectId', 'areaId', 'completed', 'priority', 'tags'])
      );
    });

    it('dispatches all 9 tools and handles tool errors with isError: true', async () => {
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
      expect(calls.listTasks).toBe(1);

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

      const unknownToolRes = await callTool(19, 'tududi_nonexistent', {});
      expect(unknownToolRes.result?.isError).toBe(true);
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
