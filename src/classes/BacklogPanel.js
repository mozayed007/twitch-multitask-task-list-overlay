/**
 * BacklogPanel - Manages personal task backlog
 * @class BacklogPanel
 */
export default class BacklogPanel {
	#backlogItems = [];
	#containerId;
	#containerEl;
	#storageKey = 'taskBacklog';
	#maxItems = 50;

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
	 * Initialize panel HTML structure
	 */
	#initializePanel() {
		this.#containerEl.innerHTML = `
			<div class="backlog-panel">
				<div class="backlog-header">
					<div class="backlog-header-top">
						<h3 class="backlog-title">
							<span class="backlog-icon">📋</span>
							Task Backlog
						</h3>
						<div class="backlog-controls">
							<span class="backlog-count">0 tasks</span>
							<button class="backlog-btn backlog-clear-btn" title="Clear completed">
								<span>🗑️</span>
							</button>
						</div>
					</div>
					<div class="backlog-commands-hint">
						<span class="backlog-cmd-label">COMMANDS:</span>
						<span class="backlog-cmd-typewriter"></span>
					</div>
				</div>
				<div class="backlog-content">
					<div class="backlog-list"></div>
					<div class="backlog-empty">
						<p>No tasks in backlog</p>
						<p class="backlog-hint">Use !backlog add [task] to add tasks</p>
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
			'!backlog done #',
			'!backlog remove #',
			'!backlog clear (mods)'
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

		const item = {
			id: Date.now().toString(),
			description,
			creator,
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
		const listEl = this.#containerEl.querySelector('.backlog-list');
		const emptyEl = this.#containerEl.querySelector('.backlog-empty');
		const countEl = this.#containerEl.querySelector('.backlog-count');

		// Update count
		const activeCount = this.#backlogItems.filter(item => !item.completed).length;
		countEl.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''}`;

		// Show/hide empty state
		if (this.#backlogItems.length === 0) {
			listEl.classList.add('hidden');
			emptyEl.classList.remove('hidden');
			return;
		}

		listEl.classList.remove('hidden');
		emptyEl.classList.add('hidden');

		// Render items
		listEl.innerHTML = this.#backlogItems
			.map((item, index) => this.#renderItem(item, index + 1))
			.join('');

		// Add event listeners
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
	 * Render a single backlog item
	 * @param {Object} item - Backlog item
	 * @param {number} index - Display index (1-based)
	 * @returns {string} HTML string
	 */
	#renderItem(item, index) {
		const checkIcon = item.completed ? '✅' : '⬜';
		const creatorName = item.creator || 'Unknown';
		
		return `
			<div class="backlog-item ${item.completed ? 'completed' : ''}" data-id="${item.id}">
				<div class="backlog-item-header">
					<span class="backlog-item-index">${index}.</span>
					<span class="backlog-item-creator" title="Created by ${creatorName}">@${this.#escapeHtml(creatorName)}</span>
				</div>
				<div class="backlog-item-body">
					<button class="backlog-item-check" title="${item.completed ? 'Mark incomplete' : 'Mark complete'}">
						${checkIcon}
					</button>
					<span class="backlog-item-text">${this.#escapeHtml(item.description)}</span>
				</div>
				<button class="backlog-item-delete" title="Delete">🗑️</button>
			</div>
		`;
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
	 * Save backlog to localStorage
	 */
	#saveToStorage() {
		try {
			localStorage.setItem(this.#storageKey, JSON.stringify(this.#backlogItems));
		} catch (error) {
			console.error('Failed to save backlog:', error);
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
