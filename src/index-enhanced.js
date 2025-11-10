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

// Track selected panel for resizing
let selectedPanel = null;

// Track grid overlay visibility and resize handles
let gridOverlayVisible = false;
let resizeHandlesActive = false;
const resizeHandleCleanups = new Map();

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
	
	// Delay to ensure panels are fully positioned before attaching drag handlers
	setTimeout(() => {
		setupPanelDraggables();
		// Retry after another delay to catch any panels that weren't ready
		setTimeout(() => setupPanelDraggables(), 200);
	}, 100);

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
			const item = backlogPanel.addItem(content, username);
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

	// Pomodoro timer commands (mod only)
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
		const status = state.isRunning ? 'Running' : state.isPaused ? 'Paused' : 'Stopped';
		
		return {
			message: `${prefix}Timer: ${status} | ${state.mode} mode | ${timeStr} | Session ${state.currentSession}/${state.totalSessions} 📊`,
			error: false
		};
	}

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
	dragHandle.style.touchAction = 'none';

	console.log(`Making draggable:`, { element, dragHandle, strategy, bounds });

	const dragStart = (e) => {
		// Handle both mouse and touch events
		if (e.type === 'mousedown' && e.button !== 0) return; // Only respond to primary button

		// Prevent default to avoid text selection and other browser behaviors
		e.preventDefault();
		isDragging = true;
		element.classList.add('dragging');
		document.body.classList.add('overlay-dragging');

		// Get coordinates based on event type
		const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
		const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

		if (strategy === 'absolute') {
			const elementRect = element.getBoundingClientRect();
			const containerRect = boundsEl
				? boundsEl.getBoundingClientRect()
				: { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

			pointerOffsetX = clientX - elementRect.left;
			pointerOffsetY = clientY - elementRect.top;
			offsetX = elementRect.left - containerRect.left;
			offsetY = elementRect.top - containerRect.top;
			lastPosition = { left: offsetX, top: offsetY };
		} else {
			const style = window.getComputedStyle(element);
			const matrix = new DOMMatrix(style.transform);
			offsetX = matrix.m41;
			offsetY = matrix.m42;
			initialX = clientX - offsetX;
			initialY = clientY - offsetY;
		}

		onDragStart?.();
	};

	const drag = (e) => {
		if (!isDragging) return;
		e.preventDefault();

		// Get coordinates based on event type
		const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
		const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

		if (strategy === 'absolute') {
			const containerRect = boundsEl
				? boundsEl.getBoundingClientRect()
				: { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
			const elementRect = element.getBoundingClientRect();

			let newLeft = clientX - containerRect.left - pointerOffsetX;
			let newTop = clientY - containerRect.top - pointerOffsetY;

			const maxLeft = Math.max(0, containerRect.width - elementRect.width);
			const maxTop = Math.max(0, containerRect.height - elementRect.height);

			newLeft = Math.max(0, Math.min(maxLeft, newLeft));
			newTop = Math.max(0, Math.min(maxTop, newTop));

			element.style.left = `${Math.round(newLeft)}px`;
			element.style.top = `${Math.round(newTop)}px`;
			lastPosition = { left: newLeft, top: newTop };
		} else {
			currentX = clientX - initialX;
			currentY = clientY - initialY;

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

	// Mouse events
	dragHandle.addEventListener('mousedown', dragStart);
	document.addEventListener('mousemove', drag);
	document.addEventListener('mouseup', dragEnd);

	// Touch events for mobile/tablet support
	dragHandle.addEventListener('touchstart', dragStart, { passive: false });
	document.addEventListener('touchmove', drag, { passive: false });
	document.addEventListener('touchend', dragEnd);

	return () => {
		dragHandle.removeEventListener('mousedown', dragStart);
		document.removeEventListener('mousemove', drag);
		document.removeEventListener('mouseup', dragEnd);
		dragHandle.removeEventListener('touchstart', dragStart);
		document.removeEventListener('touchmove', drag);
		document.removeEventListener('touchend', dragEnd);
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

	console.log('Setting up panel draggables...');
	const activePanels = new Set();
	const panels = container.querySelectorAll('.draggable-panel');
	console.log(`Found ${panels.length} draggable panels`);
	
	panels.forEach(panel => {
		const panelEl = /** @type {HTMLElement} */ (panel);
		const panelKey = panelEl.dataset.panel;
		console.log(`Processing panel: ${panelKey}`, panelEl);
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

		// Use the entire panel as drag handle for better UX
		let handleEl = panelEl;
		
		const cleanup = makeDraggable(panelEl, handleEl, {
			strategy: 'absolute',
			bounds: container,
			onDragEnd: (position) => {
				layoutManager.savePanelPosition(layoutManager.getCurrentLayout(), panelKey, position);
			}
		});

		// Add click handler to select panel for resizing
		panelEl.addEventListener('click', (e) => {
			// Don't select if clicking interactive elements
			const target = /** @type {HTMLElement} */ (e.target);
			if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
				return;
			}
			selectPanel(panelEl, panelKey);
		});

		panelDragCleanups.set(panelKey, cleanup);
		console.log(`Draggable setup complete for panel: ${panelKey}`);
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

window.addEventListener('layoutChanged', () => {
	// Add small delay to ensure panels are fully positioned before making them draggable
	setTimeout(() => setupPanelDraggables(), 50);
});

let resizeAnimationFrame = null;
window.addEventListener('resize', () => {
	if (!layoutManager) return;
	if (resizeAnimationFrame) cancelAnimationFrame(resizeAnimationFrame);
	resizeAnimationFrame = requestAnimationFrame(() => {
		resizeAnimationFrame = null;
		layoutManager.refreshLayout();
	});
});


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
	// Ensure document has focus for keyboard events
	document.addEventListener('DOMContentLoaded', () => {
		document.body.focus();
		document.body.setAttribute('tabindex', '0');
	});

	// Add click handler to ensure focus when interacting with the overlay
	document.addEventListener('click', () => {
		document.body.focus();
	});

	const handleKeyDown = (e) => {
		console.log('Key pressed:', e.key, 'Alt:', e.altKey, 'Ctrl:', e.ctrlKey, 'Shift:', e.shiftKey);
		
		// + key = Increase size of selected panel
		if ((e.key === '+' || e.key === '=' || e.key === 'Add') && !e.altKey && !e.ctrlKey && !e.shiftKey) {
			if (selectedPanel) {
				e.preventDefault();
				e.stopPropagation();
				resizeSelectedPanel(1.1); // Increase by 10%
				return;
			}
		}

		// - key = Decrease size of selected panel
		if ((e.key === '-' || e.key === '_' || e.key === 'Subtract') && !e.altKey && !e.ctrlKey && !e.shiftKey) {
			if (selectedPanel) {
				e.preventDefault();
				e.stopPropagation();
				resizeSelectedPanel(0.9); // Decrease by 10%
				return;
			}
		}
		
		// Alt + L = Show layout selector
		if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'l') {
			e.preventDefault();
			e.stopPropagation();
			showLayoutSelector();
			return;
		}

		// Alt + G = Toggle grid overlay and resize handles
		if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'g') {
			e.preventDefault();
			e.stopPropagation();
			toggleGridOverlay();
			return;
		}

		// Alt + T = Show theme menu
		if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 't') {
			e.preventDefault();
			e.stopPropagation();
			
			// Close existing theme menu if open
			const existingMenu = document.querySelector('.theme-menu');
			if (existingMenu) {
				existingMenu.remove();
				return;
			}
			
			// Create and show theme menu
			const menu = createThemeMenu();
			document.body.appendChild(menu);
			const header = /** @type {HTMLElement|null} */ (menu.querySelector('.theme-menu-header'));
			makeDraggable(menu, header, { strategy: 'absolute' });
			return;
		}

		// Escape key to close any open menus/overlays or deselect panel
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			
			// Hide grid overlay first
			if (gridOverlayVisible) {
				hideGridOverlay();
				return;
			}
			
			// Deselect panel
			if (selectedPanel) {
				deselectPanel();
				return;
			}
			
			// Close theme menu if open
			const themeMenu = document.querySelector('.theme-menu');
			if (themeMenu) {
				themeMenu.remove();
				return;
			}
			
			// Close layout selector if open
			const layoutSelector = document.querySelector('.layout-selector');
			if (layoutSelector) {
				layoutSelector.remove();
				return;
			}
		}
	};

	// Add keyboard event listener with capture to ensure it gets processed
	document.addEventListener('keydown', handleKeyDown, true);
	
	// Also add to window for backup
	window.addEventListener('keydown', handleKeyDown, true);
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
		makeDraggable(selector, header, { strategy: 'absolute' });
	}
}

