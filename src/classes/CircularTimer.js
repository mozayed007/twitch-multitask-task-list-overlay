/**
 * CircularTimer - Modern circular progress timer component
 * @class CircularTimer
 */
export default class CircularTimer {
	#timerEl;
	#progressRing;
	#orbitRing;
	#timeDisplay;
	#labelDisplay;
	#iconDisplay;
	#intervalId = null;
	#totalSeconds = 0;
	#currentSeconds = 0;
	#mode = 'focus'; // 'focus' or 'break'
	#onComplete = null;
	#isPaused = false;

	// Session tracking
	#currentSession = 0;
	#totalSessions = 4;
	#focusDuration = 25;
	#breakDuration = 5;
	#longBreakDuration = 15;
	#sessionsBeforeLongBreak = 4;

	// State persistence
	#stateKey = 'pomoTimer.state';

	/**
	 * @constructor
	 * @param {string} containerId - ID of the container element
	 */
	constructor(containerId) {
		this.#timerEl = document.getElementById(containerId);
		if (!this.#timerEl) {
			console.error(`Timer container "${containerId}" not found`);
			return;
		}
		this.#initializeTimer();
	}

	/**
	 * Initialize timer HTML structure
	 */
	#initializeTimer() {
		this.#timerEl.innerHTML = `
			<div class="circular-timer">
				<div class="timer-orbit-ring">
					<div class="timer-orbit-planet"></div>
				</div>
				<svg class="timer-svg" viewBox="0 0 200 200">
					<!-- Background circle -->
					<circle
						class="timer-bg-circle"
						cx="100"
						cy="100"
						r="85"
						fill="none"
						stroke="var(--color-timer-bg)"
						stroke-width="12"
					/>
					<!-- Progress circle -->
					<circle
						class="timer-progress-ring"
						cx="100"
						cy="100"
						r="85"
						fill="none"
						stroke="var(--color-timer-ring)"
						stroke-width="12"
						stroke-linecap="round"
						transform="rotate(-90 100 100)"
					/>
				</svg>
				<div class="timer-content">
					<div class="timer-icon">
						<i class="icon-work">📚</i>
					</div>
					<div class="timer-time">00:00</div>
					<div class="timer-label">Ready</div>
					<div class="timer-pomo-count">
						<span class="pomo-text">Pomo</span>
						<span class="pomo-number">0 / 4</span>
					</div>
				</div>
			</div>
		`;

		// Cache DOM elements
		this.#progressRing = this.#timerEl.querySelector('.timer-progress-ring');
		this.#orbitRing = this.#timerEl.querySelector('.timer-orbit-ring');
		this.#timeDisplay = this.#timerEl.querySelector('.timer-time');
		this.#labelDisplay = this.#timerEl.querySelector('.timer-label');
		this.#iconDisplay = this.#timerEl.querySelector('.timer-icon');

		// Set initial progress ring
		this.#updateProgressRing(0);
	}

	/**
	 * Start a Pomodoro cycle
	 * @param {number} focusMinutes - Focus duration in minutes
	 * @param {number} breakMinutes - Short break duration in minutes
	 * @param {number} sessions - Total sessions to complete
	 * @param {Function} onComplete - Callback when cycle completes
	 */
	startCycle(focusMinutes = 25, breakMinutes = 5, sessions = 4, onComplete = null) {
		this.stop();

		this.#focusDuration = focusMinutes;
		this.#breakDuration = breakMinutes;
		this.#totalSessions = sessions;
		this.#currentSession = 0;
		this.#onComplete = onComplete;

		this.#startSession();
		this.#saveState();
	}

	/**
	 * Start a single session (focus or break)
	 */
	#startSession() {
		if (this.#currentSession >= this.#totalSessions) {
			this.#handleCycleComplete();
			return;
		}

		this.#mode = 'focus';
		this.#currentSession++;
		this.#totalSeconds = this.#focusDuration * 60;
		this.#currentSeconds = this.#totalSeconds;
		this.#isPaused = false;

		this.#updateModeUI();
		this.updatePomoCount(this.#currentSession, this.#totalSessions);

		this.#intervalId = setInterval(() => this.#tick(), 1000);
		this.#tick();
	}

	/**
	 * Start a break session
	 */
	#startBreak() {
		const isLongBreak = this.#currentSession % this.#sessionsBeforeLongBreak === 0;
		const breakDuration = isLongBreak ? this.#longBreakDuration : this.#breakDuration;

		this.#mode = isLongBreak ? 'longbreak' : 'break';
		this.#totalSeconds = breakDuration * 60;
		this.#currentSeconds = this.#totalSeconds;
		this.#isPaused = false;

		this.#updateModeUI();

		this.#intervalId = setInterval(() => this.#tick(), 1000);
		this.#tick();
	}

	/**
	 * Start a timer session (legacy compatibility)
	 * @param {number} minutes - Duration in minutes
	 * @param {string} mode - 'focus' or 'break'
	 * @param {Function} onComplete - Callback when timer completes
	 */
	start(minutes, mode = 'focus', onComplete = null) {
		this.stop();

		this.#mode = mode;
		this.#totalSeconds = minutes * 60;
		this.#currentSeconds = this.#totalSeconds;
		this.#onComplete = onComplete;
		this.#isPaused = false;

		this.#updateModeUI();

		this.#intervalId = setInterval(() => this.#tick(), 1000);
		this.#tick();
	}

	/**
	 * Stop the timer
	 */
	stop() {
		if (this.#intervalId) {
			clearInterval(this.#intervalId);
			this.#intervalId = null;
		}
		this.#timerEl.classList.remove('timer-running');
		if (this.#orbitRing) {
			this.#orbitRing.style.opacity = '0';
		}
	}

	/**
	 * Pause the timer
	 */
	pause() {
		if (this.#intervalId) {
			clearInterval(this.#intervalId);
			this.#intervalId = null;
			this.#isPaused = true;
			this.#timerEl.classList.remove('timer-running');
			if (this.#orbitRing) {
				this.#orbitRing.style.opacity = '0';
			}
			this.#saveState();
		}
	}

	/**
	 * Resume the timer
	 */
	resume() {
		if (!this.#intervalId && this.#currentSeconds > 0 && this.#isPaused) {
			this.#isPaused = false;
			this.#intervalId = setInterval(() => this.#tick(), 1000);
			this.#timerEl.classList.add('timer-running');
			this.#updateProgressRing(
				((this.#totalSeconds - this.#currentSeconds) / this.#totalSeconds) * 100
			);
			this.#saveState();
		}
	}

	/**
	 * Reset the timer and session count
	 */
	reset() {
		this.stop();
		this.#currentSeconds = 0;
		this.#totalSeconds = 0;
		this.#currentSession = 0;
		this.#isPaused = false;
		this.#timerEl.classList.remove('timer-running');
		this.#updateDisplay();
		this.#updateProgressRing(0);
		this.#labelDisplay.textContent = 'Ready';
		this.updatePomoCount(0, this.#totalSessions);
		this.#clearState();
	}

	/**
	 * Timer tick handler
	 */
	#tick() {
		if (this.#currentSeconds <= 0) {
			this.stop();
			this.#handleComplete();
			return;
		}

		this.#currentSeconds--;
		this.#updateDisplay();
		// Use remaining time percentage for "decaying" effect
		const remainingPercent = (this.#currentSeconds / this.#totalSeconds) * 100;
		this.#updateProgressRing(remainingPercent);

		// Flash at final seconds
		if (this.#currentSeconds <= 3 && this.#currentSeconds > 0) {
			this.#timerEl.classList.add('timer-pulse');
		}
	}

	/**
	 * Update time display
	 */
	#updateDisplay() {
		const minutes = Math.floor(this.#currentSeconds / 60)
			.toString()
			.padStart(2, '0');
		const seconds = (this.#currentSeconds % 60).toString().padStart(2, '0');
		this.#timeDisplay.textContent = `${minutes}:${seconds}`;
	}

	/**
	 * Update progress ring
	 * @param {number} percent - Progress percentage (0-100)
	 */
	#updateProgressRing(percent) {
		const circumference = 2 * Math.PI * 85; // radius = 85
		const offset = circumference - (percent / 100) * circumference;
		this.#progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
		this.#progressRing.style.strokeDashoffset = offset;

		// Update orbit ring rotation to follow the progress tip
		if (this.#orbitRing) {
			const degrees = (percent / 100) * 360;
			// Centering transform + rotation synchronization
			this.#orbitRing.style.transform = `translate(-50%, -50%) rotate(${degrees}deg)`;

			// Constant high opacity while running for better visibility
			this.#orbitRing.style.opacity = '0.7';
		}
	}

	/**
	 * Update UI based on timer mode
	 */
	#updateModeUI() {
		const modeConfig = {
			focus: { label: 'Focus', icon: '📚', class: 'timer-focus-mode' },
			break: { label: 'Short Break', icon: '☕', class: 'timer-break-mode' },
			longbreak: { label: 'Long Break', icon: '🌴', class: 'timer-longbreak-mode' }
		};

		const config = modeConfig[this.#mode] || modeConfig.focus;

		this.#labelDisplay.textContent = config.label;
		this.#iconDisplay.innerHTML = `<i class="icon-${this.#mode}">${config.icon}</i>`;

		this.#timerEl.classList.remove('timer-focus-mode', 'timer-break-mode', 'timer-longbreak-mode');
		this.#timerEl.classList.add(config.class);
		this.#timerEl.classList.add('timer-running');
	}

	/**
	 * Handle timer completion
	 */
	#handleComplete() {
		this.#timerEl.classList.remove('timer-pulse');
		this.#timerEl.classList.add('timer-complete');

		setTimeout(() => {
			this.#timerEl.classList.remove('timer-complete');
		}, 2000);

		// If in focus mode, start break
		if (this.#mode === 'focus') {
			setTimeout(() => this.#startBreak(), 2000);
		} else {
			// Break ended, start next session
			setTimeout(() => this.#startSession(), 2000);
		}

		if (this.#onComplete) {
			this.#onComplete(this.#mode, this.#currentSession, this.#totalSessions);
		}

		this.#saveState();
	}

	/**
	 * Handle full cycle completion
	 */
	#handleCycleComplete() {
		this.reset();
		this.#labelDisplay.textContent = 'Cycle Complete! 🎉';

		if (this.#onComplete) {
			this.#onComplete('cycle_complete', this.#totalSessions, this.#totalSessions);
		}
	}

	/**
	 * Update pomodoro count display
	 * @param {number} current - Current pomodoro count
	 * @param {number} total - Total pomodoros goal
	 */
	updatePomoCount(current, total) {
		const pomoNumber = this.#timerEl.querySelector('.pomo-number');
		if (pomoNumber) {
			pomoNumber.textContent = `${current} / ${total}`;
		}
	}

	/**
	 * Get current timer state
	 * @returns {{mode: string, currentSeconds: number, totalSeconds: number, isRunning: boolean, isPaused: boolean, currentSession: number, totalSessions: number, focusDuration: number, breakDuration: number}}
	 */
	getState() {
		return {
			mode: this.#mode,
			currentSeconds: this.#currentSeconds,
			totalSeconds: this.#totalSeconds,
			isRunning: this.#intervalId !== null,
			isPaused: this.#isPaused,
			currentSession: this.#currentSession,
			totalSessions: this.#totalSessions,
			focusDuration: this.#focusDuration,
			breakDuration: this.#breakDuration
		};
	}

	/**
	 * Save state to localStorage
	 */
	#saveState() {
		try {
			localStorage.setItem(this.#stateKey, JSON.stringify(this.getState()));
		} catch (error) {
			console.warn('Failed to save timer state:', error);
		}
	}

	/**
	 * Clear saved state
	 */
	#clearState() {
		try {
			localStorage.removeItem(this.#stateKey);
		} catch (error) {
			console.warn('Failed to clear timer state:', error);
		}
	}

	/**
	 * Restore state from localStorage
	 */
	restoreState() {
		try {
			const saved = localStorage.getItem(this.#stateKey);
			if (saved) {
				const state = JSON.parse(saved);
				if (state.isRunning || state.isPaused) {
					this.#mode = state.mode;
					this.#currentSeconds = state.currentSeconds;
					this.#totalSeconds = state.totalSeconds;
					this.#currentSession = state.currentSession;
					this.#totalSessions = state.totalSessions;
					this.#focusDuration = state.focusDuration;
					this.#breakDuration = state.breakDuration;
					this.#isPaused = state.isPaused;

					this.#updateDisplay();
					this.#updateModeUI();
					this.updatePomoCount(this.#currentSession, this.#totalSessions);

					if (state.isRunning) {
						this.#intervalId = setInterval(() => this.#tick(), 1000);
					}
				}
			}
		} catch (error) {
			console.warn('Failed to restore timer state:', error);
		}
	}
}
