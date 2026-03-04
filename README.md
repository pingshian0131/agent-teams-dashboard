# Agent Teams Dashboard

Real-time monitoring dashboard for [Claude Code](https://claude.ai/code) agent teams. Streams file system changes via WebSocket to track team collaboration, task progress, and agent activity.

[繁體中文](https://github.com/pingshian0131/agent-teams-dashboard/blob/main/README.zh-TW.md)

## Features

- **Dual-Sidebar Navigation** — Three-panel layout: TeamsPanel → AgentsPanel → MainPanel
- **Team Overview** — Live status cards with status dots, progress bars, and member counts
- **Agent Sessions** — Per-agent session grouping with expandable timeline
- **Kanban Task Board** — Pending / In Progress / Completed columns
- **Agent Activity Monitor** — Real-time messages and tool usage per agent
- **WebSocket Streaming** — File system changes pushed to browser instantly

### Layout

```
┌──────────────┬────────────────┬──────────────────────┐
│ TeamsPanel   │ AgentsPanel    │ MainPanel            │
│ (200px)      │ (260px)        │ (flex: 1)            │
└──────────────┴────────────────┴──────────────────────┘
```

## Demo

### Overview — Teams & Status Cards
![Overview](docs/demo-overview.png)

### Task Board — Kanban View
![Task Board](docs/demo-taskboard.png)

### Agent Panel — Activity Detail
![Agent Panel](docs/demo-agent-panel.png)

## Quick Start

```bash
npx agent-teams-dashboard
```

Open `http://localhost:3001` in your browser.

Use the `PORT` environment variable to change the port:

```bash
PORT=8080 npx agent-teams-dashboard
```

## Development

### Docker (Recommended)

```bash
docker compose up
```

Visit `http://localhost:5173`. Code changes hot reload automatically.

### Manual

```bash
npm install

# Terminal 1 — backend
npm run server

# Terminal 2 — frontend dev server
npm run dev
```

Visit `http://localhost:5173`.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend dev server (Vite, port 5173) |
| `npm run server` | Backend server (port 3001) |
| `npm run build` | Build frontend to `dist/` |
| `npm run build:server` | Compile backend to `server-dist/` |
| `npm run preview` | Preview production build |
| `docker compose up` | Start both frontend & backend via Docker |

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 6
- **Backend:** Node.js + native HTTP + ws (WebSocket)
- **Data Source:** Watches `~/.claude/teams/`, `~/.claude/tasks/`, `~/.claude/projects/`

## Production

```bash
npm run build
npm run server
```

The server serves static files from `dist/` and provides API/WebSocket endpoints on the same port (default 3001).

## Inspiration

Inspired by [Claude Code Agent Teams Demo](https://youtu.be/Gmzh9HP7JGM?si=LDUFqPz0syBsWuta)

## License

MIT
