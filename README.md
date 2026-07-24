# Twitch Multitask Overlay

A Twitch chat productivity overlay for work streams, study streams, coding sessions, and community focus blocks.

This repository has been reshaped into a streamer-first OBS overlay with viewer tasklists, a broadcaster backlog, a persistent Pomodoro timer, draggable panels, theme support, storage hardening, and a local backend for Twitch token refresh.

## Project Direction

Recent Codex-assisted work on this repo focused on making the overlay usable as a real streaming tool:

- Viewer tasklists remain open to chat so each viewer can track their own work.
- The backlog is now a broadcaster/moderator planning surface for stream tasks.
- The Pomodoro timer is stateful and can survive browser source refreshes.
- OBS layouts were rebuilt around fixed 1920x1080 overlay behavior.
- Panels can be dragged, reset, and persisted per layout.
- Twitch OAuth refresh was added through the FastAPI backend so the browser does not hold the Client Secret.
- localStorage handling was hardened with schema migrations, quota handling, and safer rendering.
- Security and validation coverage was added around task and backlog data.
- The README and ignore rules were cleaned so the project presents itself as its own tool.

## Core Features

### Viewer Tasklists

Viewers can use chat commands to create and manage their own tasklist.

- Add one task or many comma-separated tasks.
- Edit, focus, complete, delete, and check tasks.
- Enforce a configurable task limit per user.
- Store tasklists in browser localStorage.
- Render viewer task cards inside the overlay.

### Streamer Backlog

The backlog is for broadcaster and moderator planning.

- `!backlog add` creates stream backlog items.
- `!backlog edit` updates existing backlog items.
- `!backlog done` marks items complete.
- `!backlog remove` deletes items.
- `!backlog clear` clears completed items.
- `!backlog clear all` clears the full backlog.
- Backlog rendering escapes user content before display.

### Pomodoro Timer

The circular timer supports focused stream sessions.

- Start default or custom focus/break cycles.
- Configure session count up to 12 sessions.
- Pause, resume, stop, reset, and check status from chat.
- Save timer state across browser source refreshes.
- Announce focus, break, and cycle transitions in chat.

### Layouts And Panels

The overlay is built for OBS browser sources.

- Layout presets: `compact`, `split`, `fullOverlay`, `minimal`, `timerWithTasks`, and `dashboard`.
- Draggable panels with saved positions.
- Panel reset commands for recovering a clean layout.
- Default viewport target: `1920x1080`.

### Themes

Themes are loaded from `themes.json`.

- Theme changes can be triggered from chat by broadcaster/moderator commands.
- Theme selection is persisted locally.
- ThemeManager applies CSS variables and optional Google fonts.

### Twitch Auth Refresh

Static OBS browser sources cannot safely store a Twitch Client Secret.

This repo solves that with a local FastAPI backend:

- The browser keeps the access token, refresh token, and client ID.
- The backend keeps `TWITCH_CLIENT_SECRET`.
- The browser calls `/auth/refresh` when Twitch auth expires.
- Refreshed tokens are saved in browser storage.
- `/auth/start` and `/auth/callback` help create initial access and refresh tokens locally.

## Architecture

```text
Twitch Chat
    |
    v
src/twitch/TwitchChat.js
    |
    v
src/index-enhanced.js
    |
    +--> src/app.js                  viewer tasklist commands
    +--> src/classes/BacklogPanel.js streamer backlog panel
    +--> src/classes/CircularTimer.js Pomodoro timer
    +--> src/classes/LayoutManager.js layout and panel persistence
    +--> src/classes/ThemeManager.js  theme loading and CSS variables
    +--> src/twitch/tokenRefresh.js   browser-side token refresh flow

backend/main.py
    |
    +--> /auth/start
    +--> /auth/callback
    +--> /auth/refresh
    +--> SQLite-backed viewer, backlog, preference, and stats endpoints
```

## Quick Start

### Requirements

- Windows, macOS, or Linux.
- Node.js 20 or newer.
- OBS Studio.
- A Twitch account for the bot or channel.
- Python 3.8+ if using the backend.

### Install

```powershell
npm install
```

### Configure Twitch Auth

Copy the auth template:

```powershell
Copy-Item _auth.js.example _auth.js
```

Edit `_auth.js`:

```js
const _authConfig = {
  twitch_oauth: "oauth:your_oauth_token_here",
  twitch_refresh_token: "your_refresh_token_here",
  client_id: "your_twitch_app_client_id",
  twitch_auth_refresh_url: "http://127.0.0.1:8000/auth/refresh",
  twitch_username: "your_bot_username",
  twitch_channel: "your_channel_name",
};
```

Do not commit `_auth.js`.

### Build

```powershell
npm run build
```

### Add To OBS

