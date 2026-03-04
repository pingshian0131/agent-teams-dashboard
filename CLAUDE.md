# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

Agent Teams Dashboard — 即時監控 Claude Code agent teams 的 Web 儀表板。監視 `~/.claude/teams/`、`~/.claude/tasks/`、`~/.claude/projects/` 目錄的檔案系統變更，透過 WebSocket 即時串流更新至瀏覽器。

## 開發指令

```bash
# Docker（推薦，一鍵啟動前後端）
docker compose up

# 或手動啟動
npm run dev        # 前端開發伺服器（Vite，localhost:5173，代理 API/WS 至 :3001）
npm run server     # 後端伺服器（localhost:3001）
npm run build      # 正式環境前端建置 → dist/
npm run preview    # 預覽正式建置結果
```

**Docker 開發模式：** `docker compose up` 同時啟動 backend（:3001）和 frontend（:5173）。Source code bind mount 支援 hot reload，後端使用 `tsx watch` 自動重啟。`~/.claude/` 以 read-only 掛入 backend container。

**手動模式：** 需同時執行 `npm run server` 和 `npm run dev`。Vite 開發伺服器會將 `/api/*` 和 `/ws/*` 代理至後端。

## 架構

**純 ESM**（package.json 中 `"type": "module"`）。所有 import 依 ESM 規範使用 `.js` 副檔名。

### 前端（`src/`）
- **React 19 + TypeScript**，使用 Vite 6 建置
- `useTeamsSocket` hook（`src/hooks/useTeamsSocket.ts`）— 單一 WebSocket 連線管理所有應用程式狀態（snapshot、連線狀態、agent activity 快取），無外部狀態管理套件
- 頁面路由為字串型別（App.tsx 的 `view` 狀態）：`'overview'` | `'team'` | `'tasks'` | `'agent'`
- 深色終端機主題，使用 CSS custom properties（JetBrains Mono / Fira Code 字型）

### 後端（`server/`）
- 原生 `node:http` 伺服器 + `ws` WebSocket 套件（無 Express）
- **teamsCache.ts** — 記憶體內快取 teams/tasks/agent activity。掃描檔案系統，維護 byte offset 以增量讀取 JSONL，每個 agent 上限 200 筆
- **teamsWatcher.ts** — `node:fs` 遞迴監視 `~/.claude/teams/` 和 `~/.claude/tasks/`，200ms debounce。JSONL 檔案每 2 秒輪詢。目錄存在性每 5 秒檢查
- **teamsApi.ts** — REST 端點：`GET /api/snapshot`、`/api/teams`、`/api/teams/:id`、`/api/teams/:id/tasks`、`/api/agents/:agentId/activity?limit=N`
- **wsServer.ts** — WebSocket 設置，30 秒心跳。每次資料變更時廣播 `FullSnapshot`

### 資料流
```
~/.claude/ 檔案系統變更
  → 檔案監視器 / 輪詢器（teamsWatcher）
  → 記憶體快取更新（teamsCache）
  → EventEmitter 'change'
  → WebSocket 廣播（完整 snapshot）→ 所有客戶端
  → React 狀態（useTeamsSocket）→ 元件樹
```

### 共用型別（`src/types.ts`）
前後端共用型別定義。主要型別：`TeamConfig`、`TeamMember`、`TeamTask`、`TeamOverview`、`FullSnapshot`、`WsEvent`（WebSocket 訊息的 discriminated union）。

### Docker 開發環境

- `Dockerfile` — Node.js 22 Alpine，含 `docker-entrypoint.sh` 自動安裝依賴
- `docker-compose.yml` — backend + frontend 兩個 service，共用 `app_modules` named volume 避免 node_modules 被 source mount 覆蓋
- `vite.config.ts` — proxy target 透過 `BACKEND_HOST` / `BACKEND_PORT` 環境變數設定（預設 `localhost:3001`，Docker 內自動指向 `backend:3001`）

## 環境變數

- `PORT` — 後端伺服器埠號（預設：`3001`）
- `BACKEND_HOST` — Vite proxy 的後端主機名（預設：`localhost`，Docker 內為 `backend`）
- `BACKEND_PORT` — Vite proxy 的後端埠號（預設：`3001`）

## 正式環境部署

先建置前端（`npm run build`），再執行 `tsx server/index.ts`。伺服器從 `dist/` 提供靜態檔案（含 SPA fallback），並在同一埠號提供 API/WebSocket 端點。
