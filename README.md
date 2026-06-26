# Twitch Multitask Overlay

A Twitch chat productivity overlay for streamers who run focused work, study, coding, planning, or community task sessions.

The overlay gives the broadcaster a controlled main task list, a Pomodoro session timer, viewer backlogs, profile notes, themes, layouts, and draggable panels designed for OBS browser sources.

## What It Does

- Runs as a local OBS browser overlay.
- Connects to Twitch chat through `_auth.js`.
- Lets the broadcaster manage the visible stream task list.
- Lets viewers manage their own personal backlog.
- Provides Pomodoro focus sessions with pause, resume, reset, and status commands.
- Supports themes, preset layouts, draggable panels, and manual resizing.
- Saves timer state, panel positions, viewer backlog, and profile data locally.
- Includes an optional FastAPI backend for persistent storage and API-driven features.
- Ships with tests for task handling, chat handling, validation, storage, and security behavior.

## Current Feature Set

### Pomodoro Timer

- `!pomo` and `!pomodoro` start a default 25/5 cycle.
- Custom cycles support `!pomo 50/10` and `!pomo 25/5/6`.
- Sessions can be paused, resumed, reset, stopped, and queried.
- Timer state survives page refreshes.
- Focus and break transitions are announced in chat.

### Main Stream Task List

- The main task list is for the broadcaster workflow.
- Broadcaster task commands include add, edit, done, delete, focus, check, and clear.
- Viewer task management is routed to the backlog system instead of the main stream list.

### Viewer Backlog

- Each viewer gets a personal backlog.
- Viewers can add, complete, remove, and review their own backlog items.
- Broadcasters and moderators can clear completed backlog items or clear all backlog data.

### Viewer Info Profiles

- Viewers can save custom profile fields with `!setinfo`.
- Viewers can read profile fields with `!getinfo`.
- Useful fields include timezone, current goal, preferred language, and active project.

### Themes And Layouts

- Themes are loaded from `themes.json`.
- Layout presets include `compact`, `split`, `fullOverlay`, `minimal`, `timerWithTasks`, and `dashboard`.
- Panels can be dragged into custom positions.
- `Alt + G` opens the grid and resize handles.
- Panel positions and sizes persist per layout.

### Security, Quality, And Infrastructure

Recent project work added:

- XSS hardening for backlog rendering.
- User and task input validation.
- localStorage quota handling and cleanup.
- Versioned localStorage migration.
- Centralized constants and error handling.
- Accessibility improvements.
- CSS-based animation improvements.
- Conda environment support for the Python backend.
- A broader automated test suite.

See [CHANGELOG.md](./CHANGELOG.md) for the detailed feature log.

## Quick Start

### 1. Install Dependencies

```powershell
npm install
```

### 2. Configure Twitch Auth

Copy the example auth file:

```powershell
Copy-Item _auth.js.example _auth.js
```

Edit `_auth.js`:

```js
const _authConfig = {
  twitch_oauth: "oauth:your_oauth_token_here",
  twitch_username: "your_bot_username",
  twitch_channel: "your_channel_name",
};
```

The token needs Twitch chat read and chat send permissions.

### 3. Build The Overlay

```powershell
npm run build
```

### 4. Add It To OBS

1. Add a new Browser Source.
2. Enable Local File.
3. Select `index.html` from this project.
4. Use `1920x1080` for a full overlay or a narrower width for a side panel.
5. Enable browser refresh when the scene becomes active.

Detailed OBS notes are in [OBS_SETUP.md](./OBS_SETUP.md).

## Optional Backend

The overlay works without the backend.

Use the backend when you want SQLite-backed persistence, API access, viewer statistics, or server-side backlog/profile storage.

### Conda

```powershell
conda env create -f environment.yml
conda activate twitch-task-overlay
Set-Location backend
python main.py
```

### pip

```powershell
Set-Location backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

The backend runs at `http://localhost:8000`.

API docs are available at `http://localhost:8000/docs`.

## Command Overview

Full command documentation is in [COMMANDS.md](./COMMANDS.md).

### Everyone

- `!backlog add [task]` adds a personal backlog item.
- `!backlog done [number]` completes a backlog item.
- `!backlog remove [number]` removes a backlog item.
- `!setinfo [field] [value]` saves a profile field.
- `!getinfo [username]` reads profile info.
- `!pomostatus` shows timer status.
- `!help` shows command help.

### Broadcaster

- `!task [description]` adds a stream task.
- `!edit [number] [description]` edits a stream task.
- `!done [number]` completes a stream task.
- `!delete [number]` deletes a stream task.
- `!focus [number]` focuses a stream task.
- `!clearlist` clears all stream tasks.
- `!cleardone` clears completed stream tasks.

### Broadcaster And Moderators

- `!pomo [focus]/[break]/[sessions]` starts a Pomodoro cycle.
- `!pomopause` pauses the timer.
- `!pomoresume` resumes the timer.
- `!pomostop` or `!stoptimer` stops the timer.
- `!pomoreset` resets timer progress.
- `!theme [name]` changes the active theme.
- `!layout [name]` changes the active layout.
- `!resetpanel [panel] [layout]` resets a panel position.
- `!resetlayout [name]` resets a layout.
- `!backlog clear` clears completed backlog items.
- `!backlog clear all` clears every backlog item.

## Keyboard Shortcuts

- `Alt + G` toggles the grid and panel resize handles.
- `Alt + T` opens the theme menu.
- `Alt + L` opens the layout menu.
- `Escape` closes menus and hides the grid.

## Configuration Files

- `_auth.js` stores Twitch credentials. Do not commit real tokens.
- `_settings.js` controls behavior such as language, task limits, scrolling, and test mode.
- `_styles.js` controls legacy visual defaults.
- `_configAdmin.js` and `_configUser.js` define command permissions and aliases.
- `_enhancedCommands.js` defines the newer command groups.
- `themes.json` stores theme definitions.
- `src/classes/LayoutManager.js` stores layout presets.

## Development

```powershell
npm run dev
npm run build
npm test
npm run test:coverage
```

The project requires Node.js 20 or newer.

## Project Docs

- [COMMANDS.md](./COMMANDS.md) has the complete chat command reference.
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) has a longer setup walkthrough.
- [OBS_SETUP.md](./OBS_SETUP.md) has OBS-specific setup notes.
- [backend/README.md](./backend/README.md) documents the optional API server.
- [CHANGELOG.md](./CHANGELOG.md) tracks notable changes.

## License

MIT.

## Acknowledgement

This project builds on the initial work from [Jujoco's Twitch Multitask Task List Overlay](https://github.com/jujoco/twitch-multitask-task-list-overlay). Credit and thanks go to Jujoco and the contributors of that project for the foundation.
