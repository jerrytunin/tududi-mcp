import { ErrorCode, GetPromptResult, McpError, Prompt } from '@modelcontextprotocol/sdk/types.js';

export const TUDUDI_PROMPTS: Prompt[] = [
  {
    name: 'tududi_daily_plan',
    description:
      'Review today tasks, overdue/upcoming deadlines, and daily habits to propose a focused daily plan',
    arguments: [
      {
        name: 'focusArea',
        description: 'Optional GTD area name or UID to prioritize today',
        required: false,
      },
    ],
  },
  {
    name: 'tududi_weekly_review',
    description:
      'Run a full GTD weekly review across inbox items, projects, stalled areas, goals, and habits',
    arguments: [
      {
        name: 'includeHabits',
        description: 'Set to "false" to skip habit streak and stats review (default: true)',
        required: false,
      },
    ],
  },
  {
    name: 'tududi_inbox_triage',
    description:
      'Clarify and process raw Tududi inbox capture items into tasks, projects, or reference notes',
    arguments: [
      {
        name: 'maxItems',
        description: 'Optional maximum number of inbox items to triage in one pass',
        required: false,
      },
    ],
  },
  {
    name: 'tududi_project_breakdown',
    description:
      'Break a project or objective down into concrete Tududi next actions, subtasks, and milestones',
    arguments: [
      {
        name: 'projectName',
        description: 'Name or UID of the project to plan or break down',
        required: true,
      },
      {
        name: 'areaName',
        description: 'Optional GTD area name or UID to file the project under',
        required: false,
      },
      {
        name: 'targetDate',
        description: 'Optional target due date (YYYY-MM-DD)',
        required: false,
      },
    ],
  },
];

export function getTududiPrompt(name: string, args: Record<string, string> = {}): GetPromptResult {
  switch (name) {
    case 'tududi_daily_plan': {
      const focusNote = args.focusArea?.trim()
        ? ` Prioritize items related to area "${args.focusArea.trim()}".`
        : '';
      return {
        description:
          'Focused daily planning workflow using Tududi tasks, upcoming items, and habits',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                'Help me plan my day using Tududi.' +
                focusNote +
                ' Follow these steps:\n' +
                '1. Call `tududi_list_tasks` with `type: "today"` and `type: "upcoming"` (and `tududi_get_task_metrics`).\n' +
                '2. Call `tududi_list_habits` to check due daily habits.\n' +
                '3. Group recommendations into: Must-Do Today (top 3), Scheduled/Overdue Follow-ups, Quick Wins, and Habit Check-ins.\n' +
                '4. Ask before marking tasks complete or changing `today` / `dueDate` fields.',
            },
          },
        ],
      };
    }

    case 'tududi_weekly_review': {
      const includeHabits = args.includeHabits?.trim().toLowerCase() !== 'false';
      const habitStep = includeHabits
        ? '4. Review `tududi_list_habits` and `tududi_get_habit_stats` for any active habits needing schedule adjustments.\n'
        : '';
      return {
        description: 'GTD weekly review across inbox, active projects, goals, and habits',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                'Guide me through a GTD Weekly Review in Tududi:\n' +
                '1. Check `tududi_list_inbox` and `tududi_list_tasks` with `type: "inbox"` for unclarified captures.\n' +
                '2. Check `tududi_list_projects` with `active: true` and identify stalled projects (projects missing active next actions) plus overdue tasks.\n' +
                '3. Check `tududi_list_goals` and `tududi_list_tasks` with `type: "waiting"` / `type: "someday"`.\n' +
                habitStep +
                'Summarize findings, flag stalled projects, and recommend next actions before applying updates.',
            },
          },
        ],
      };
    }

    case 'tududi_inbox_triage': {
      const maxItemsNote = args.maxItems?.trim()
        ? ` Limit this triage pass to the first ${args.maxItems.trim()} items.`
        : '';
      return {
        description: 'Triage raw Tududi inbox items into actionable tasks, projects, or notes',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                'Triage my Tududi GTD inbox.' +
                maxItemsNote +
                '\n1. Fetch `tududi_list_inbox`, `tududi_list_projects`, `tududi_list_areas`, and `tududi_list_tags`.\n' +
                '2. For each inbox item, propose one concrete outcome: actionable task (`tududi_create_task`), multi-step project (`tududi_create_project`), reference note (`tududi_create_note`), or discard (`tududi_delete_inbox_item`).\n' +
                '3. Once confirmed, create the target item and call `tududi_process_inbox_item` with the resulting UID (`taskUid`, `projectUid`, or `noteUid`).',
            },
          },
        ],
      };
    }

    case 'tududi_project_breakdown': {
      const projectName = args.projectName?.trim();
      if (!projectName) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Missing required prompt argument: projectName'
        );
      }
      const areaNote = args.areaName?.trim() ? ` Area: ${args.areaName.trim()}.` : '';
      const dateNote = args.targetDate?.trim()
        ? ` Target completion date: ${args.targetDate.trim()}.`
        : '';
      return {
        description: `Break down project "${projectName}" into Tududi tasks and subtasks`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Break down the project "${projectName}" into an actionable plan in Tududi.` +
                areaNote +
                dateNote +
                '\n1. Search `tududi_list_projects` and `tududi_list_areas` to see if the project already exists.\n' +
                '2. Propose milestones, concrete next tasks (with `estimatedMinutes`, `priority`, and `dueDate`), and subtasks (`tududi_create_subtask` or inline `subtasks`).\n' +
                '3. Ask for confirmation before creating or updating the project and tasks.',
            },
          },
        ],
      };
    }

    default:
      throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
  }
}
