#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID, timingSafeEqual } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import { realpathSync } from 'fs';
import { resolve } from 'path';
import { Config, getConfig } from './config.js';
import { logger } from './logger.js';
import { getTududiPrompt, TUDUDI_PROMPTS } from './prompts.js';
import { readTududiResource, TUDUDI_RESOURCE_TEMPLATES, TUDUDI_RESOURCES } from './resources.js';
import { executeToolCall, TUDUDI_TOOLS } from './tools.js';
import { TududuClient } from './tududi-client.js';

export interface HttpAppOptions {
  client?: TududuClient;
  mcpAuthToken?: string;
}

function createClientFromConfig(config: Config): TududuClient {
  return new TududuClient(
    config.tududuApiUrl,
    config.tududuApiKey,
    config.tududuEmail,
    config.tududuPassword
  );
}

function tokensEqual(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

function isInitializePayload(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        (item as { method?: unknown }).method === 'initialize'
    );
  }
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { method?: unknown }).method === 'initialize'
  );
}

export function createMcpServer(client: TududuClient): Server {
  const server = new Server(
    { name: 'tududi-mcp', version: '0.3.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TUDUDI_TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    try {
      return await executeToolCall(client, name, rawArgs);
    } catch (error) {
      logger.error({ error, tool: name }, 'Tool execution failed');
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: TUDUDI_RESOURCES };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return { resourceTemplates: TUDUDI_RESOURCE_TEMPLATES };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return readTududiResource(client, request.params.uri);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: TUDUDI_PROMPTS };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return getTududiPrompt(request.params.name, request.params.arguments);
  });

  return server;
}

async function startStdio(client: TududuClient): Promise<void> {
  const server = createMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Tududi MCP server running on stdio');
}

export function createExpressApp(options?: HttpAppOptions): express.Application {
  const resolvedConfig = options?.client ? undefined : getConfig();
  const resolvedClient = options?.client ?? createClientFromConfig(resolvedConfig!);
  const expectedToken =
    options?.mcpAuthToken ?? (options?.client ? undefined : resolvedConfig?.mcpAuthToken);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', transport: 'http' });
  });

  if (expectedToken) {
    app.use('/mcp', (req: Request, res: Response, next: NextFunction): void => {
      const authHeader = req.headers.authorization;
      const match = typeof authHeader === 'string' ? /^Bearer\s+(.+)$/i.exec(authHeader) : null;
      if (!match || !tokensEqual(match[1], expectedToken)) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    });
  }

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;

      if (sessionId) {
        const transport = sessions.get(sessionId);
        if (!transport) {
          res.status(400).json({ error: 'Invalid or missing session ID' });
          return;
        }
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializePayload(req.body)) {
        res.status(400).json({ error: 'Invalid or missing session ID' });
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string): void => {
          sessions.set(id, transport);
          logger.debug({ sessionId: id }, 'MCP session initialized');
        },
      });
      transport.onclose = (): void => {
        const id = transport.sessionId;
        if (id) {
          sessions.delete(id);
          logger.debug({ sessionId: id }, 'MCP session closed');
        }
      };

      const server = createMcpServer(resolvedClient);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error({ error }, 'Error handling POST /mcp request');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.get('/mcp', async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;
      const transport = sessionId ? sessions.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).json({ error: 'Invalid or missing session ID' });
        return;
      }
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error({ error }, 'Error handling GET /mcp request');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.delete('/mcp', async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;
      const transport = sessionId ? sessions.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).json({ error: 'Invalid or missing session ID' });
        return;
      }
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error({ error }, 'Error handling DELETE /mcp request');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  return app;
}

async function startHttp(config: Config): Promise<void> {
  if (!config.mcpAuthToken) {
    logger.warn('MCP_AUTH_TOKEN is not set; HTTP /mcp endpoint is running without authentication');
  }
  const app = createExpressApp({
    client: createClientFromConfig(config),
    mcpAuthToken: config.mcpAuthToken,
  });
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Tududi MCP HTTP server listening');
  });
}

async function main(): Promise<void> {
  const config = getConfig();
  const client = createClientFromConfig(config);
  logger.info({ transport: config.transport }, 'Starting Tududi MCP server');

  if (config.transport === 'http') {
    await startHttp(config);
  } else {
    await startStdio(client);
  }
}

function isMainModule(): boolean {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined ||
    !process.argv[1]
  ) {
    return false;
  }
  try {
    return /[\\/]server\.(?:[cm]?js|ts)$/i.test(realpathSync(resolve(process.argv[1])));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().catch((error) => {
    logger.error({ error }, 'Server failed to start');
    process.exit(1);
  });
}
