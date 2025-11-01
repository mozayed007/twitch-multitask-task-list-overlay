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
				<div class="info-content">
					<div class="info-list"></div>
					<div class="info-empty">
						<p>No viewer data yet</p>
						<p class="info-hint">Viewers can set info with !setinfo [field] [value]</p>
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
		const listEl = this.#containerEl.querySelector('.info-list');
		const emptyEl = this.#containerEl.querySelector('.info-empty');
		const activeCountEl = this.#containerEl.querySelector('.active-count');
		const totalCountEl = this.#containerEl.querySelector('.total-count');

		// Update stats
		const activeViewers = this.getActiveViewers();
		activeCountEl.textContent = String(activeViewers.length);
		totalCountEl.textContent = String(this.#viewerData.size);

		// Show/hide empty state
		if (this.#viewerData.size === 0) {
			listEl.classList.add('hidden');
			emptyEl.classList.remove('hidden');
			return;
		}

		listEl.classList.remove('hidden');
		emptyEl.classList.add('hidden');

		// Render viewer cards (show active viewers first)
		const viewers = this.getAllViewers().sort((a, b) => b.lastActive - a.lastActive);
		listEl.innerHTML = viewers
			.slice(0, 10) // Show only top 10
			.map(viewer => this.#renderViewerCard(viewer))
			.join('');
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
}
