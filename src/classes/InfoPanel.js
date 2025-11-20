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
					<h3 class="info-title">
						<span class="info-icon">👥</span>
						Viewer Info
					</h3>
					<div class="info-stats">
						<span class="stat-item">
							<span class="stat-label">Active:</span>
							<span class="stat-value active-count">0</span>
						</span>
						<span class="stat-item">
							<span class="stat-label">Total:</span>
							<span class="stat-value total-count">0</span>
						</span>
					</div>
				</div>
				<div class="info-content-wrapper">
					<div class="info-content">
						<div class="info-list info-list-primary"></div>
						<div class="info-list info-list-secondary"></div>
						<div class="info-empty">
							<p>No viewer data yet</p>
							<p class="info-hint">Viewers can set info with !setinfo [field] [value]</p>
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
		if (!this.#viewerData.has(username)) {
			if (this.#viewerData.size >= this.#maxViewers) {
				// Remove oldest inactive viewer
				this.#removeOldestInactive();
			}
			this.#viewerData.set(username, {
				username,
				info: {},
				lastActive: Date.now(),
				taskCount: 0
			});
		}

		const viewer = this.#viewerData.get(username);
		viewer.info[field] = value;
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
		if (!this.#viewerData.has(username)) {
			this.#viewerData.set(username, {
				username,
				info: {},
				lastActive: Date.now(),
				taskCount
			});
		} else {
			const viewer = this.#viewerData.get(username);
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
				<div class="viewer-header">
					<span class="viewer-name">${this.#escapeHtml(username)}</span>
					<span class="viewer-status ${isActive ? 'status-active' : 'status-inactive'}">
						${isActive ? '🟢' : '⚫'}
					</span>
				</div>
				<div class="viewer-meta">
					<span class="viewer-tasks">📝 ${taskCount} task${taskCount !== 1 ? 's' : ''}</span>
					<span class="viewer-time">⏰ ${timeAgo}</span>
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
	 * Escape HTML to prevent XSS
	 * @param {string} text - Text to escape
	 * @returns {string} Escaped text
	 */
	#escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Save viewer data to localStorage
	 */
	#saveToStorage() {
		try {
			const data = Array.from(this.#viewerData.entries());
			localStorage.setItem(this.#storageKey, JSON.stringify(data));
		} catch (error) {
			console.error('Failed to save viewer data:', error);
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
	 * Start infinite scroll animation
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
		
		const keyframes = [
			{ transform: 'translateY(0)' },
			{ transform: `translateY(-${adjustedHeight}px)` }
		];
		
		const options = {
			duration: duration,
			iterations: Infinity,
			easing: 'linear'
		};
		
		// Apply animation to both containers
		primaryList.animate(keyframes, options);
		secondaryList.animate(keyframes, options);
		
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
		
		if (primaryList) {
			primaryList.getAnimations().forEach(anim => anim.cancel());
		}
		if (secondaryList) {
			secondaryList.getAnimations().forEach(anim => anim.cancel());
		}
		
		this.#isScrolling = false;
		
		// Remove scrolling class
		const content = this.#containerEl.querySelector('.info-content');
		if (content) {
			content.classList.remove('scrolling');
		}
	}
}