1. Add a Browser Source.
2. Enable Local File.
3. Select this repo's `index.html`.
4. Use `1920x1080` for a full overlay.
5. Refresh the source after changing config files.

See [OBS_SETUP.md](./OBS_SETUP.md) for more OBS-specific notes.

## Backend Setup

The overlay can run without the backend, but automatic token refresh is most reliable when the backend is running locally to avoid browser CORS issues.

Create `backend/.env`:

```txt
TWITCH_CLIENT_ID=your_twitch_app_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://127.0.0.1:8000/auth/callback
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
```

Run with Conda:

```powershell
conda env create -f environment.yml
conda activate twitch-task-overlay
Set-Location backend
python main.py
```

Or run with pip:

```powershell
Set-Location backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

The backend exposes `/api/token/refresh/{refresh_token}` for twitchtokengenerator.com tokens, plus the original Twitch `/auth/refresh` endpoint for apps that have their own `client_secret`.

Then open:

- `http://127.0.0.1:8000/docs` for API docs.
- `http://127.0.0.1:8000/auth/start` to start the local Twitch authorization flow.

## Command Overview

### Everyone

- `!task [description]` adds viewer tasklist items. Use commas for multiple tasks.
- `!edit [number] [description]` edits one viewer task.
- `!done [number]` completes viewer tasklist items. Use commas for multiple tasks.
- `!delete [number]` deletes viewer tasklist items. Use commas or `all`.
- `!focus [number]` focuses one viewer task.
- `!check` lists your current viewer tasks.
- `!tasklist-help` shows viewer tasklist examples.
- `!backlog-help` explains streamer backlog commands.
- `!pomo-help` explains Pomodoro commands.
- `!pomostatus` shows the current timer state.
- `!help` shows the legacy task help response.

### Broadcasters And Moderators

- `!backlog add [task]` adds backlog items. Use commas for multiple items.
- `!backlog edit [number] [description]` edits backlog items.
- `!backlog done [number]` completes backlog items. Use commas for multiple items.
- `!backlog remove [number]` removes backlog items. Use commas for multiple items.
- `!backlog clear` clears completed backlog items.
- `!backlog clear all` clears every backlog item.
- `!pomo [focus]/[break]/[sessions]` starts a Pomodoro cycle.
- `!pomopause` pauses the timer.
- `!pomoresume` resumes the timer.
- `!pomostop` or `!stoptimer` stops the timer.
- `!pomoreset` resets timer progress.
- `!theme [name]` changes the theme.
- `!layout [name]` changes the layout.
- `!resetpanel [panel] [layout]` resets a panel.
- `!resetlayout [name]` resets all saved panel positions for a layout.
- `!clearlist` clears all viewer tasklists.
- `!cleardone` clears completed viewer tasks.
- `!clearuser [username]` clears one user's tasklist.

## Keyboard Shortcuts

- `Ctrl + Shift + T` opens the theme menu.
- `Ctrl + Shift + L` opens the layout selector.
- `Escape` closes open overlay controls.

## Configuration

- `_auth.js` contains local Twitch credentials. It is ignored by git.
- `backend/.env` contains backend Twitch secrets. It is ignored by git.
- `_settings.js` controls language, task limits, header behavior, scroll speed, and test mode.
- `_styles.js` contains legacy style settings.
- `_configAdmin.js` and `_configUser.js` define legacy command aliases and responses.
- `_enhancedCommands.js` documents newer command groups.
- `themes.json` stores theme definitions.
- `src/classes/LayoutManager.js` stores layout presets.

## Development

```powershell
npm run dev
npm run build
npm test
npm run test:coverage
```

Backend tests:

```powershell
Set-Location backend
pytest
```

## Storage And Security Notes

- Viewer tasks, backlog items, timer state, panel positions, and theme/layout choices use browser localStorage.
- The storage migration layer updates older localStorage data shapes.
- Usernames and task descriptions are validated.
- Backlog rendering uses text escaping to reduce XSS risk.
- localStorage quota failures attempt cleanup before failing.
- Real tokens, secrets, SQLite databases, Vercel metadata, and local auth files should stay out of git.

## Project Docs

- [COMMANDS.md](./COMMANDS.md) is the extended command reference.
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) has a longer setup walkthrough.
- [OBS_SETUP.md](./OBS_SETUP.md) has OBS layout notes.
- [backend/README.md](./backend/README.md) documents the API server.
- [CHANGELOG.md](./CHANGELOG.md) tracks notable changes.

## License

MIT.

## Origin Credit

This project started as a fork of [Jujoco's Twitch Multitask Task List Overlay](https://github.com/jujoco/twitch-multitask-task-list-overlay). Credit goes to Jujoco and the original contributors for the foundation. This README describes the current direction and implementation of this repository.