/**
 * Select a panel for resizing
 * @param {HTMLElement} panelEl - Panel element
 * @param {string} panelKey - Panel key identifier
 */
function selectPanel(panelEl, panelKey) {
	// Deselect previous panel
	deselectPanel();
	
	// Select new panel
	selectedPanel = { element: panelEl, key: panelKey };
	panelEl.classList.add('panel-selected');
	console.log(`Panel selected: ${panelKey}`);
}

/**
 * Deselect the currently selected panel
 */
function deselectPanel() {
	if (selectedPanel) {
		selectedPanel.element.classList.remove('panel-selected');
		selectedPanel = null;
		console.log('Panel deselected');
	}
}

/**
 * Resize the selected panel while maintaining center position and aspect ratio
 * @param {number} scaleFactor - Scale factor (e.g., 1.1 for 10% increase, 0.9 for 10% decrease)
 */
function resizeSelectedPanel(scaleFactor) {
	if (!selectedPanel || !layoutManager) return;
	
	const { element, key } = selectedPanel;
	const rect = element.getBoundingClientRect();
	const container = document.getElementById('app');
	if (!container) return;
	
	const containerRect = container.getBoundingClientRect();
	
	// Get current dimensions
	const currentWidth = rect.width;
	const currentHeight = rect.height;
	
	// Calculate new dimensions (maintaining aspect ratio)
	const newWidth = Math.round(currentWidth * scaleFactor);
	const newHeight = Math.round(currentHeight * scaleFactor);
	
	// Get current position (relative to container)
	const currentLeft = rect.left - containerRect.left;
	const currentTop = rect.top - containerRect.top;
	
	// Calculate center point
	const centerX = currentLeft + currentWidth / 2;
	const centerY = currentTop + currentHeight / 2;
	
	// Calculate new position to maintain center
	let newLeft = centerX - newWidth / 2;
	let newTop = centerY - newHeight / 2;
	
	// Clamp to container bounds
	const maxLeft = Math.max(0, containerRect.width - newWidth);
	const maxTop = Math.max(0, containerRect.height - newHeight);
	newLeft = Math.max(0, Math.min(maxLeft, newLeft));
	newTop = Math.max(0, Math.min(maxTop, newTop));
	
	// Apply new size
	element.style.width = `${newWidth}px`;
	element.style.height = `${newHeight}px`;
	
	// Apply new position
	element.style.left = `${Math.round(newLeft)}px`;
	element.style.top = `${Math.round(newTop)}px`;
	
	// Save to layout manager
	const layoutName = layoutManager.getCurrentLayout();
	layoutManager.savePanelSize(layoutName, key, {
		width: newWidth,
		height: newHeight
	});
	layoutManager.savePanelPosition(layoutName, key, {
		left: newLeft,
		top: newTop
	});
	
	console.log(`Resized ${key}: ${currentWidth}x${currentHeight} -> ${newWidth}x${newHeight}`);
}

