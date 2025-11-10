# 🎮 Twitch Overlay Chat Commands

Complete list of all available chat commands for the interactive task list overlay.

---

## 🎨 Theme & Layout Commands (Mod Only)

### Theme Commands

**`!theme [name]`** - Change the overlay theme

- `!theme` - List all available themes
- `!theme cyberpunk` - Switch to a specific theme
- Available themes are loaded from `themes.json`

### Layout Commands

**`!layout [name]`** - Change the overlay layout preset

- `!layout` - List all available layouts with descriptions
- `!layout compact` - Switch to compact layout
- `!layout dashboard` - Switch to full dashboard layout

**Available Layouts:**

- `compact` - Timer and tasks side-by-side
- `split` - Timer left, tasks center, backlog right
- `fullOverlay` - Balanced dashboard with all panels
- `minimal` - Single timer focus
- `timerWithTasks` - Timer stacked above tasks
- `dashboard` - Comprehensive work/study layout

### Panel Position Commands

**`!resetpanel [panel] [layout]`** - Reset a panel to its default position

- `!resetpanel timer` - Reset timer in current layout
- `!resetpanel tasklist dashboard` - Reset task list in dashboard layout
- Valid panels: `timer`, `tasklist`, `backlog`, `infopanel`

**`!resetlayout [name]`** - Reset all panel positions in a layout

- `!resetlayout` - Reset current layout
- `!resetlayout dashboard` - Reset specific layout

---

## ⏱️ Pomodoro Timer Commands (Mod Only)

### Start/Control Timer

**`!pomo [focus]/[break]/[sessions]`** or **`!pomodoro`** - Start a Pomodoro cycle

- `!pomo` - Default: 25min focus / 5min break × 4 sessions
- `!pomo 50/10` - Custom: 50min focus / 10min break × 4 sessions
- `!pomo 25/5/6` - Full custom: 25min focus / 5min break × 6 sessions
- Max 12 sessions per cycle
- Auto-transitions: Focus → Short Break → Focus → ... → Long Break (every 4 sessions)

**`!pomostop`** or **`!stoptimer`** - Stop the timer completely

- Stops the current session and resets progress

**`!pomoreset`** - Reset the timer and clear all session progress

- Clears session counter back to 0

**`!pomopause`** - Pause the current timer

- Maintains current time and session progress
- State is saved and persists across refreshes

**`!pomoresume`** - Resume a paused timer

- Continues from where it was paused

**`!pomostatus`** - Get current timer status

- Shows: Running/Paused/Stopped, mode (focus/break), time remaining, current session

**Features:**

- ✅ Session tracking (e.g., Session 2/4)
- ✅ Auto-progression through focus → break → focus cycles
- ✅ Long breaks every 4 sessions (15 min default)
- ✅ State persistence (survives page refresh)
- ✅ Chat announcements for session completions

---

## 📋 Task Backlog Commands (Everyone)

**Purpose:** Personal to-do list for viewers. Each viewer manages their own backlog items.

**`!backlog add [task]`** - Add item to your personal backlog

- `!backlog add Learn React hooks`
- `!backlog add Fix bug in project`

**`!backlog done [number]`** - Mark a backlog item as complete

- `!backlog done 1` - Mark item #1 as done
- Items stay visible but show as completed

**`!backlog remove [number]`** - Remove a backlog item

- `!backlog remove 2` - Delete item #2 from backlog

**`!backlog clear`** (Mod Only) - Clear all completed backlog items

- Removes all items marked as done

**`!backlog`** - Show usage help

---

## 👥 Viewer Info Commands (Everyone)

**Purpose:** Custom profile information that viewers can set and share.

**`!setinfo [field] [value]`** - Set your profile field

- `!setinfo goal Graduate in 2025`
- `!setinfo timezone EST`
- `!setinfo language Python`
- `!setinfo project Building a game`
- Any custom fields allowed

**`!getinfo [username]`** - Get viewer profile info

- `!getinfo` - View your own info
- `!getinfo username` - View someone else's info
- Shows all fields they've set

---

## 📝 Task List Commands (Broadcaster Only)

**Purpose:** Main task list visible to everyone - **BROADCASTER USE ONLY**. Viewers should use `!backlog` commands instead.

**`!task [description]`** - Add a new task (Broadcaster Only)

- `!task Complete homework`
- Viewers will be redirected to use `!backlog add` instead

**`!edit [task#] [new description]`** - Edit a task (Broadcaster Only)

- `!edit 1 Finish homework by 5pm`

**`!done [task#]`** - Mark task as complete

- `!done 1`

**`!delete [task#]`** - Delete a task

- `!delete 2`

**`!check`** - Check your current tasks

**`!help`** - Show command help

---

**Note:** If you're a viewer and want to manage your own tasks, use the **!backlog** commands above! The main task list is for the broadcaster's workflow.

---

## ⌨️ Keyboard Shortcuts (Streamer Only)

**`Alt + G`** - Toggle grid overlay with resize handles

- Shows a visual grid over the entire interface
- Adds 8 resize handles to each panel (4 corners + 4 edges)
- Drag any handle to resize panels manually in all directions
- Panel sizes auto-save per layout
- Press `Alt + G` again or `Escape` to hide

**`Alt + L`** - Open layout selector menu (draggable)
**`Alt + T`** - Open theme menu (draggable)
**`Escape`** - Close any open menus or hide grid overlay

---

## 🎯 Key Features

### Draggable & Resizable Panels

- **All panels are draggable!** Click and drag any panel to reposition
- **Manual resizing:** Press `Alt + G` to show resize handles, then drag to resize in any direction
- 8-directional resizing: corners (diagonal) and edges (horizontal/vertical)
- Positions and sizes auto-save per layout
- Works on timer, task list, backlog, and info panels

### Session Persistence

- Timer state saves automatically
- Backlog items persist across sessions
- Viewer info stored locally
- Panel positions remembered per layout

### Visual Feedback

- Real-time timer progress ring
- Session counter display
- Completion animations
- Mode indicators (focus/break)

---

## 📊 Examples

```text
# Start a study session
!pomo 50/10/4

# Add personal tasks
!backlog add Review calculus notes
!backlog add Prepare presentation slides
!backlog done 1

# Set your profile
!setinfo timezone PST
!setinfo goal Learn web development
!getinfo

# Change the vibe
!theme cyberpunk
!layout dashboard

# Pause for a moment
!pomopause
!pomostatus
!pomoresume
```

---

## 🔒 Permissions

- **Everyone:** task, backlog, setinfo, getinfo, pomostatus commands
- **Mods/Broadcaster:** All timer commands, layout, theme, clear, resetpanel, resetlayout

---

**Last Updated:** 2025
**For Issues:** Check the GitHub repository
