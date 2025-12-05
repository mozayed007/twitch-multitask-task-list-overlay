import App from "./app.js";
import { closeModal, openModal } from "./modal.js";
import TwitchChat from "./twitch/TwitchChat.js";
import { loadTestUsers } from "./twitch/loadTestUsers.js";
import ThemeManager from "./classes/ThemeManager.js";
import CircularTimer from "./classes/CircularTimer.js";
import BacklogPanel from "./classes/BacklogPanel.js";
import InfoPanel from "./classes/InfoPanel.js";
import LayoutManager from "./classes/LayoutManager.js";

const {
	twitch_channel, twitch_oauth, twitch_username
} = _authConfig;

const twitchIRC = "wss://irc-ws.chat.twitch.tv:443";
const client = new TwitchChat(twitchIRC, {
	username: twitch_username,
	authToken: twitch_oauth,
	channel: twitch_channel,
});

// Global instances
let app;
let themeManager;
let circularTimer;
let backlogPanel;
let infoPanel;
let layoutManager;

/** @type {Map<string, () => void>} */
const panelDragCleanups = new Map();
const panelHandleSelectors = {
	timer: '.circular-timer',
	taskList: '.header',
	backlog: '.backlog-header',
	infoPanel: '.info-header'
};

window.addEventListener("load", () => {
	let storeName = "userList";
	if (_settings.testMode) {
		console.log("Test mode enabled");
		storeName = "testUserList";
	}

	// Initialize core app
	app = new App(storeName);
	app.render();

	// Initialize new components
	themeManager = new ThemeManager();
	circularTimer = new CircularTimer('timer-container');
	backlogPanel = new BacklogPanel('backlog-container');
	infoPanel = new InfoPanel('info-panel-container');
	layoutManager = new LayoutManager('app');
	setupPanelDraggables();

	// Setup theme switcher UI
	setupThemeSwitcher();

	// Setup keyboard shortcuts
	setupKeyboardShortcuts();

	// Handle chat commands
	client.on("command", (data) => {
		const { user, command, message, flags, extra } = data;

		// Try enhanced commands first
		const enhancedResponse = handleEnhancedCommands(user, command, message, flags, extra);
		if (enhancedResponse) {
			if (!enhancedResponse.error) {
				client.say(enhancedResponse.message, extra.messageId);
			} else {
				console.error(enhancedResponse.message);
			}
			return;
		}

		// Fall back to original app commands
		const response = app.chatHandler(user, command, message, flags, extra);
		if (!response.error) {
			client.say(response.message, extra.messageId);

			// Update viewer activity in info panel
			const taskCount = app.userList.getUser(user)?.getTasks().length || 0;
			infoPanel.updateViewerActivity(user, taskCount);
		} else {
			console.error(response.message);
		}
	});

	client.on("oauthError", () => {
		openModal();
	});

	client.on("oauthSuccess", () => {
		closeModal();
	});

	client.connect();
	if (_settings.testMode) loadTestUsers(client);
});

/**
 * Handle enhanced commands for new features
 * @param {string} username - Username
 * @param {string} command - Command
 * @param {string} message - Message content
 * @param {Object} flags - User flags
 * @param {Object} extra - Extra data
 * @returns {Object|null} Response or null if not handled
 */
