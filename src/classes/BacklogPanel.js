/**
 * BacklogPanel - Manages broadcaster task backlog
 * @class BacklogPanel
 */
export default class BacklogPanel {
	#backlogItems = [];
	#containerId;
	#containerEl;
	#storageKey = 'taskBacklog';
	#maxItems = 50;
	#onRefresh = null;
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
			console.error(`Backlog container "${containerId}" not found`);
			return;
		}
		this.#loadFromStorage();
		this.#initializePanel();
		this.render();
	}

	/**
	 * Set callback for when backlog changes
	 * @param {Function} callback 
	 */
	setOnRefresh(callback) {
		this.#onRefresh = callback;
	}

	/**
	 * Initialize panel HTML structure
	 */
	#initializePanel() {
		this.#containerEl.innerHTML = `
			<div class="backlog-panel" role="region" aria-label="Task backlog panel">
				<div class="backlog-header">
					<div class="backlog-header-top">
						<h3 class="backlog-title">
							<span class="backlog-icon" aria-hidden="true">📋</span>
							Task Backlog
						</h3>
						<div class="backlog-controls">
							<span class="backlog-count" aria-live="polite" aria-label="Number of tasks">0 tasks</span>
							<button class="backlog-btn backlog-clear-btn" title="Clear completed" aria-label="Clear completed tasks">
								<span aria-hidden="true">🗑️</span>
							</button>
						</div>
					</div>
					<div class="backlog-commands-hint" aria-live="polite">
						<span class="backlog-cmd-label">COMMANDS:</span>
						<span class="backlog-cmd-typewriter" aria-label="Available commands"></span>
					</div>
				</div>
				<div class="backlog-content-wrapper">
					<div class="backlog-content">
						<!-- Viewer Tasks Section -->
						<div class="streamer-tasks-container" role="list" aria-label="Viewer tasks"></div>

						<div class="backlog-list-header" role="heading" aria-level="4">Streamer Backlog</div>
						<div class="backlog-list backlog-list-primary" role="list" aria-label="Streamer backlog items"></div>
						<div class="backlog-list backlog-list-secondary" role="list" aria-hidden="true"></div>
						<div class="backlog-empty" role="status" aria-live="polite">
							<p>No tasks in backlog</p>
							<p class="backlog-hint">Broadcaster: use !backlog add [task]</p>
						</div>
					</div>
				</div>
			</div>
		`;

		// Add event listeners
		this.#containerEl
			.querySelector('.backlog-clear-btn')
			.addEventListener('click', () => this.clearCompleted());

		// Initialize typewriter animation
		this.#initTypewriter();
	}

	/**
	 * Initialize typewriter animation for command hints
	 */
	#initTypewriter() {
		const commands = [
			'!backlog add [task]',
			'!backlog add task1, task2',
			'!backlog done 1, 2, 3',
			'!backlog edit 1 New task, 2 Another task',
			'!backlog remove 1, 2',
			'!backlog clear'
		];

		const typewriterEl = this.#containerEl.querySelector('.backlog-cmd-typewriter');
		if (!typewriterEl) return;

		let commandIndex = 0;
		let charIndex = 0;
		let isDeleting = false;
		let isPaused = false;

		const type = () => {
			const currentCommand = commands[commandIndex];

			if (isPaused) {
				setTimeout(() => {
					isPaused = false;
					isDeleting = true;
					type();
				}, 2000); // Pause for 2 seconds before deleting
				return;
			}

			if (!isDeleting) {
				// Typing
				typewriterEl.textContent = currentCommand.substring(0, charIndex + 1);
				charIndex++;

				if (charIndex === currentCommand.length) {
					isPaused = true;
				}

				setTimeout(type, isPaused ? 0 : 80); // Typing speed
			} else {
				// Deleting
				typewriterEl.textContent = currentCommand.substring(0, charIndex - 1);
				charIndex--;

				if (charIndex === 0) {
					isDeleting = false;
					commandIndex = (commandIndex + 1) % commands.length;
					setTimeout(type, 500); // Pause before typing next command
				} else {
					setTimeout(type, 40); // Deleting speed (faster)
				}
			}
		};

		// Start the animation
		type();
	}

	/**
	 * Add item to backlog
	 * @param {string} description - Task description
	 * @param {string} creator - Username of the task creator
	 * @param {number} priority - Priority (1-5, default 3)
	 * @returns {Object|null} Created item or null if failed
	 */
	addItem(description, creator = 'Unknown', priority = 3) {
		if (this.#backlogItems.length >= this.#maxItems) {
			console.warn('Backlog is full');
			return null;
		}

		// Escape all user input to prevent XSS attacks
		const item = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			description: this.#escapeHtml(description),
			creator: this.#escapeHtml(creator),
			priority: Math.max(1, Math.min(5, priority)),
			completed: false,
			createdAt: new Date().toISOString()
		};

		this.#backlogItems.push(item);
		this.#sortBacklog();
		this.#saveToStorage();
		this.render();

		return item;
	}

	/**
	 * Edit a backlog item description
	 * @param {string} itemId - Item ID to edit
	 * @param {string} description - New task description
	 * @returns {boolean} Success status
	 */
	editItem(itemId, description) {
		const item = this.#backlogItems.find(backlogItem => backlogItem.id === itemId);
		if (!item) return false;

		item.description = this.#escapeHtml(description);
		this.#saveToStorage();
		this.render();
		return true;
	}

	/**
	 * Remove item from backlog
	 * @param {string} itemId - Item ID to remove
	 * @returns {boolean} Success status
	 */
	removeItem(itemId) {
		const index = this.#backlogItems.findIndex(item => item.id === itemId);
		if (index === -1) return false;

		this.#backlogItems.splice(index, 1);
		this.#saveToStorage();
		this.render();
		return true;
	}

	/**
	 * Toggle item completion
	 * @param {string} itemId - Item ID to toggle
	 * @returns {boolean} Success status
	 */
	toggleComplete(itemId) {
		const item = this.#backlogItems.find(item => item.id === itemId);
		if (!item) return false;

		item.completed = !item.completed;
		this.#saveToStorage();
		this.render();
		return true;
	}

	/**
	 * Update item priority
	 * @param {string} itemId - Item ID
	 * @param {number} priority - New priority (1-5)
	 * @returns {boolean} Success status
	 */
	setPriority(itemId, priority) {
		const item = this.#backlogItems.find(item => item.id === itemId);
		if (!item) return false;

		item.priority = Math.max(1, Math.min(5, priority));
		this.#sortBacklog();
		this.#saveToStorage();
		this.render();
		return true;
	}

	/**
	 * Clear completed items
	 * @returns {number} Number of items cleared
	 */
	clearCompleted() {
		const initialLength = this.#backlogItems.length;
		this.#backlogItems = this.#backlogItems.filter(item => !item.completed);
		const clearedCount = initialLength - this.#backlogItems.length;

		if (clearedCount > 0) {
			this.#saveToStorage();
			this.render();
		}

		return clearedCount;
	}

	/**
	 * Clear all items (regardless of completion)
	 * @returns {number} Number of items cleared
	 */
	clearAll() {
		const count = this.#backlogItems.length;
		this.#backlogItems = [];

		if (count > 0) {
			this.#saveToStorage();
			this.render();
		}

		return count;
	}

	/**
	 * Get all backlog items
	 * @returns {Array} Backlog items
	 */
	getItems() {
		return [...this.#backlogItems];
	}

	/**
	 * Get item by index (1-based for user commands)
	 * @param {number} index - 1-based index
	 * @returns {Object|null} Item or null
	 */
	getItemByIndex(index) {
		return this.#backlogItems[index - 1] || null;
	}

	/**
	 * Get all items created by a specific user
	 * @param {string} username - The username to filter by (case-insensitive)
	 * @returns {Array} Items created by the user
	 */
	getItemsByUser(username) {
		const lowerUsername = username.toLowerCase();
		return this.#backlogItems.filter(
			item => item.creator && item.creator.toLowerCase() === lowerUsername
		);
	}

	/**
	 * Get a user's item by their own 1-based index (relative to their own items)
	 * @param {string} username - The username
	 * @param {number} index - 1-based index within the user's own items
	 * @returns {Object|null} Item or null
	 */
	getUserItemByIndex(username, index) {
		const userItems = this.getItemsByUser(username);
		return userItems[index - 1] || null;
	}

	/**
	 * Sort backlog by priority (high to low) then by date
	 */
	#sortBacklog() {
		this.#backlogItems.sort((a, b) => {
			// Completed items go to bottom
			if (a.completed !== b.completed) {
				return a.completed ? 1 : -1;
			}
			// Higher priority first
			if (a.priority !== b.priority) {
				return b.priority - a.priority;
			}
			// Older items first
			return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
		});
	}

	/**
	 * Render the backlog panel
	 */
	render() {
		const primaryListEl = this.#containerEl.querySelector('.backlog-list-primary');
		const secondaryListEl = this.#containerEl.querySelector('.backlog-list-secondary');
		const emptyEl = this.#containerEl.querySelector('.backlog-empty');
		const countEl = this.#containerEl.querySelector('.backlog-count');
		const panelEl = this.#containerEl.querySelector('.backlog-panel');
		const streamerContainer = this.#containerEl.querySelector('.streamer-tasks-container');

		// Update count
		const activeCount = this.#backlogItems.filter(item => !item.completed).length;
		countEl.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''}`;

		// Notify listeners first so integrated viewer tasks stay current.
		if (this.#onRefresh) {
			this.#onRefresh();
		}

		// Count viewer tasklist items and broadcaster backlog items.
		const viewerTaskCount = streamerContainer ? streamerContainer.querySelectorAll('.task').length : 0;
		const backlogTaskCount = this.#backlogItems.length;
		
		// Calculate total visible tasks
		const totalVisibleTasks = viewerTaskCount + backlogTaskCount;
		
		// Max visible without scrolling: 3 viewer tasks + 5 backlog items = 8 total
		const maxViewerVisible = 3;
		const maxBacklogVisible = 5;
		const maxTotalVisible = maxViewerVisible + maxBacklogVisible;

		// Apply dynamic sizing classes based on all visible content.
		panelEl.classList.remove('minimized', 'few-items', 'medium-content', 'expanded');

		if (totalVisibleTasks === 0) {
			panelEl.classList.add('minimized');
			primaryListEl.classList.add('hidden');
			secondaryListEl.classList.add('hidden');
			emptyEl.classList.remove('hidden');
		} else if (totalVisibleTasks <= 3) {
			// Very few items - minimal size
			panelEl.classList.add('few-items');
			primaryListEl.classList.remove('hidden');
			emptyEl.classList.add('hidden');
		} else if (totalVisibleTasks <= maxTotalVisible) {
			// Medium content - show all without scrolling
			panelEl.classList.add('medium-content');
			primaryListEl.classList.remove('hidden');
			emptyEl.classList.add('hidden');
		} else {
			// Expanded - scrolling will be active
			panelEl.classList.add('expanded');
			primaryListEl.classList.remove('hidden');
			emptyEl.classList.add('hidden');
		}

		// Render items in both containers
		const itemsHtml = this.#backlogItems
			.map((item, index) => this.#renderItem(item, index + 1))
			.join('');

		primaryListEl.innerHTML = itemsHtml;
		secondaryListEl.innerHTML = itemsHtml;

		// Add event listeners to both containers
		this.#addEventListeners(primaryListEl);
		this.#addEventListeners(secondaryListEl);

		// Start scroll animation if needed (only when exceeding visible limits)
		setTimeout(() => this.#updateScrollAnimation(), 100);
	}

	/**
	 * Add event listeners to a list element
	 * @param {Element} listEl - List element
	 */
	#addEventListeners(listEl) {
		listEl.querySelectorAll('.backlog-item-check').forEach(el => {
			el.addEventListener('click', (e) => {
				const target = /** @type {HTMLElement} */ (e.target);
				const itemEl = /** @type {HTMLElement} */ (target.closest('.backlog-item'));
				if (itemEl && itemEl.dataset) {
					this.toggleComplete(itemEl.dataset.id);
				}
			});
		});

		listEl.querySelectorAll('.backlog-item-delete').forEach(el => {
			el.addEventListener('click', (e) => {
				const target = /** @type {HTMLElement} */ (e.target);
				const itemEl = /** @type {HTMLElement} */ (target.closest('.backlog-item'));
				if (itemEl && itemEl.dataset) {
					this.removeItem(itemEl.dataset.id);
				}
			});
		});
	}

	/**
	 * Update scroll animation based on item count
	 */
	#updateScrollAnimation() {
		const primaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.backlog-list-primary'));
		const secondaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.backlog-list-secondary'));
		const streamerContainer = this.#containerEl.querySelector('.streamer-tasks-container');

		if (!primaryList) return;

		// Count viewer tasklist items and broadcaster backlog items.
		const viewerTaskCount = streamerContainer ? streamerContainer.querySelectorAll('.task').length : 0;
		const backlogTaskCount = this.#backlogItems.length;
		const totalTasks = viewerTaskCount + backlogTaskCount;
		
		// Max visible without scrolling: 3 viewer tasks + 5 backlog items = 8 total
		const maxTotalVisible = 8;

		// Only start scrolling if we have MORE than the max visible items
		if (totalTasks > maxTotalVisible && !this.#isScrolling) {
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
		const primaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.backlog-list-primary'));
		const secondaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.backlog-list-secondary'));

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
		const content = this.#containerEl.querySelector('.backlog-content');
		if (content) {
			content.classList.add('scrolling');
		}
	}

	/**
	 * Stop scroll animation
	 */
	#stopScrollAnimation() {
		const primaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.backlog-list-primary'));
		const secondaryList = /** @type {HTMLElement} */ (this.#containerEl.querySelector('.backlog-list-secondary'));

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
		const content = this.#containerEl.querySelector('.backlog-content');
		if (content) {
			content.classList.remove('scrolling');
		}
	}

	/**
	 * Render a single backlog item
	 * @param {Object} item - Backlog item
	 * @param {number} index - Display index (1-based)
	 * @returns {string} HTML string
	 */
	#renderItem(item, index) {
		const checkIcon = item.completed ? '✅' : '⬜';
		const creatorName = item.creator || 'Unknown';
		const statusText = item.completed ? 'completed' : 'not completed';

		return `
			<div class="backlog-item ${item.completed ? 'completed' : ''}" data-id="${item.id}" role="listitem" aria-label="Task ${index}: ${item.description}, created by ${creatorName}, ${statusText}">
				<div class="backlog-item-header">
					<span class="backlog-item-index" aria-hidden="true">${index}.</span>
					<span class="backlog-item-creator" title="Created by ${creatorName}">@${creatorName}</span>
				</div>
				<div class="backlog-item-body">
					<button class="backlog-item-check" title="${item.completed ? 'Mark incomplete' : 'Mark complete'}" aria-label="${item.completed ? 'Mark task as incomplete' : 'Mark task as complete'}">
						<span aria-hidden="true">${checkIcon}</span>
					</button>
					<span class="backlog-item-text">${item.description}</span>
				</div>
				<button class="backlog-item-delete" title="Delete" aria-label="Delete task ${index}" aria-describedby="task-${item.id}">
					<span aria-hidden="true">🗑️</span>
				</button>
			</div>
		`;
	}

	/**
	 * Save backlog to localStorage with quota handling
	 */
	#saveToStorage() {
		try {
			localStorage.setItem(this.#storageKey, JSON.stringify(this.#backlogItems));
		} catch (error) {
			if (error.name === 'QuotaExceededError') {
				console.warn('Storage quota exceeded, attempting cleanup...');
				// Try to clear completed items first
				const clearedCount = this.clearCompleted();
				if (clearedCount > 0) {
					console.warn(`Cleared ${clearedCount} completed items, retrying save...`);
					try {
						localStorage.setItem(this.#storageKey, JSON.stringify(this.#backlogItems));
						return;
					} catch (retryError) {
						console.error('Still unable to save after cleanup:', retryError);
					}
				}
				// If still failing, remove oldest items
				if (this.#backlogItems.length > 10) {
					const removedCount = Math.floor(this.#backlogItems.length / 4);
					this.#backlogItems.splice(0, removedCount);
					console.warn(`Removed ${removedCount} oldest items, retrying save...`);
					try {
						localStorage.setItem(this.#storageKey, JSON.stringify(this.#backlogItems));
						return;
					} catch (retryError) {
						console.error('Unable to save even after removing old items:', retryError);
					}
				}
				console.error('Failed to save backlog: storage quota exceeded and cleanup failed');
			} else {
				console.error('Failed to save backlog:', error);
			}
		}
	}

	/**
	 * Load backlog from localStorage
	 */
	#loadFromStorage() {
		try {
			const stored = localStorage.getItem(this.#storageKey);
			if (stored) {
				this.#backlogItems = JSON.parse(stored);
				this.#sortBacklog();
			}
		} catch (error) {
			console.error('Failed to load backlog:', error);
			this.#backlogItems = [];
		}
	}
}
