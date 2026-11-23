import {
  ErrorCode,
  McpError,
  ReadResourceResult,
  Resource,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/types.js';
import { TududuClient } from './tududi-client.js';

export const TUDUDI_RESOURCES: Resource[] = [
  {
    uri: 'tududi://tasks/today',
    name: 'Today Tasks',
    description: 'Tasks scheduled on the Today / Daily Plan view',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://tasks/upcoming',
    name: 'Upcoming Tasks',
    description: 'Tasks and recurring items due in the next 7 days',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://tasks/inbox',
    name: 'Inbox Tasks',
    description: 'Unorganized tasks without a project or due date',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://tasks/metrics',
    name: 'Task Metrics',
    description: 'Summary productivity metrics and task counts',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://projects',
    name: 'Projects',
    description: 'All accessible Tududi projects',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://areas',
    name: 'Areas',
    description: 'All GTD areas of responsibility',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://tags',
    name: 'Tags',
    description: 'All user tags with usage counts',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://notes',
    name: 'Notes',
    description: 'All Tududi notes',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://inbox',
    name: 'Inbox Capture Items',
    description: 'Active raw quick-capture GTD inbox items',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://goals',
    name: 'Goals',
    description: 'All Tududi goals',
    mimeType: 'application/json',
  },
  {
    uri: 'tududi://habits',
    name: 'Habits',
    description: 'Active habits with streak and completion progress',
    mimeType: 'application/json',
  },
];

export const TUDUDI_RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    uriTemplate: 'tududi://task/{uid}',
    name: 'Task by UID',
    description: 'Detailed JSON representation of a specific task',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'tududi://project/{uid}',
    name: 'Project by UID',
    description: 'Detailed JSON representation of a specific project',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'tududi://note/{uid}',
    name: 'Note by UID',
    description: 'Full content and metadata of a specific note',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'tududi://goal/{uid}',
    name: 'Goal by UID',
    description: 'Detailed JSON representation of a specific goal',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'tududi://habit/{uid}',
    name: 'Habit by UID',
    description: 'Detailed JSON representation and evaluation of a specific habit',
    mimeType: 'application/json',
  },
];

const TEMPLATE_PATTERN = /^tududi:\/\/(task|project|note|goal|habit)\/([^/]+)$/;

export async function readTududiResource(
  client: TududuClient,
  uri: string
): Promise<ReadResourceResult> {
  const staticHandlers: Record<string, () => Promise<unknown>> = {
    'tududi://tasks/today': () => client.listTasks({ type: 'today' }),
    'tududi://tasks/upcoming': () => client.listTasks({ type: 'upcoming' }),
    'tududi://tasks/inbox': () => client.listTasks({ type: 'inbox' }),
    'tududi://tasks/metrics': () => client.getTaskMetrics(),
    'tududi://projects': () => client.listProjects(),
    'tududi://areas': () => client.listAreas(),
    'tududi://tags': () => client.listTags(),
    'tududi://notes': () => client.listNotes(),
    'tududi://inbox': () => client.listInboxItems(),
    'tududi://goals': () => client.listGoals(),
    'tududi://habits': () => client.listHabits(),
  };

  let data: unknown;
  const staticLoader = staticHandlers[uri];
  if (staticLoader) {
    data = await staticLoader();
  } else {
    const match = TEMPLATE_PATTERN.exec(uri);
    if (!match) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown resource URI: ${uri}`);
    }
    const kind = match[1];
    const uid = decodeURIComponent(match[2]);
    const templateHandlers: Record<string, (id: string) => Promise<unknown>> = {
      task: (id) => client.getTask(id),
      project: (id) => client.getProject(id),
      note: (id) => client.getNote(id),
      goal: (id) => client.getGoal(id),
      habit: (id) => client.getHabit(id),
    };
    data = await templateHandlers[kind](uid);
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