function handleEnhancedCommands(username, command, message, flags, extra) {
	const cmd = `!${command.toLowerCase()}`;
	const isMod = flags.broadcaster || flags.mod;
	const prefix = _settings.botResponsePrefix;
	const rawMessage = (message || '').trim();
	const resolveLayoutKey = (input) => {
		if (!input) return null;
		const normalized = input.toLowerCase();
		const slug = normalized.replace(/[^a-z0-9]/g, '');
		const layouts = layoutManager.getAvailableLayouts();
		for (const layout of layouts) {
			const keyLower = layout.name.toLowerCase();
			const keySlug = keyLower.replace(/[^a-z0-9]/g, '');
			const displayLower = layout.displayName.toLowerCase();
			const displaySlug = displayLower.replace(/[^a-z0-9]/g, '');
			if (
				keyLower === normalized ||
				keySlug === slug ||
				displayLower === normalized ||
				displaySlug === slug
			) {
				return layout.name;
			}
		}
		return null;
	};

	// Theme commands (mod only)
	if (cmd === '!theme') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can change themes.`,
				error: true
			};
		}
		if (!rawMessage) {
			const themes = themeManager.getAvailableThemes()
				.map(t => t.name)
				.join(', ');
			return {
				message: `${prefix}Available themes: ${themes}. Use !theme [name] to switch.`,
				error: false
			};
		}
		const themeKey = rawMessage.toLowerCase();
		const success = themeManager.applyTheme(themeKey);
		return {
			message: success
				? `${prefix}Theme changed to ${rawMessage}! 🎨`
				: `${prefix}Theme "${rawMessage}" not found.`,
			error: !success
		};
	}

	// Layout commands (mod only)
	if (cmd === '!layout') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can change layouts.`,
				error: true
			};
		}
		if (!rawMessage) {
			const layouts = layoutManager.getAvailableLayouts()
				.map(l => `${l.name} (${l.description})`)
				.join(', ');
			return {
				message: `${prefix}Available layouts: ${layouts}. Use !layout [name] to switch.`,
				error: false
			};
		}
		const layoutKey = resolveLayoutKey(rawMessage);
		if (!layoutKey) {
			return {
				message: `${prefix}Layout "${rawMessage}" not found.`,
				error: true
			};
		}
		const success = layoutManager.applyLayout(layoutKey);
		const layoutMeta = layoutManager.getAvailableLayouts().find(l => l.name === layoutKey);
		return {
			message: success
				? `${prefix}Layout changed to ${layoutMeta?.displayName || layoutKey}! 📐`
				: `${prefix}Layout "${rawMessage}" not found.`,
			error: !success
		};
	}

	if (cmd === '!resetpanel') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can reset panel positions.`,
				error: true
			};
		}
		if (!rawMessage) {
			return {
				message: `${prefix}Usage: !resetpanel [timer|tasklist|backlog|infopanel] (optional layout)`,
				error: false
			};
		}
		const [panelInput, layoutInput] = rawMessage.split(/\s+/);
		const panelKey = panelInput?.toLowerCase();
		const validPanels = ['timer', 'tasklist', 'backlog', 'infopanel'];
		if (!panelKey || !validPanels.includes(panelKey)) {
			return {
				message: `${prefix}Panel must be one of: timer, tasklist, backlog, infopanel.`,
				error: true
			};
		}
		const normalizedPanel = panelKey === 'tasklist' ? 'taskList' : panelKey === 'infopanel' ? 'infoPanel' : panelKey;
		const layoutTargetKey = layoutInput ? resolveLayoutKey(layoutInput) : layoutManager.getCurrentLayout();
		if (!layoutTargetKey) {
			return {
				message: `${prefix}Layout "${layoutInput}" not found.`,
				error: true
			};
		}
		const layoutMeta = layoutManager.getAvailableLayouts().find(l => l.name === layoutTargetKey);
		const layoutLabel = layoutMeta?.displayName || layoutTargetKey;
		const reset = layoutManager.resetPanelPosition(normalizedPanel, layoutTargetKey);
		return {
			message: reset
				? `${prefix}Reset ${panelKey} panel position for ${layoutLabel}.`
				: `${prefix}No custom position stored for ${panelKey} in ${layoutLabel}.`,
			error: !reset
		};
	}

	if (cmd === '!resetlayout') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can reset layouts.`,
				error: true
			};
		}
		const layoutKey = rawMessage ? resolveLayoutKey(rawMessage) : layoutManager.getCurrentLayout();
		if (!layoutKey) {
			return {
				message: `${prefix}Layout "${rawMessage}" not found.`,
				error: true
			};
		}
		const layoutMeta = layoutManager.getAvailableLayouts().find(l => l.name === layoutKey);
		const layoutLabel = layoutMeta?.displayName || layoutKey;
		const reset = layoutManager.resetLayoutPositions(layoutKey);
		return {
			message: reset
				? `${prefix}Reset all panel positions for ${layoutLabel}.`
				: `${prefix}No custom positions stored for ${layoutLabel}.`,
			error: !reset
		};
	}

	// Backlog commands
	if (cmd === '!backlog') {
		const parts = rawMessage.length ? rawMessage.split(/\s+/) : [];
		const action = parts[0]?.toLowerCase();
		const content = parts.slice(1).join(' ');

		if (!action) {
			return {
				message: `${prefix}@${username} Usage: !backlog add/done/remove [text/number]`,
				error: false
			};
		}

		if (action === 'add') {
			if (!content) {
				return {
					message: `${prefix}@${username} Provide a task description to add.`,
					error: true
				};
			}
			const item = backlogPanel.addItem(content);
			return {
				message: item
					? `${prefix}@${username} Added "${content}" to backlog! 📋`
					: `${prefix}@${username} Backlog is full!`,
				error: !item
			};
		}

		if (action === 'done' || action === 'remove') {
			const index = parseInt(content, 10);
			if (!content || Number.isNaN(index) || index < 1) {
				return {
					message: `${prefix}@${username} Provide a valid backlog item number.`,
					error: true
				};
			}
			const item = backlogPanel.getItemByIndex(index);
			if (!item) {
				return {
					message: `${prefix}@${username} Backlog item ${index} not found.`,
					error: true
				};
			}
			if (action === 'done') {
				backlogPanel.toggleComplete(item.id);
				return {
					message: `${prefix}@${username} Marked backlog item ${index} as done! ✅`,
					error: false
				};
			}
			backlogPanel.removeItem(item.id);
			return {
				message: `${prefix}@${username} Removed backlog item ${index}! 🗑️`,
				error: false
			};
		}

		if (action === 'clear') {
			if (!isMod) {
				return {
					message: `${prefix}@${username} Only moderators can clear the backlog.`,
					error: true
				};
			}
			const count = backlogPanel.clearCompleted();
			return {
				message: `${prefix}Cleared ${count} completed backlog item${count !== 1 ? 's' : ''}!`,
				error: false
			};
		}

		return {
			message: `${prefix}@${username} Usage: !backlog add/done/remove [text/number]`,
			error: false
		};
	}

	// Viewer info commands
	if (cmd === '!setinfo') {
		const parts = rawMessage.split(/\s+/);
		if (parts.length < 2) {
			return {
				message: `${prefix}@${username} Usage: !setinfo [field] [value] (e.g., !setinfo goal Graduate)`,
				error: false
			};
		}
		const field = parts[0];
		const value = rawMessage.slice(field.length).trim();
		if (!value) {
			return {
				message: `${prefix}@${username} Provide a value for ${field}.`,
				error: true
			};
		}
		infoPanel.setViewerInfo(username, field, value);
		return {
			message: `${prefix}@${username} Set ${field} to "${value}"! 📝`,
			error: false
		};
	}

	if (cmd === '!getinfo') {
		const targetUser = rawMessage || username;
		const viewerData = infoPanel.getViewerInfo(targetUser);
		if (!viewerData || Object.keys(viewerData.info).length === 0) {
			return {
				message: `${prefix}@${username} No info found for ${targetUser}.`,
				error: false
			};
		}
		const infoStr = Object.entries(viewerData.info)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
		return {
			message: `${prefix}@${username} ${targetUser}'s info: ${infoStr}`,
			error: false
		};
	}

	// Check specific subcommands first before the generic !pomo command
	if (cmd === '!pomopause') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can control the timer.`,
				error: true
			};
		}
		circularTimer.pause();
		return {
			message: `${prefix}Timer paused! ⏸️`,
			error: false
		};
	}

	if (cmd === '!pomoresume') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can control the timer.`,
				error: true
			};
		}
		circularTimer.resume();
		return {
			message: `${prefix}Timer resumed! ▶️`,
			error: false
		};
	}

	if (cmd === '!pomostop' || cmd === '!stoptimer') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can control the timer.`,
				error: true
			};
		}
		circularTimer.stop();
		return {
			message: `${prefix}Timer stopped! ⏹️`,
			error: false
		};
	}

	if (cmd === '!pomoreset') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can control the timer.`,
				error: true
			};
		}
		circularTimer.reset();
		return {
			message: `${prefix}Timer reset! All sessions cleared. 🔄`,
			error: false
		};
	}

	if (cmd === '!pomostatus') {
		const state = circularTimer.getState();
		const mins = Math.floor(state.currentSeconds / 60);
		const secs = state.currentSeconds % 60;
		const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
		const statusStr = state.isRunning ? 'Running' : state.isPaused ? 'Paused' : 'Stopped';
		return {
			message: `${prefix}Timer: ${statusStr} | ${state.mode} mode | ${timeStr} | Session ${state.currentSession}/${state.totalSessions} 📊`,
			error: false
		};
	}

	// Pomodoro timer commands (mod only)
	if (cmd === '!pomo' || cmd === '!pomodoro') {
		if (!isMod) {
			return {
				message: `${prefix}@${username} Only moderators can control the timer.`,
				error: true
			};
		}
		// Parse: !pomo 25/5/4 = 25min focus, 5min break, 4 sessions
		const parts = rawMessage.split('/');
		const focusTime = Math.max(1, parseInt(parts[0], 10) || 25);
		const breakTime = Math.max(1, parseInt(parts[1], 10) || 5);
		const sessions = Math.max(1, Math.min(12, parseInt(parts[2], 10) || 4));

		circularTimer.startCycle(focusTime, breakTime, sessions, (mode, current, total) => {
			if (mode === 'focus') {
				client.say(`${prefix}Focus session ${current} complete! Time for a break ☕`);
			} else if (mode === 'break' || mode === 'longbreak') {
				client.say(`${prefix}Break over! Starting session ${current + 1}/${total} 💪`);
			} else if (mode === 'cycle_complete') {
				client.say(`${prefix}Pomodoro cycle complete! ${total} sessions done! 🎉`);
			}
		});

		return {
			message: `${prefix}Pomodoro started: ${focusTime}m focus / ${breakTime}m break × ${sessions} sessions ⏱️`,
			error: false
		};
	}

	// Return null if command not handled
	return null;
}

