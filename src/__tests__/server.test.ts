import request from 'supertest';

jest.mock('../config.js', () => ({
  getConfig: () => ({
    tududuApiUrl: 'http://localhost:8080',
    tududuApiKey: 'test-key',
    transport: 'http' as const,
    port: 3000,
    logLevel: 'silent',
  }),
}));

jest.mock('../tududi-client.js', () => ({
  TududuClient: jest.fn(),
}));

jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation((options: any) => {
    const sessionId = 'test-session-abc123';
    let initialized = false;
    return {
      get sessionId() {
        return sessionId;
      },
      onclose: undefined,
      handleRequest: jest.fn().mockImplementation(async (_req: any, res: any) => {
        if (!initialized) {
          initialized = true;
          options?.onsessioninitialized?.(sessionId);
        }
        res.status(200).json({ jsonrpc: '2.0', result: 'ok' });
      }),
    };
  }),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: {},
  CallToolRequestSchema: {},
}));

import { createExpressApp } from '../server.js';

describe('HTTP transport routes', () => {
  beforeAll(() => {
    process.env.LOG_LEVEL = 'silent';
  });

  describe('GET /mcp', () => {
    it('returns 400 when no session ID header is provided', async () => {
      const app = createExpressApp();
      const res = await request(app).get('/mcp');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid or missing session ID');
    });

    it('returns 400 for an unknown session ID', async () => {
      const app = createExpressApp();
      const res = await request(app).get('/mcp').set('mcp-session-id', 'nonexistent');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid or missing session ID');
    });
  });

  describe('DELETE /mcp', () => {
    it('returns 400 when no session ID header is provided', async () => {
      const app = createExpressApp();
      const res = await request(app).delete('/mcp');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid or missing session ID');
    });

    it('returns 400 for an unknown session ID', async () => {
      const app = createExpressApp();
      const res = await request(app).delete('/mcp').set('mcp-session-id', 'nonexistent');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid or missing session ID');
    });
  });

  describe('POST /mcp', () => {
    it('creates a new session and returns 200 when no session ID is provided', async () => {
      const app = createExpressApp();
      const res = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });
      expect(res.status).toBe(200);
    });

    it('stores the session so subsequent requests with that ID succeed', async () => {
      const app = createExpressApp();

      await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });

      const res = await request(app)
        .get('/mcp')
        .set('mcp-session-id', 'test-session-abc123');
      expect(res.status).toBe(200);
    });

    it('reuses an existing session when a valid session ID header is provided', async () => {
      const app = createExpressApp();

      // Establish session
      await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });

      // Second request reuses it
      const res = await request(app)
        .post('/mcp')
        .set('mcp-session-id', 'test-session-abc123')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 2 });
      expect(res.status).toBe(200);
    });
  });
});
