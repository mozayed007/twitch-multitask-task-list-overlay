// ============================
// Application Constants
// ============================
/** @type {ConstantsConfig} */
const _constants = {
	// ============================
	// Storage Configuration
	// ============================
	storage: {
		// Maximum items per storage type
		maxBacklogItems: 50,
		maxViewers: 100,
		maxTasksPerUser: 10,

		// Storage keys with versioning
		storageKeys: {
			version: 'app.storageVersion',
			userList: 'userList',
			testUserList: 'testUserList',
			taskBacklog: 'taskBacklog',
			viewerProfiles: 'viewerProfiles',
			pomoTimerState: 'pomoTimer.state',
			goalData: 'overlay.goalData',
			currentLayout: 'currentLayout',
			currentTheme: 'currentTheme',
			panelPositions: 'enhancedOverlay.panelPositions.v2',
			panelSizes: 'enhancedOverlay.panelSizes.v1'
		},

		// Current storage schema version
		currentSchemaVersion: 2
	},

	// ============================
	// Validation Configuration
	// ============================
	validation: {
		// Username validation
		username: {
			minLength: 3,
			maxLength: 25,
			allowedChars: /^[a-zA-Z0-9_-]+$/,
			forbiddenChars: /[<>\"'&]/
		},

		// Task description validation
		taskDescription: {
			minLength: 1,
			maxLength: 500
		},

		// Priority validation
		priority: {
			min: 1,
			max: 5
		}
	},

	// ============================
	// Scroll Animation Configuration
	// ============================
	scroll: {
		// Scroll speed in pixels per second
		defaultSpeed: 20,
		backlogSpeed: 15,
		infoPanelSpeed: 15,

		// Gap size between duplicate lists for seamless scrolling
		gapSize: 12,

		// Maximum visible items before scrolling starts
		backlogMaxVisible: 8,
		infoPanelMaxVisible: 5
	},

	// ============================
	// Timer Configuration
	// ============================
	timer: {
		// Default Pomodoro settings
		defaultFocusMinutes: 25,
		defaultBreakMinutes: 5,
		defaultLongBreakMinutes: 15,
		defaultSessions: 4,
		sessionsBeforeLongBreak: 4,
		maxSessions: 12,

		// Animation settings
		pulseStartSeconds: 3,
		transitionDelayMs: 2000,

		// Progress ring
		ringRadius: 85
	},

	// ============================
	// Layout Configuration
	// ============================
	layout: {
		// Base resolution for layout calculations
		baseWidth: 1920,
		baseHeight: 1080,

		// Default padding
		defaultPadding: 30,

		// Panel metadata
		panels: {
			timer: { id: 'timer-container', defaultDisplay: 'flex' },
			taskList: { id: 'task-list-container', defaultDisplay: 'block' },
			backlog: { id: 'backlog-container', defaultDisplay: 'block' },
			infoPanel: { id: 'info-panel-container', defaultDisplay: 'block' }
		}
	},

	// ============================
	// Animation Configuration
	// ============================
	animation: {
		// Typewriter animation
		typewriter: {
			typingSpeed: 80,
			deletingSpeed: 40,
			pauseDuration: 2000,
			nextCommandDelay: 500
		},

		// Command tips rotation
		commandTips: {
			interval: 6000
		}
	},

	// ============================
	// Reconnection Configuration
	// ============================
	network: {
		// WebSocket reconnection
		initialReconnectInterval: 1000,
		maxReconnectInterval: 60000,

		// Activity tracking
		activeViewerThresholdMs: 60 * 60 * 1000 // 1 hour
	}
};