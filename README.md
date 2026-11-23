# Tududi MCP

[![CI](https://github.com/jerrytunin/tududi-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jerrytunin/tududi-mcp/actions/workflows/ci.yml)
[![Docker](https://github.com/jerrytunin/tududi-mcp/actions/workflows/docker.yml/badge.svg)](https://github.com/jerrytunin/tududi-mcp/actions/workflows/docker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

A Model Context Protocol (MCP) server that integrates [Tududi](https://tududi.com/) task management with AI assistants and developer tools.

## Overview

Tududi MCP connects AI assistants (Claude Desktop, ChatGPT connectors, Cursor, VS Code / GitHub Copilot, and Augment Code) directly to your Tududi 1.1+ workspace over **stdio** or **Streamable HTTP**.

### Features

- **52 MCP Tools across 9 Domains**: Full CRUD and workflow support for Tasks, Subtasks, Task Comments, Projects, Areas, Tags, Notes, Inbox Capture, Goals, and Habits.
- **Rich GTD & Scheduling Support**: Filter tasks by GTD views (`today`, `upcoming`, `inbox`, `next`, `someday`, `waiting`), track metrics, and set `deferUntil`, `startDate`, `dueTime`, `estimatedMinutes`, `today`, and recurrence rules.
- **16 MCP Resources & URI Templates**: Read-only JSON snapshots (`tududi://tasks/today`, `tududi://projects`, etc.) plus dynamic item lookups (`tududi://task/{uid}`, `tududi://note/{uid}`, etc.).
- **4 MCP Workflow Prompts**: Guided prompts for Daily Planning, Weekly GTD Review, Inbox Triage, and Project Breakdown.
- **Dual Transport**: Local `stdio` (default) or remote Streamable HTTP (`/mcp` + `/health`) with optional `MCP_AUTH_TOKEN` Bearer authentication.
- **Tududi 1.1+ Compatible**: Targets `/api/v1` endpoints, auto-normalizes `TUDUDI_API_URL`, and supports both API key and session login authentication.

## Prerequisites

- **Tududi**: Version **1.1+** (`/api/v1` endpoints)
- **Runtime**: Node.js `>= 18.0.0` or Docker

## Installation & Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/jerrytunin/tududi-mcp.git
cd tududi-mcp

# Copy and configure environment variables
cp .env.example .env

# Start in the background (Docker Compose v2)
docker compose up -d
```

> **Note:** When running in `TRANSPORT=http` mode with Docker Compose, uncomment the `ports:` section in [`docker-compose.yml`](docker-compose.yml) (default mapping `3001:3000` avoids colliding with Tududi if it also uses port `3000`).

### Option 2: Docker CLI

```bash
# Build the image
docker build -t tududi-mcp .

# Run in stdio mode
docker run -it --env-file .env tududi-mcp

# Run in Streamable HTTP mode with Bearer auth
docker run -d --name tududi-mcp \
  -p 3001:3000 \
  -e TUDUDI_API_URL=http://tududi:3000 \
  -e TUDUDI_API_KEY=your-api-key \
  -e TRANSPORT=http \
  -e PORT=3000 \
  -e MCP_AUTH_TOKEN=your-secret-bearer-token \
  tududi-mcp
```

### Option 3: Local Node.js Installation

```bash
git clone https://github.com/jerrytunin/tududi-mcp.git
cd tududi-mcp

npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `TUDUDI_API_URL` | Yes | — | Base URL of your Tududi instance (trailing `/`, `/api`, or `/api/v1` is normalized automatically) |
| `TUDUDI_API_KEY` | Conditional | — | Tududi API token (recommended). Required unless `TUDUDI_EMAIL` and `TUDUDI_PASSWORD` are set |
| `TUDUDI_EMAIL` | Conditional | — | Account email for session-cookie login (older Tududi versions without API tokens) |
| `TUDUDI_PASSWORD` | Conditional | — | Account password paired with `TUDUDI_EMAIL` |
| `TRANSPORT` | No | `stdio` | Transport mode: `stdio` or `http` |
| `PORT` | No | `3000` | HTTP listening port (`1–65535`) when `TRANSPORT=http` |
| `MCP_AUTH_TOKEN` | No | — | Optional Bearer token required on `/mcp` (`Authorization: Bearer <token>`) when `TRANSPORT=http` |
| `LOG_LEVEL` | No | `info` | Pino log level (`silent`, `error`, `warn`, `info`, `debug`) |

When `TRANSPORT=http`, the server exposes:

- `http://<host>:<port>/mcp` — MCP Streamable HTTP endpoint (`POST`, `GET`, `DELETE`)
- `http://<host>:<port>/health` — Unauthenticated health check returning `200 {"status":"ok","transport":"http"}`

## MCP Client Configuration

### Local `stdio` (VS Code `.mcp.json`, Cursor, Claude Desktop)

```json
{
  "mcpServers": {
    "tududi": {
      "command": "node",
      "args": ["path/to/tududi-mcp/dist/server.js"],
      "env": {
        "TUDUDI_API_URL": "http://localhost:3000",
        "TUDUDI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Remote Streamable HTTP (Claude, ChatGPT, Homelab Deployments)

```json
{
  "mcpServers": {
    "tududi": {
      "type": "http",
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer your-secret-bearer-token"
      }
    }
  }
}
```

*(Omit `headers` if `MCP_AUTH_TOKEN` is unset behind a trusted reverse proxy or VPN.)*

## Available Tools (52)

### Tasks & Subtasks (10)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_tasks` | List tasks with GTD views and filters | `type` (`today`, `upcoming`, `inbox`, `next`, `someday`, `waiting`, `all`), `status`, `priority`, `projectId`, `areaId`, `tags`, `orderBy`, `includeSubtasks`, `limit`, `offset` |
| `tududi_get_task` | Get a single task by UID or ID | `id` (required) |
| `tududi_create_task` | Create a task with scheduling, recurrence, and subtasks | `title` (required), `description`, `projectId`, `areaId`, `goalId`, `parentTaskId`, `dueDate`, `dueTime`, `deferUntil`, `startDate`, `startTime`, `estimatedMinutes`, `priority`, `status`, `today`, `recurrenceType`, `tags`, `subtasks` |
| `tududi_update_task` | Update an existing task | `id` (required task `uid` or numeric ID), `title`, `description`, `completed`, `status`, `projectId`, `areaId`, `goalId`, `dueDate`, `dueTime`, `deferUntil`, `startDate`, `startTime`, `estimatedMinutes`, `priority`, `today`, recurrence fields, `tags` |
| `tududi_complete_task` | Mark a task complete | `id` (required) |
| `tududi_delete_task` | Delete a task | `id` (required) |
| `tududi_search_tasks` | Search tasks by text and/or filters | `query`, `projectId`, `areaId`, `completed`, `priority`, `tags` |
| `tududi_get_task_metrics` | Fetch task counts and productivity metrics | `type` |
| `tududi_list_subtasks` | List subtasks of a parent task | `taskId` (required) |
| `tududi_create_subtask` | Create a subtask under a parent task | `taskId` (required), `title` (required), `priority`, `status` |

### Task Comments (3)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_comments` | List comments on a task | `taskId` (required) |
| `tududi_create_comment` | Add a comment or reply on a task | `taskId` (required), `content` (required), `parentCommentUid` |
| `tududi_delete_comment` | Delete a comment by UID | `commentId` (required) |

### Projects (6)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_projects` | List projects with optional filters | `status`, `active`, `areaId`, `pinned`, `tags` |
| `tududi_get_project` | Get a single project | `id` (required) |
| `tududi_create_project` | Create a project | `name` (required), `description`, `areaId`, `goalId`, `color`, `status`, `priority`, `dueDate`, `pinned`, `tags` |
| `tududi_update_project` | Update an existing project | `id` (required), `name`, `description`, `areaId`, `goalId`, `color`, `status`, `priority`, `dueDate`, `pinned`, `tags` |
| `tududi_complete_project` | Mark a project done | `id` (required), `completeOpenTasks` |
| `tududi_delete_project` | Delete a project | `id` (required) |

### Areas (5)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_areas` | List all GTD areas | — |
| `tududi_get_area` | Get a single area | `id` (required) |
| `tududi_create_area` | Create an area | `name` (required), `description`, `color` |
| `tududi_update_area` | Update an area | `id` (required), `name`, `description`, `color` |
| `tududi_delete_area` | Delete an area | `id` (required) |

### Tags (4)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_tags` | List tags (optionally scoped by area/project) | `areaUid`, `projectUid` |
| `tududi_create_tag` | Create a tag | `name` (required) |
| `tududi_update_tag` | Rename, pin, or recolor a tag | `identifier` (required UID or name), `name`, `pinned`, `color` |
| `tududi_delete_tag` | Delete a tag | `identifier` (required UID or name) |

### Notes (5)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_notes` | List notes with sort/tag/scope filters | `orderBy`, `tag`, `areaUid`, `projectUid`, `tags` |
| `tududi_get_note` | Get a single note by UID | `id` (required) |
| `tududi_create_note` | Create a note | `title` (required), `content`, `projectId`, `tags`, `color` |
| `tududi_update_note` | Update an existing note | `id` (required), `title`, `content`, `projectId`, `tags`, `color`, `pinned` |
| `tududi_delete_note` | Delete a note | `id` (required) |

### Inbox Quick Capture (6)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_inbox` | List active GTD inbox capture items | `limit`, `offset` |
| `tududi_get_inbox_item` | Get a single inbox item | `id` (required) |
| `tududi_create_inbox_item` | Quick-capture text into the inbox | `content` (required), `source` |
| `tududi_update_inbox_item` | Update inbox item content or status | `id` (required), `content`, `status` |
| `tududi_process_inbox_item` | Mark an inbox item processed | `id` (required), `taskUid`, `projectUid`, `noteUid` |
| `tududi_delete_inbox_item` | Delete an inbox item | `id` (required) |

### Goals (5)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_goals` | List goals with optional area filter | `areaId` |
| `tududi_get_goal` | Get a single goal | `id` (required) |
| `tududi_create_goal` | Create a goal | `title` (required), `areaId`, `why`, `horizon`, `targetDate`, `status`, `color` |
| `tududi_update_goal` | Update an existing goal | `id` (required), `title`, `areaId`, `why`, `horizon`, `targetDate`, `status`, `color` |
| `tududi_delete_goal` | Delete a goal | `id` (required) |

### Habits (8)

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `tududi_list_habits` | List active or archived habits | `archived` |
| `tududi_get_habit` | Get habit details and streak progress | `id` (required) |
| `tududi_create_habit` | Create a habit | `name` (required), `description`, `priority`, `polarity`, `frequencyPeriod`, `targetCount`, `targetValue`, `unit`, `scheduleDays`, `intervalDays`, `timeOfDay`, `reminderTime`, `color` |
| `tududi_update_habit` | Update habit settings or archive state | `id` (required), habit settings, `archived` |
| `tududi_log_habit_completion` | Log a habit completion | `id` (required), `completedAt`, `value`, `note` |
| `tududi_skip_habit_day` | Skip a day without breaking streak logic | `id` (required), `date`, `note` |
| `tududi_get_habit_stats` | Fetch habit completion statistics | `id` (required), `startDate`, `endDate` |
| `tududi_delete_habit` | Delete a habit | `id` (required) |

## MCP Resources & Templates (16)

### Static Resources (`application/json`)

- `tududi://tasks/today` — Today / Daily Plan tasks
- `tududi://tasks/upcoming` — Upcoming tasks (next 7 days)
- `tududi://tasks/inbox` — Unorganized tasks (`type=inbox`)
- `tududi://tasks/metrics` — Task counts and productivity metrics
- `tududi://projects` — All projects
- `tududi://areas` — All areas
- `tududi://tags` — All tags
- `tududi://notes` — All notes
- `tududi://inbox` — Active GTD inbox captures
- `tududi://goals` — All goals
- `tududi://habits` — Active habits with streak evaluations

### URI Templates (`application/json`)

- `tududi://task/{uid}` — Single task details
- `tududi://project/{uid}` — Single project details
- `tududi://note/{uid}` — Single note content and metadata
- `tududi://goal/{uid}` — Single goal details
- `tududi://habit/{uid}` — Single habit details and evaluation

## MCP Prompts (4)

| Prompt | Description | Arguments |
| :--- | :--- | :--- |
| `tududi_daily_plan` | Build a focused daily plan from today/upcoming tasks and habits | `focusArea` (optional) |
| `tududi_weekly_review` | Conduct a full GTD weekly review across inbox, projects, goals, and habits | `includeHabits` (optional) |
| `tududi_inbox_triage` | Clarify and convert inbox items into tasks, projects, or notes | `maxItems` (optional) |
| `tududi_project_breakdown` | Break a project down into milestones, tasks, and subtasks | `projectName` (required), `areaName`, `targetDate` |

## Development

```bash
npm install
npm run build
npm run lint
npm run format:check
npm test
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Links

- [Tududi](https://tududi.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub Repository](https://github.com/jerrytunin/tududi-mcp)