/**
 * Make an element draggable
 * @param {HTMLElement} element - Element to make draggable
 * @param {HTMLElement|null} [handle] - Optional drag handle (defaults to element itself)
 * @param {{
 * 	strategy?: 'transform'|'absolute',
 * 	bounds?: HTMLElement|string|null,
 * 	onDragStart?: () => void,
 * 	onDragEnd?: (position: {left: number, top: number}) => void
 * }} [options]
 */
function makeDraggable(element, handle, options = {}) {
	const {
		strategy = 'transform',
		bounds = null,
		onDragStart,
		onDragEnd
	} = options;

	const dragHandle = handle || element;
	let isDragging = false;
	let currentX = 0;
	let currentY = 0;
	let initialX = 0;
	let initialY = 0;
	let offsetX = 0;
	let offsetY = 0;
	let pointerOffsetX = 0;
	let pointerOffsetY = 0;
	let lastPosition = { left: element.offsetLeft || 0, top: element.offsetTop || 0 };

	const boundsEl = typeof bounds === 'string'
		? document.querySelector(bounds)
		: bounds;

	dragHandle.style.cursor = 'move';

	const dragStart = (e) => {
		if (e.button !== 0) return; // Only respond to primary button
		if (e.target instanceof HTMLButtonElement || e.target.closest('button')) {
			return;
		}

		isDragging = true;
		element.classList.add('dragging');
		document.body.classList.add('overlay-dragging');

		if (strategy === 'absolute') {
			const elementRect = element.getBoundingClientRect();
			const containerRect = boundsEl
				? boundsEl.getBoundingClientRect()
				: { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

			pointerOffsetX = e.clientX - elementRect.left;
			pointerOffsetY = e.clientY - elementRect.top;
			offsetX = elementRect.left - containerRect.left;
			offsetY = elementRect.top - containerRect.top;
			lastPosition = { left: offsetX, top: offsetY };
		} else {
			const style = window.getComputedStyle(element);
			const matrix = new DOMMatrix(style.transform);
			offsetX = matrix.m41;
			offsetY = matrix.m42;
			initialX = e.clientX - offsetX;
			initialY = e.clientY - offsetY;
		}

		onDragStart?.();
	};

	const drag = (e) => {
		if (!isDragging) return;
		e.preventDefault();

		if (strategy === 'absolute') {
			const containerRect = boundsEl
				? boundsEl.getBoundingClientRect()
				: { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
			const elementRect = element.getBoundingClientRect();

			let newLeft = e.clientX - containerRect.left - pointerOffsetX;
			let newTop = e.clientY - containerRect.top - pointerOffsetY;

			const maxLeft = Math.max(0, containerRect.width - elementRect.width);
			const maxTop = Math.max(0, containerRect.height - elementRect.height);

			newLeft = Math.max(0, Math.min(maxLeft, newLeft));
			newTop = Math.max(0, Math.min(maxTop, newTop));

			element.style.left = `${Math.round(newLeft)}px`;
			element.style.top = `${Math.round(newTop)}px`;
			lastPosition = { left: newLeft, top: newTop };
		} else {
			currentX = e.clientX - initialX;
			currentY = e.clientY - initialY;

			offsetX = currentX;
			offsetY = currentY;

			element.style.transform = `translate(${currentX}px, ${currentY}px)`;
		}
	};

	const dragEnd = () => {
		if (!isDragging) return;
		isDragging = false;
		element.classList.remove('dragging');
		document.body.classList.remove('overlay-dragging');

		if (strategy !== 'absolute') {
			initialX = currentX;
			initialY = currentY;
		}

		onDragEnd?.({ left: Math.round(lastPosition.left), top: Math.round(lastPosition.top) });
	};

	dragHandle.addEventListener('mousedown', dragStart);
	document.addEventListener('mousemove', drag);
	document.addEventListener('mouseup', dragEnd);

	return () => {
		dragHandle.removeEventListener('mousedown', dragStart);
		document.removeEventListener('mousemove', drag);
		document.removeEventListener('mouseup', dragEnd);
		element.classList.remove('dragging');
		document.body.classList.remove('overlay-dragging');
	};
}

/**
 * Initialize draggable behaviour for overlay panels
 */
function setupPanelDraggables() {
	if (!layoutManager) return;
	const container = document.getElementById('app');
	if (!container) return;

	const activePanels = new Set();
	container.querySelectorAll('.draggable-panel').forEach(panel => {
		const panelEl = /** @type {HTMLElement} */ (panel);
		const panelKey = panelEl.dataset.panel;
		if (!panelKey) return;
		activePanels.add(panelKey);

		// Clean up existing handler before reapplying
		if (panelDragCleanups.has(panelKey)) {
			panelDragCleanups.get(panelKey)?.();
			panelDragCleanups.delete(panelKey);
		}

		// Skip hidden panels
		if (getComputedStyle(panelEl).display === 'none') {
			return;
		}

		const handleSelector = panelHandleSelectors[panelKey];
		const handleEl = handleSelector
			? /** @type {HTMLElement|null} */ (panelEl.querySelector(handleSelector))
			: null;
		const cleanup = makeDraggable(panelEl, handleEl || panelEl, {
			strategy: 'absolute',
			bounds: container,
			onDragEnd: (position) => {
				layoutManager.savePanelPosition(layoutManager.getCurrentLayout(), panelKey, position);
			}
		});

		panelDragCleanups.set(panelKey, cleanup);
	});

	// Remove drag handlers for panels that no longer exist
	const stalePanels = [];
	panelDragCleanups.forEach((cleanup, panelKey) => {
		if (!activePanels.has(panelKey)) {
			cleanup();
			stalePanels.push(panelKey);
		}
	});
	stalePanels.forEach(key => panelDragCleanups.delete(key));
}

window.addEventListener('layoutChanged', () => setupPanelDraggables());

/**
 * Setup theme switcher UI
 */
function setupThemeSwitcher() {
	const toggleBtn = document.getElementById('theme-toggle');
	if (!toggleBtn) return;

	let menuOpen = false;
	let menuEl = null;

	toggleBtn.addEventListener('click', () => {
		if (menuOpen && menuEl) {
			menuEl.remove();
			menuEl = null;
			menuOpen = false;
		} else {
			menuEl = createThemeMenu();
			document.body.appendChild(menuEl);
			makeDraggable(menuEl);
			menuOpen = true;
		}
	});

	// Close menu when clicking outside
	document.addEventListener('click', (e) => {
		const target = /** @type {Node} */ (e.target);
		if (menuOpen && menuEl && !toggleBtn.contains(target) && !menuEl.contains(target)) {
			menuEl.remove();
			menuEl = null;
			menuOpen = false;
		}
	});
}

/**
 * Create theme menu
 * @returns {HTMLElement}
 */
function createThemeMenu() {
	const menu = document.createElement('div');
	menu.className = 'theme-menu';

	const currentTheme = themeManager.getCurrentTheme();
	const themes = themeManager.getAvailableThemes();

	menu.innerHTML = `
		<div class="theme-menu-header" title="Drag to move">
			<span>🎨 Themes</span>
			<span class="drag-hint">⋮⋮</span>
		</div>
		<div class="theme-list">
			${themes.map(theme => `
				<button 
					class="theme-item ${theme.name === currentTheme ? 'active' : ''}"
					data-theme="${theme.name}"
				>
					${theme.displayName}
				</button>
			`).join('')}
		</div>
	`;

	// Add click handlers
	menu.querySelectorAll('.theme-item').forEach(btn => {
		btn.addEventListener('click', () => {
			const themeName = btn.getAttribute('data-theme');
			themeManager.applyTheme(themeName);

			// Update active state
			menu.querySelectorAll('.theme-item').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
		});
	});

	return menu;
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
	document.addEventListener('keydown', (e) => {
		// Ctrl/Cmd + Shift + L = Show layout selector
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
			e.preventDefault();
			showLayoutSelector();
		}

		// Ctrl/Cmd + Shift + T = Show theme menu
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
			e.preventDefault();
			document.getElementById('theme-toggle')?.click();
		}
	});
}

/**
 * Show layout selector overlay
 */
function showLayoutSelector() {
	// Remove existing selector if any
	const existing = document.querySelector('.layout-selector');
	if (existing) {
		existing.remove();
		return;
	}

	const selector = layoutManager.createLayoutSelector();
	document.body.appendChild(selector);

	// Make the selector draggable by its header
	const header = selector.querySelector('.layout-selector-header');
	if (header) {
		makeDraggable(selector, header);
	}
}

// Export for debugging
if (typeof window !== 'undefined') {
	// @ts-ignore - Adding debug object to window
	window.debugOverlay = {
		app,
		themeManager,
		circularTimer,
		backlogPanel,
		infoPanel,
		layoutManager
	};
}
