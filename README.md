# Twitch Multitask Overlay

A Twitch chat productivity overlay for streamers who run focused work, study, coding, planning, or community task sessions.

The overlay gives viewers a task list, the broadcaster a stream backlog, a Pomodoro session timer, profile notes, themes, layouts, and draggable panels designed for OBS browser sources.

## What It Does

- Runs as a local OBS browser overlay.
- Connects to Twitch chat through `_auth.js`.
- Lets viewers manage their own tasklist.
- Lets the broadcaster and moderators manage the stream backlog.
- Provides Pomodoro focus sessions with pause, resume, reset, and status commands.
- Supports themes, preset layouts, draggable panels, and manual resizing.
- Saves timer state, panel positions, stream backlog, viewer tasklists, and profile data locally.
- Includes an optional FastAPI backend for persistent storage and API-driven features.
- Ships with tests for task handling, chat handling, validation, storage, and security behavior.

## Current Feature Set

### Pomodoro Timer

- `!pomo` and `!pomodoro` start a default 25/5 cycle.
- Custom cycles support `!pomo 50/10` and `!pomo 25/5/6`.
- Sessions can be paused, resumed, reset, stopped, and queried.
- Timer state survives page refreshes.
- Focus and break transitions are announced in chat.

### Viewer Task List

- Viewers can manage their own tasklist.
- Viewer task commands include add, edit, done, delete, focus, and check.
- Comma-separated add, done, and delete commands are supported.

### Stream Backlog

- The backlog is for broadcaster/mod stream planning.
- Broadcasters and moderators can add, edit, complete, remove, and clear backlog items.
- Comma-separated add, edit, done, and remove commands are supported.

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
  twitch_refresh_token: "your_refresh_token_here",
  client_id: "your_twitch_app_client_id",
  twitch_auth_refresh_url: "http://127.0.0.1:8000/auth/refresh",
  twitch_username: "your_bot_username",
  twitch_channel: "your_channel_name",
};
```

Create a Twitch application at https://dev.twitch.tv/console and use its Client ID here. Set the Client Secret only on the backend host. For local OBS use, create `backend/.env`:

```txt
TWITCH_CLIENT_ID=your_twitch_app_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=http://localhost:8000/auth/callback
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
```

Use an access token and refresh token with `chat:read` and `chat:edit` scopes. The official open-source Twitch CLI can help generate or refresh tokens locally with `twitch token`; see https://github.com/twitchdev/twitch-cli. When Twitch expires the access token, the static OBS browser source calls `twitch_auth_refresh_url` and saves the rotated token in OBS/browser storage.

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

The overlay works without the backend, but automatic token refresh does not. A static OBS browser source cannot safely hold your Twitch Client Secret and cannot rewrite `_auth.js`.

Use the backend when you want automatic Twitch token refresh, SQLite-backed persistence, API access, viewer statistics, or server-side backlog/profile storage.

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

The backend runs at `http://127.0.0.1:8000` by default.

API docs are available at `http://localhost:8000/docs`.

## Command Overview

Full command documentation is in [COMMANDS.md](./COMMANDS.md).

### Everyone

- `!task [description]` adds a viewer task. Use commas for multiple tasks.
- `!edit [number] [description]` edits a viewer task.
- `!done [number]` completes a viewer task. Use commas for multiple tasks.
- `!delete [number]` deletes a viewer task. Use commas for multiple tasks.
- `!focus [number]` focuses a viewer task.
- `!check` shows your viewer tasklist.
- `!tasklist-help` shows viewer tasklist commands with examples.
- `!setinfo [field] [value]` saves a profile field.
- `!getinfo [username]` reads profile info.
- `!backlog-help` shows broadcaster backlog commands with examples.
- `!pomo-help` shows Pomodoro commands with examples.
- `!pomostatus` shows timer status.
- `!help` shows command help.

### Broadcaster

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
- `!backlog add [task]` adds broadcaster backlog items. Use commas for multiple items.
- `!backlog edit [number] [description]` edits backlog items. Use comma-separated `number description` chunks for multiple edits.
- `!backlog done [number]` completes backlog items. Use commas for multiple items.
- `!backlog remove [number]` removes backlog items. Use commas for multiple items.
- `!backlog clear` clears completed backlog items.
- `!backlog clear all` clears every backlog item.

## Keyboard Shortcuts

- `Alt + G` toggles the grid and panel resize handles.
- `Alt + T` opens the theme menu.
- `Alt + L` opens the layout menu.
- `Escape` closes menus and hides the grid.

## Configuration Files

- `_auth.js` stores Twitch credentials. Do not commit real tokens.
- The backend reads `TWITCH_CLIENT_SECRET` to refresh Twitch tokens without exposing the client secret in the browser.
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