/**
 * Toggle grid overlay and resize handles
 */
function toggleGridOverlay() {
	if (gridOverlayVisible) {
		hideGridOverlay();
	} else {
		showGridOverlay();
	}
}

/**
 * Show grid overlay and resize handles
 */
function showGridOverlay() {
	if (gridOverlayVisible) return;
	
	gridOverlayVisible = true;
	
	// Create grid overlay element
	const gridOverlay = document.createElement('div');
	gridOverlay.id = 'grid-overlay';
	gridOverlay.className = 'grid-overlay';
	document.body.appendChild(gridOverlay);
	
	// Add resize handles to all panels
	addResizeHandles();
	
	console.log('Grid overlay shown');
}

/**
 * Hide grid overlay and resize handles
 */
function hideGridOverlay() {
	if (!gridOverlayVisible) return;
	
	gridOverlayVisible = false;
	
	// Remove grid overlay element
	const gridOverlay = document.getElementById('grid-overlay');
	if (gridOverlay) {
		gridOverlay.remove();
	}
	
	// Remove resize handles from all panels
	removeResizeHandles();
	
	console.log('Grid overlay hidden');
}

/**
 * Add resize handles to all draggable panels
 */
function addResizeHandles() {
	if (resizeHandlesActive) return;
	
	resizeHandlesActive = true;
	
	const panels = document.querySelectorAll('.draggable-panel');
	panels.forEach(panelEl => {
		const panel = /** @type {HTMLElement} */ (panelEl);
		const panelKey = panel.dataset.panel;
		if (!panelKey) return;
		
		// Create 8 resize handles (corners and edges)
		const handles = [
			{ name: 'nw', cursor: 'nwse-resize', position: 'top-left' },
			{ name: 'n', cursor: 'ns-resize', position: 'top-center' },
			{ name: 'ne', cursor: 'nesw-resize', position: 'top-right' },
			{ name: 'e', cursor: 'ew-resize', position: 'middle-right' },
			{ name: 'se', cursor: 'nwse-resize', position: 'bottom-right' },
			{ name: 's', cursor: 'ns-resize', position: 'bottom-center' },
			{ name: 'sw', cursor: 'nesw-resize', position: 'bottom-left' },
			{ name: 'w', cursor: 'ew-resize', position: 'middle-left' }
		];
		
		handles.forEach(({ name, cursor, position }) => {
			const handle = document.createElement('div');
			handle.className = `resize-handle resize-handle-${name}`;
			handle.dataset.direction = name;
			handle.style.cursor = cursor;
			panel.appendChild(handle);
			
			// Make this handle draggable for resizing
			const cleanup = makeResizable(panel, handle, name, panelKey);
			
			// Store cleanup function
			if (!resizeHandleCleanups.has(panelKey)) {
				resizeHandleCleanups.set(panelKey, []);
			}
			resizeHandleCleanups.get(panelKey).push(cleanup);
		});
	});
	
	console.log('Resize handles added to all panels');
}

