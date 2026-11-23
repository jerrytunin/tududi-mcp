#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID, timingSafeEqual } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import { realpathSync } from 'fs';
import { resolve } from 'path';
import { Config, getConfig } from './config.js';
import { logger } from './logger.js';
import { TududuClient } from './tududi-client.js';
import {
  CreateProjectInput,
  CreateTaskInput,
  SearchTasksParams,
  UpdateTaskInput,
} from './types.js';

export interface HttpAppOptions {
  client?: TududuClient;
  mcpAuthToken?: string;
}

interface IdArg {
  id: string;
}

type UpdateTaskArgs = UpdateTaskInput & IdArg;

function createClientFromConfig(config: Config): TududuClient {
  return new TududuClient(
    config.tududuApiUrl,
    config.tududuApiKey,
    config.tududuEmail,
    config.tududuPassword
  );
}

function requireStringArg(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing or invalid required parameter: ${field}`);
  }
  return value.trim();
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
    { name: 'tududi-mcp', version: '0.2.0' },
    { capabilities: { tools: {} } }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'tududi_list_tasks',
          description: 'List all tasks from Tududi',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'tududi_create_task',
          description: 'Create a new task in Tududi',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Task description' },
              projectId: { type: 'string', description: 'Project ID to assign task to' },
              areaId: { type: 'string', description: 'Area ID to assign task to' },
              dueDate: {
                type: 'string',
                description: 'Due date in ISO format (YYYY-MM-DD or full ISO)',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Task priority',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags to assign to the task',
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
              description: {
                type: 'string',
                description: 'New task description (mapped to note in Tududi)',
              },
              completed: { type: 'boolean', description: 'Task completion status' },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Task priority',
              },
              projectId: {
                type: 'string',
                description: 'Project ID or UID to assign task to',
              },
              areaId: {
                type: 'string',
                description: 'Area ID or UID to assign task to',
              },
              dueDate: {
                type: 'string',
                description: 'Due date in ISO format (YYYY-MM-DD or full ISO)',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags to assign to the task',
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
          name: 'tududi_list_projects',
          description: 'List all projects from Tududi',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'tududi_create_project',
          description: 'Create a new project in Tududi',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Project name' },
              description: { type: 'string', description: 'Project description' },
              areaId: { type: 'string', description: 'Area ID to assign project to' },
              color: { type: 'string', description: 'Project color (hex code or name)' },
            },
            required: ['name'],
          },
        },
        {
          name: 'tududi_list_areas',
          description: 'List all areas from Tududi',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'tududi_search_tasks',
          description: 'Search tasks with filters',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              projectId: { type: 'string', description: 'Filter by project ID or UID' },
              areaId: { type: 'string', description: 'Filter by area ID or UID' },
              completed: { type: 'boolean', description: 'Filter by completion status' },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Filter by priority',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tag names',
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case 'tududi_list_tasks': {
          const tasks = await client.listTasks();
          return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
        }
        case 'tududi_create_task': {
          requireStringArg(args, 'title');
          const task = await client.createTask(args as unknown as CreateTaskInput);
          return {
            content: [
              {
                type: 'text',
                text: `Task created successfully:\n${JSON.stringify(task, null, 2)}`,
              },
            ],
          };
        }
        case 'tududi_update_task': {
          const id = requireStringArg(args, 'id');
          const { id: _omitted, ...updateData } = args as unknown as UpdateTaskArgs;
          void _omitted;
          const task = await client.updateTask(id, updateData);
          return {
            content: [
              {
                type: 'text',
                text: `Task updated successfully:\n${JSON.stringify(task, null, 2)}`,
              },
            ],
          };
        }
        case 'tududi_delete_task': {
          const id = requireStringArg(args, 'id');
          await client.deleteTask(id);
          return { content: [{ type: 'text', text: `Task ${id} deleted successfully` }] };
        }
        case 'tududi_complete_task': {
          const id = requireStringArg(args, 'id');
          const task = await client.completeTask(id);
          return {
            content: [
              {
                type: 'text',
                text: `Task completed successfully:\n${JSON.stringify(task, null, 2)}`,
              },
            ],
          };
        }
        case 'tududi_list_projects': {
          const projects = await client.listProjects();
          return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
        }
        case 'tududi_create_project': {
          requireStringArg(args, 'name');
          const project = await client.createProject(args as unknown as CreateProjectInput);
          return {
            content: [
              {
                type: 'text',
                text: `Project created successfully:\n${JSON.stringify(project, null, 2)}`,
              },
            ],
          };
        }
        case 'tududi_list_areas': {
          const areas = await client.listAreas();
          return { content: [{ type: 'text', text: JSON.stringify(areas, null, 2) }] };
        }
        case 'tududi_search_tasks': {
          const tasks = await client.searchTasks(args as unknown as SearchTasksParams);
          return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
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
