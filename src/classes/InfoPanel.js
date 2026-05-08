/**
 * InfoPanel - Viewer profiles and stats display
 * @class InfoPanel
 */
export default class InfoPanel {
	#viewerData = new Map();
	#containerId;
	#containerEl;
	#storageKey = 'viewerProfiles';
	#maxViewers = 100;
	#scrollAnimation = null;
	#isScrolling = false;
	#scrollSpeed = 15;

	/**
	 * Escape HTML to prevent XSS attacks
	 * @param {string} text - Text to escape
	 * @returns {string} Escaped text
	 */
	#escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * @constructor
	 * @param {string} containerId - ID of the container element
	 */
	constructor(containerId) {
		this.#containerId = containerId;
		this.#containerEl = document.getElementById(containerId);
		if (!this.#containerEl) {
			console.error(`Info panel container "${containerId}" not found`);
			return;
		}
		this.#loadFromStorage();
		this.#initializePanel();
		this.render();
	}

	/**
	 * Initialize panel HTML structure
	 */
	#initializePanel() {
		this.#containerEl.innerHTML = `
			<div class="info-panel">
				<div class="info-header">
					<div class="info-stats">
						<span class="stat-item">
							<span class="stat-value active-count">0</span>
							<span class="stat-label">Active</span>
						</span>
						<span class="stat-item">
							<span class="stat-value total-count">0</span>
							<span class="stat-label">Total</span>
						</span>
					</div>
				</div>
				<div class="info-content-wrapper">
					<div class="info-content">
						<div class="info-list info-list-primary"></div>
						<div class="info-list info-list-secondary"></div>
						<div class="info-empty">
							<p>No viewer data</p>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	/**
	 * Set viewer info field
	 * @param {string} username - Viewer username
	 * @param {string} field - Info field name
	 * @param {string} value - Info value
	 * @returns {boolean} Success status
	 */
	setViewerInfo(username, field, value) {
		// Escape all user input to prevent XSS attacks
		const safeUsername = this.#escapeHtml(username);
		const safeField = this.#escapeHtml(field);
		const safeValue = this.#escapeHtml(value);

		if (!this.#viewerData.has(safeUsername)) {
			if (this.#viewerData.size >= this.#maxViewers) {
				// Remove oldest inactive viewer
				this.#removeOldestInactive();
			}
			this.#viewerData.set(safeUsername, {
				username: safeUsername,
				info: {},
				lastActive: Date.now(),
				taskCount: 0
			});
		}

		const viewer = this.#viewerData.get(safeUsername);
		viewer.info[safeField] = safeValue;
		viewer.lastActive = Date.now();

		this.#saveToStorage();
		this.render();
		return true;
	}

	/**
	 * Get viewer info
	 * @param {string} username - Viewer username
	 * @returns {Object|null} Viewer data or null
	 */
	getViewerInfo(username) {
		return this.#viewerData.get(username) || null;
	}

	/**
	 * Update viewer activity
	 * @param {string} username - Viewer username
	 * @param {number} taskCount - Current task count
	 */
	updateViewerActivity(username, taskCount = 0) {
		// Escape username to prevent XSS attacks
		const safeUsername = this.#escapeHtml(username);

		if (!this.#viewerData.has(safeUsername)) {
			this.#viewerData.set(safeUsername, {
				username: safeUsername,
				info: {},
				lastActive: Date.now(),
				taskCount
			});
		} else {
			const viewer = this.#viewerData.get(safeUsername);
			viewer.lastActive = Date.now();
			viewer.taskCount = taskCount;
		}

		this.#saveToStorage();
		this.render();
	}

	/**
	 * Get all viewer data
	 * @returns {Array} Array of viewer objects
	 */
	getAllViewers() {
		return Array.from(this.#viewerData.values());
	}

	/**
	 * Remove viewer data
	 * @param {string} username - Viewer username
	 * @returns {boolean} Success status
	 */
	removeViewer(username) {
		const result = this.#viewerData.delete(username);
		if (result) {
			this.#saveToStorage();
			this.render();
		}
		return result;
	}

	/**
	 * Get active viewers (active in last hour)
	 * @returns {Array} Array of active viewer objects
	 */
	getActiveViewers() {
		const oneHourAgo = Date.now() - (60 * 60 * 1000);
		return this.getAllViewers().filter(v => v.lastActive > oneHourAgo);
	}

	/**
	 * Remove oldest inactive viewer
	 */
	#removeOldestInactive() {
		const viewers = this.getAllViewers();
		if (viewers.length === 0) return;

		// Sort by lastActive, oldest first
		viewers.sort((a, b) => a.lastActive - b.lastActive);
		
		// Remove oldest
		this.#viewerData.delete(viewers[0].username);
	}

	/**
	 * Render the info panel
	 */
	render() {
		const primaryListEl = this.#containerEl.querySelector('.info-list-primary');
		const secondaryListEl = this.#containerEl.querySelector('.info-list-secondary');
		const emptyEl = this.#containerEl.querySelector('.info-empty');
		const activeCountEl = this.#containerEl.querySelector('.active-count');
		const totalCountEl = this.#containerEl.querySelector('.total-count');
		const panelEl = this.#containerEl.querySelector('.info-panel');

		// Update stats
		const activeViewers = this.getActiveViewers();
		activeCountEl.textContent = String(activeViewers.length);
		totalCountEl.textContent = String(this.#viewerData.size);

		// Apply dynamic sizing based on viewer count
		panelEl.classList.remove('minimized', 'single-item', 'expanded');
		
		if (this.#viewerData.size === 0) {
			// Minimized state - no viewers
			panelEl.classList.add('minimized');
			primaryListEl.classList.add('hidden');
			secondaryListEl.classList.add('hidden');
			emptyEl.classList.remove('hidden');
			this.#stopScrollAnimation();
			return;
		} else if (this.#viewerData.size === 1) {
			// Single viewer state
			panelEl.classList.add('single-item');
		} else if (this.#viewerData.size >= 5) {
			// Expanded state - 5 or more viewers with scroll
			panelEl.classList.add('expanded');
		}
		// For 2-4 viewers, use default sizing (no class)

		primaryListEl.classList.remove('hidden');
		emptyEl.classList.add('hidden');

		// Render viewer cards (show active viewers first)
		const viewers = this.getAllViewers().sort((a, b) => b.lastActive - a.lastActive);
		const viewersHtml = viewers
			.slice(0, 10) // Show only top 10
			.map(viewer => this.#renderViewerCard(viewer))
			.join('');
		
		primaryListEl.innerHTML = viewersHtml;
		secondaryListEl.innerHTML = viewersHtml;

		// Start scroll animation if needed
		setTimeout(() => this.#updateScrollAnimation(), 100);
	}

	/**
	 * Render a viewer card
	 * @param {Object} viewer - Viewer data
	 * @returns {string} HTML string
	 */
	#renderViewerCard(viewer) {
		const { username, info, lastActive, taskCount } = viewer;
		const isActive = (Date.now() - lastActive) < (60 * 60 * 1000);
		const timeAgo = this.#formatTimeAgo(lastActive);

		// Build info items
		const infoItems = Object.entries(info)
			.map(([key, value]) => `
				<div class="viewer-info-item">
					<span class="info-key">${this.#escapeHtml(key)}:</span>
					<span class="info-value">${this.#escapeHtml(value)}</span>
				</div>
			`)
			.join('');

		return `
			<div class="viewer-card ${isActive ? 'active' : 'inactive'}">
				<div class="viewer-card-main">
					<div class="viewer-header">
						<span class="viewer-name">${this.#escapeHtml(username)}</span>
						<span class="viewer-status-dot ${isActive ? 'active' : 'inactive'}"></span>
					</div>
					<div class="viewer-meta">
						<span class="viewer-tasks">${taskCount} tasks</span>
						<span class="viewer-separator">•</span>
						<span class="viewer-time">${timeAgo}</span>
					</div>
				</div>
				${infoItems ? `<div class="viewer-info">${infoItems}</div>` : ''}
			</div>
		`;
	}

	/**
	 * Format time ago
	 * @param {number} timestamp - Timestamp in milliseconds
	 * @returns {string} Formatted time string
	 */
	#formatTimeAgo(timestamp) {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);

		if (seconds < 60) return 'just now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}

	/**
	 * Save viewer data to localStorage with quota handling
	 */
	#saveToStorage() {
		try {
			const data = Array.from(this.#viewerData.entries());
			localStorage.setItem(this.#storageKey, JSON.stringify(data));
		} catch (error) {
			if (error.name === 'QuotaExceededError') {
				console.warn('Storage quota exceeded, attempting cleanup...');
				// Try to remove oldest inactive viewers first
				this.#removeOldestInactive();
				try {
					const data = Array.from(this.#viewerData.entries());
					localStorage.setItem(this.#storageKey, JSON.stringify(data));
					return;
				} catch (retryError) {
					console.error('Still unable to save after cleanup:', retryError);
				}
				// If still failing, remove more viewers
				if (this.#viewerData.size > 50) {
					const viewers = this.getAllViewers();
					const toRemove = viewers.slice(0, 25);
					toRemove.forEach(v => this.#viewerData.delete(v.username));
					console.warn(`Removed ${toRemove.length} viewers, retrying save...`);
					try {
						const data = Array.from(this.#viewerData.entries());
						localStorage.setItem(this.#storageKey, JSON.stringify(data));
						return;
					} catch (retryError) {
						console.error('Unable to save even after removing viewers:', retryError);
					}
				}
				console.error('Failed to save viewer data: storage quota exceeded and cleanup failed');
			} else {
				console.error('Failed to save viewer data:', error);
			}
		}
	}

	/**
	 * Load viewer data from localStorage
	 */
	#loadFromStorage() {
		try {
			const stored = localStorage.getItem(this.#storageKey);
			if (stored) {
				const data = JSON.parse(stored);
				this.#viewerData = new Map(data);
			}
		} catch (error) {
			console.error('Failed to load viewer data:', error);
			this.#viewerData = new Map();
		}
	}

	/**
	 * Update scroll animation based on viewer count
	 */
	#updateScrollAnimation() {
		const primaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.info-list-primary'));
		const secondaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.info-list-secondary'));
		
		if (!primaryList) return;
		
		// Only start scrolling if we have MORE than 5 viewers
		if (this.#viewerData.size > 5 && !this.#isScrolling) {
			const contentHeight = primaryList.scrollHeight;
			secondaryList.style.display = 'flex';
			this.#startScrollAnimation(contentHeight);
		} else {
			secondaryList.style.display = 'none';
			this.#stopScrollAnimation();
		}
	}

	/**
	 * Start infinite scroll animation using CSS
	 * @param {number} contentHeight - Height of content to scroll
	 */
	#startScrollAnimation(contentHeight) {
		const primaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.info-list-primary'));
		const secondaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.info-list-secondary'));

		if (!primaryList || !secondaryList) return;

		// Calculate duration based on content height and speed
		const gapSize = 12; // var(--spacing-sm) in pixels
		const adjustedHeight = contentHeight + gapSize;
		const duration = (adjustedHeight / this.#scrollSpeed) * 1000;

		// Set CSS custom properties for animation
		primaryList.style.setProperty('--scroll-height', `${adjustedHeight}px`);
		primaryList.style.setProperty('--scroll-duration', `${duration}ms`);
		secondaryList.style.setProperty('--scroll-height', `${adjustedHeight}px`);
		secondaryList.style.setProperty('--scroll-duration', `${duration}ms`);

		// Add scrolling class to trigger CSS animation
		primaryList.classList.add('scrolling');
		secondaryList.classList.add('scrolling');

		this.#isScrolling = true;

		// Add scrolling class to disable hover effects
		const content = this.#containerEl.querySelector('.info-content');
		if (content) {
			content.classList.add('scrolling');
		}
	}

	/**
	 * Stop scroll animation
	 */
	#stopScrollAnimation() {
		const primaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.info-list-primary'));
		const secondaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.info-list-secondary'));

		// Remove scrolling class to stop CSS animation
		if (primaryList) {
			primaryList.classList.remove('scrolling');
			primaryList.style.removeProperty('--scroll-height');
			primaryList.style.removeProperty('--scroll-duration');
		}
		if (secondaryList) {
			secondaryList.classList.remove('scrolling');
			secondaryList.style.removeProperty('--scroll-height');
			secondaryList.style.removeProperty('--scroll-duration');
		}

		this.#isScrolling = false;

		// Remove scrolling class
		const content = this.#containerEl.querySelector('.info-content');
		if (content) {
			content.classList.remove('scrolling');
		}
	}
}