/**
 * Remove resize handles from all panels
 */
function removeResizeHandles() {
	if (!resizeHandlesActive) return;
	
	resizeHandlesActive = false;
	
	// Call all cleanup functions
	resizeHandleCleanups.forEach(cleanups => {
		cleanups.forEach(cleanup => cleanup());
	});
	resizeHandleCleanups.clear();
	
	// Remove all resize handle elements
	const handles = document.querySelectorAll('.resize-handle');
	handles.forEach(handle => handle.remove());
	
	console.log('Resize handles removed from all panels');
}

/**
 * Make a panel resizable by dragging a handle
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} handle - Resize handle element
 * @param {string} direction - Direction of resize (n, s, e, w, ne, nw, se, sw)
 * @param {string} panelKey - Panel key identifier
 * @returns {() => void} Cleanup function
 */
function makeResizable(panel, handle, direction, panelKey) {
	let isResizing = false;
	let startX = 0;
	let startY = 0;
	let startWidth = 0;
	let startHeight = 0;
	let startLeft = 0;
	let startTop = 0;
	
	const resizeStart = (e) => {
		// Handle both mouse and touch events
		if (e.type === 'mousedown' && e.button !== 0) return;
		
		e.preventDefault();
		e.stopPropagation();
		isResizing = true;
		
		// Get coordinates based on event type
		const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
		const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
		
		startX = clientX;
		startY = clientY;
		
		const rect = panel.getBoundingClientRect();
		startWidth = rect.width;
		startHeight = rect.height;
		startLeft = panel.offsetLeft;
		startTop = panel.offsetTop;
		
		panel.classList.add('resizing');
		document.body.classList.add('overlay-resizing');
	};
	
	const resize = (e) => {
		if (!isResizing) return;
		e.preventDefault();
		
		// Get coordinates based on event type
		const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
		const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
		
		const deltaX = clientX - startX;
		const deltaY = clientY - startY;
		
		let newWidth = startWidth;
		let newHeight = startHeight;
		let newLeft = startLeft;
		let newTop = startTop;
		
		// Calculate new dimensions based on direction
		if (direction.includes('e')) {
			newWidth = Math.max(100, startWidth + deltaX);
		}
		if (direction.includes('w')) {
			newWidth = Math.max(100, startWidth - deltaX);
			newLeft = startLeft + (startWidth - newWidth);
		}
		if (direction.includes('s')) {
			newHeight = Math.max(100, startHeight + deltaY);
		}
		if (direction.includes('n')) {
			newHeight = Math.max(100, startHeight - deltaY);
			newTop = startTop + (startHeight - newHeight);
		}
		
		// Get container bounds for clamping
		const container = document.getElementById('app');
		if (container) {
			const containerRect = container.getBoundingClientRect();
			
			// Clamp to container bounds
			if (newLeft < 0) {
				newWidth += newLeft;
				newLeft = 0;
			}
			if (newTop < 0) {
				newHeight += newTop;
				newTop = 0;
			}
			if (newLeft + newWidth > containerRect.width) {
				newWidth = containerRect.width - newLeft;
			}
			if (newTop + newHeight > containerRect.height) {
				newHeight = containerRect.height - newTop;
			}
		}
		
		// Apply new dimensions and position
		panel.style.width = `${Math.round(newWidth)}px`;
		panel.style.height = `${Math.round(newHeight)}px`;
		panel.style.left = `${Math.round(newLeft)}px`;
		panel.style.top = `${Math.round(newTop)}px`;
	};
	
	const resizeEnd = () => {
		if (!isResizing) return;
		isResizing = false;
		
		panel.classList.remove('resizing');
		document.body.classList.remove('overlay-resizing');
		
		// Save to layout manager
		if (layoutManager) {
			const layoutName = layoutManager.getCurrentLayout();
			const rect = panel.getBoundingClientRect();
			
			layoutManager.savePanelSize(layoutName, panelKey, {
				width: Math.round(rect.width),
				height: Math.round(rect.height)
			});
			layoutManager.savePanelPosition(layoutName, panelKey, {
				left: Math.round(panel.offsetLeft),
				top: Math.round(panel.offsetTop)
			});
			
			console.log(`Panel ${panelKey} resized: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
		}
	};
	
	// Mouse events
	handle.addEventListener('mousedown', resizeStart);
	document.addEventListener('mousemove', resize);
	document.addEventListener('mouseup', resizeEnd);
	
	// Touch events
	handle.addEventListener('touchstart', resizeStart, { passive: false });
	document.addEventListener('touchmove', resize, { passive: false });
	document.addEventListener('touchend', resizeEnd);
	
	// Return cleanup function
	return () => {
		handle.removeEventListener('mousedown', resizeStart);
		document.removeEventListener('mousemove', resize);
		document.removeEventListener('mouseup', resizeEnd);
		handle.removeEventListener('touchstart', resizeStart);
		document.removeEventListener('touchmove', resize);
		document.removeEventListener('touchend', resizeEnd);
	};
}

// Deselect panel when clicking outside
document.addEventListener('click', (e) => {
	if (!selectedPanel) return;
	
	const target = /** @type {HTMLElement} */ (e.target);
	// Check if click is outside the selected panel
	if (!selectedPanel.element.contains(target)) {
		// Don't deselect if clicking on menu items
		if (target.closest('.theme-menu') || target.closest('.layout-selector')) {
			return;
		}
		deselectPanel();
	}
});

// Export for debugging
if (typeof window !== 'undefined') {
	// @ts-ignore - Adding debug object to window
	window.debugOverlay = {
		app,
		themeManager,
		circularTimer,
		backlogPanel,
		infoPanel,
		layoutManager,
		selectPanel,
		deselectPanel,
		resizeSelectedPanel
	};
}
