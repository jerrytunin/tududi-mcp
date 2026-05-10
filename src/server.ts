#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from './config.js';
import { logger } from './logger.js';
import { TududuClient } from './tududi-client.js';

// Initialize configuration and client
const config = getConfig();
const tududuClient = new TududuClient(
  config.tududuApiUrl,
  config.tududuApiKey,
  config.tududuEmail,
  config.tududuPassword
);

// Create MCP server
const server = new Server(
  {
    name: 'tududi-mcp',
    version: '0.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'tududi_list_tasks',
        description: 'List all tasks from Tududi',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'tududi_create_task',
        description: 'Create a new task in Tududi',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Task title',
            },
            description: {
              type: 'string',
              description: 'Task description',
            },
            projectId: {
              type: 'string',
              description: 'Project ID to assign task to',
            },
            areaId: {
              type: 'string',
              description: 'Area ID to assign task to',
            },
            dueDate: {
              type: 'string',
              description: 'Due date in ISO format',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority',
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
              description: 'Task uid (string hash from list_tasks - NOT the numeric id)',
            },
            title: {
              type: 'string',
              description: 'New task title',
            },
            description: {
              type: 'string',
              description: 'New task description (mapped to note in Tududi)',
            },
            completed: {
              type: 'boolean',
              description: 'Task completion status',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority',
            },
            projectId: {
              type: 'string',
              description: 'Project ID to assign task to (numeric id from list_projects)',
            },
            areaId: {
              type: 'string',
              description: 'Area ID to assign task to',
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
              description: 'Task uid (string hash from list_tasks - NOT the numeric id)',
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
              description: 'Task uid (string hash from list_tasks - NOT the numeric id)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'tududi_list_projects',
        description: 'List all projects from Tududi',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'tududi_create_project',
        description: 'Create a new project in Tududi',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Project name',
            },
            description: {
              type: 'string',
              description: 'Project description',
            },
            areaId: {
              type: 'string',
              description: 'Area ID to assign project to',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'tududi_list_areas',
        description: 'List all areas from Tududi',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'tududi_search_tasks',
        description: 'Search tasks with filters',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            projectId: {
              type: 'string',
              description: 'Filter by project ID',
            },
            areaId: {
              type: 'string',
              description: 'Filter by area ID',
            },
            completed: {
              type: 'boolean',
              description: 'Filter by completion status',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Filter by priority',
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'tududi_list_tasks': {
        const tasks = await tududuClient.listTasks();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      }

      case 'tududi_create_task': {
        const task = await tududuClient.createTask(args as any);
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
        const { id, ...updateData } = args as any;
        const task = await tududuClient.updateTask(id, updateData);
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
        const { id } = args as any;
        await tududuClient.deleteTask(id);
        return {
          content: [
            {
              type: 'text',
              text: `Task ${id} deleted successfully`,
            },
          ],
        };
      }

      case 'tududi_complete_task': {
        const { id } = args as any;
        const task = await tududuClient.completeTask(id);
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
        const projects = await tududuClient.listProjects();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      }

      case 'tududi_create_project': {
        const project = await tududuClient.createProject(args as any);
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
        const areas = await tududuClient.listAreas();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(areas, null, 2),
            },
          ],
        };
      }

      case 'tududi_search_tasks': {
        const tasks = await tududuClient.searchTasks(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
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

// Start server
async function main() {
  logger.info('Starting Tududi MCP server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Tududi MCP server running');
}

main().catch((error) => {
  logger.error({ error }, 'Server failed to start');
  process.exit(1);
});
