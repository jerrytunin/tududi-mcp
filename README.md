# Tududi MCP

[![CI](https://github.com/jerrytunin/tududi-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jerrytunin/tududi-mcp/actions/workflows/ci.yml)
[![Docker](https://github.com/jerrytunin/tududi-mcp/actions/workflows/docker.yml/badge.svg)](https://github.com/jerrytunin/tududi-mcp/actions/workflows/docker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

A Model Context Protocol (MCP) server that integrates [Tududi](https://tududi.com/) task management with AI-powered development tools.

## Overview

Tududi MCP enables AI agents and developers to interact with Tududi tasks, projects, and areas directly from their IDE. Manage your tasks seamlessly while coding, powered by the Model Context Protocol standard.

### Features

- **Task Management**: Create, read, update, and delete tasks
- **Project Organization**: Manage projects and organize work
- **Area Management**: Organize tasks by areas
- **Search & Filter**: Query tasks with flexible filtering
- **AI-Ready**: Works with AI agents like GitHub Copilot and Augment Code Agent

## Installation

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/jerrytunin/tududi-mcp.git
cd tududi-mcp

# Copy environment file
cp .env.example .env
# Edit .env with your Tududi API URL and key

# Build and run with Docker Compose
docker-compose up -d

# Or build Docker image manually
docker build -t tududi-mcp .
docker run -it --env-file .env tududi-mcp
```

### Option 2: Local Installation

```bash
# Clone the repository
git clone https://github.com/jerrytunin/tududi-mcp.git
cd tududi-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

The MCP server supports either `stdio` or `http` transport depending on the
`TRANSPORT` environmental variable. When set to `http`, one can set the port
that the server will listen on for requests with the `PORT` variable. If
not specified, the port will default to 3000.

The MCP server supports two authentication methods:

### Option 1: API Key Authentication (Newer Tududi Versions)

Create a `.env` file:

```env
TUDUDI_API_URL=http://localhost:3000
TUDUDI_API_KEY=your-api-key-here
LOG_LEVEL=info
TRANSPORT=stdio     # or http
PORT=3000           # only necessary if transport is http
```

### Option 2: Email/Password Authentication (Older Tududi Versions)

If your Tududi instance doesn't support API tokens yet, use email/password authentication:

```env
TUDUDI_API_URL=http://localhost:3000
TUDUDI_EMAIL=your-email@example.com
TUDUDI_PASSWORD=your-password
LOG_LEVEL=info
TRANSPORT=stdio     # or http
PORT=3000           # only necessary if transport is http
```

The MCP server will automatically detect which authentication method to use based on the environment variables provided.

### Visual Studio Configuration

Add to your `.mcp.json`:

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

## Docker Usage

### Using Docker Compose

```bash
# Start the server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

### Using Docker Directly

```bash
# Build the image
docker build -t tududi-mcp .

# Run the container
docker run -it \
  -e TUDUDI_API_URL=http://localhost:3000 \
  -e TUDUDI_API_KEY=your-api-key \
  -e LOG_LEVEL=info \
  tududi-mcp

# Run in background
docker run -d --name tududi-mcp \
  -e TUDUDI_API_URL=http://localhost:3000 \
  -e TUDUDI_API_KEY=your-api-key \
  tududi-mcp
```

## Development

```bash
npm install
npm run build
npm run dev
npm test
```

## Available Tools

- `tududi_list_tasks` - List all tasks
- `tududi_create_task` - Create a new task
- `tududi_update_task` - Update an existing task
- `tududi_delete_task` - Delete a task
- `tududi_complete_task` - Mark a task as complete
- `tududi_list_projects` - List all projects
- `tududi_create_project` - Create a new project
- `tududi_list_areas` - List all areas
- `tududi_search_tasks` - Search tasks with filters

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Tududi](https://tududi.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub Repository](https://github.com/jerrytunin/tududi-mcp)

