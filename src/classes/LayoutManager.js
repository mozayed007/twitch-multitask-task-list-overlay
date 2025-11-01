const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

const PANEL_META = {
	timer: { id: 'timer-container', defaultDisplay: 'flex' },
	taskList: { id: 'task-list-container', defaultDisplay: 'block' },
	backlog: { id: 'backlog-container', defaultDisplay: 'block' },
	infoPanel: { id: 'info-panel-container', defaultDisplay: 'block' }
};

const DEFAULT_PADDING = 30;

/**
 * LayoutManager - Manages layout presets, panel positioning, and persistence
 * @class LayoutManager
 */
export default class LayoutManager {
	#layouts = {
		compact: {
			name: 'Compact',
			description: 'Timer and tasks in a tight side-by-side layout',
			container: { padding: 40 },
			components: {
				timer: {
					enabled: true,
					display: 'flex',
					position: { top: 120, left: 80 },
					size: { width: 320, height: 320, minWidth: 280 }
				},
				taskList: {
					enabled: true,
					position: { top: 100, left: 460 },
					size: { width: 700, minWidth: 520, minHeight: 420 }
				},
				backlog: { enabled: false },
				infoPanel: { enabled: false }
			}
		},
		split: {
			name: 'Split View',
			description: 'Timer left, tasks center, backlog right',
			container: { padding: 40 },
			components: {
				timer: {
					enabled: true,
					display: 'flex',
					position: { top: 120, left: 80 },
					size: { width: 320, height: 320 }
				},
				taskList: {
					enabled: true,
					position: { top: 100, left: 440 },
					size: { width: 640, minHeight: 480 }
				},
				backlog: {
					enabled: true,
					position: { top: 100, left: 1120 },
					size: { width: 360, minHeight: 420 }
				},
				infoPanel: { enabled: false }
			}
		},
		fullOverlay: {
			name: 'Full Overlay',
			description: 'Balanced dashboard with all panels visible',
			container: { padding: 32 },
			components: {
				timer: {
					enabled: true,
					display: 'flex',
					position: { top: 60, left: 780 },
					size: { width: 360, height: 360 }
				},
				taskList: {
					enabled: true,
					position: { top: 460, left: 680 },
					size: { width: 560, minHeight: 420 }
				},
				backlog: {
					enabled: true,
					position: { top: 460, left: 80 },
					size: { width: 520, minHeight: 420 }
				},
				infoPanel: {
					enabled: true,
					position: { top: 460, left: 1320 },
					size: { width: 520, minHeight: 420 }
				}
			}
		},
		minimal: {
			name: 'Minimal',
			description: 'Single timer focus for clean scenes',
			container: { padding: 60 },
			components: {
				timer: {
					enabled: true,
					display: 'flex',
					position: { top: 320, left: 820 },
					size: { width: 320, height: 320 }
				},
				taskList: { enabled: false },
				backlog: { enabled: false },
				infoPanel: { enabled: false }
			}
		},
		timerWithTasks: {
			name: 'Timer + Tasks',
			description: 'Timer stacked above active tasks',
			container: { padding: 40 },
			components: {
				timer: {
					enabled: true,
					display: 'flex',
					position: { top: 100, left: 760 },
					size: { width: 360, height: 360 }
				},
				taskList: {
					enabled: true,
					position: { top: 520, left: 700 },
					size: { width: 520, minHeight: 420 }
				},
				backlog: { enabled: false },
				infoPanel: { enabled: false }
			}
		},
		dashboard: {
			name: 'Productivity Dashboard',
			description: 'Comprehensive layout for work and study streams',
			container: { padding: 36 },
			components: {
				timer: {
					enabled: true,
					display: 'flex',
					position: { top: 80, left: 80 },
					size: { width: 320, height: 320 }
				},
				taskList: {
					enabled: true,
					position: { top: 80, left: 460 },
					size: { width: 720, minHeight: 480 }
				},
				backlog: {
					enabled: true,
					position: { top: 620, left: 80 },
					size: { width: 420, minHeight: 360 }
				},
				infoPanel: {
					enabled: true,
					position: { top: 620, left: 1260 },
					size: { width: 580, minHeight: 360 }
				}
			}
		}
	};

	#currentLayout = 'compact';
	#containerEl;
	#panelPositions = {};
	#positionsKey = 'enhancedOverlay.panelPositions.v2';

	/**
	 * @constructor
	 * @param {string} containerId - ID of the main container
	 */
	constructor(containerId) {
		this.#containerEl = document.getElementById(containerId);
		if (!this.#containerEl) {
			console.error(`Layout container "${containerId}" not found`);
			return;
		}

		this.#panelPositions = this.#loadPanelPositions();

		// Load saved layout or use default
		const savedLayout = localStorage.getItem('currentLayout') || 'compact';
		this.applyLayout(savedLayout);
	}

	/**
	 * Apply a layout by name
	 * @param {string} layoutName - Name of the layout to apply
	 * @returns {boolean} Success status
	 */
	applyLayout(layoutName) {
		if (!this.#layouts[layoutName]) {
			console.error(`Layout "${layoutName}" not found`);
			return false;
		}

		this.#currentLayout = layoutName;
		const layout = this.#layouts[layoutName];

		// Save to localStorage
		localStorage.setItem('currentLayout', layoutName);
		this.#containerEl.dataset.layout = layoutName;

		this.#resetContainerStyles();
		this.#applyContainerStyles(layout.container);
		this.#positionComponents(layoutName, layout.components);

		// Emit layout change event
		window.dispatchEvent(new CustomEvent('layoutChanged', {
			detail: { layoutName, layout }
		}));

		return true;
	}

	/**
	 * Save a panel position to localStorage
	 * @param {string} layoutName
	 * @param {string} component
	 * @param {{left:number, top:number}} position
	 */
	savePanelPosition(layoutName, component, position) {
		if (!this.#panelPositions[layoutName]) {
			this.#panelPositions[layoutName] = {};
		}
		const basePosition = this.#toBasePosition(position);
		this.#panelPositions[layoutName][component] = {
			left: Math.round(basePosition.left),
			top: Math.round(basePosition.top)
		};
		this.#persistPanelPositions();
	}

	/**
	 * Reset saved positions for a component within a layout
	 * @param {string} component
	 * @param {string} [layoutName]
	 * @returns {boolean}
	 */
	resetPanelPosition(component, layoutName = this.#currentLayout) {
		if (!this.#panelPositions[layoutName]) {
			return false;
		}
		if (component) {
			if (this.#panelPositions[layoutName][component]) {
				delete this.#panelPositions[layoutName][component];
				this.#persistPanelPositions();
				this.applyLayout(layoutName);
				return true;
			}
			return false;
		}
		delete this.#panelPositions[layoutName];
		this.#persistPanelPositions();
		this.applyLayout(layoutName);
		return true;
	}

	/**
	 * Reset all stored positions for a given layout
	 * @param {string} layoutName
	 * @returns {boolean}
	 */
	resetLayoutPositions(layoutName) {
		return this.resetPanelPosition(undefined, layoutName);
	}

	/**
	 * Get available layouts
	 * @returns {Array<{name: string, displayName: string, description: string}>}
	 */
	getAvailableLayouts() {
		return Object.entries(this.#layouts).map(([key, layout]) => ({
			name: key,
			displayName: layout.name,
			description: layout.description
		}));
	}

	/**
	 * Get current layout name
	 * @returns {string}
	 */
	getCurrentLayout() {
		return this.#currentLayout;
	}

	/**
	 * Get default position for a component in a layout
	 * @param {string} layoutName
	 * @param {string} component
	 * @returns {{top:number,left:number}|null}
	 */
	getDefaultPosition(layoutName, component) {
		const layout = this.#layouts[layoutName];
		return layout?.components?.[component]?.position ?? null;
	}

	/**
	 * Create layout selector UI
	 * @returns {HTMLElement} Layout selector element
	 */
	createLayoutSelector() {
		const selector = document.createElement('div');
		selector.className = 'layout-selector glass-effect';
		selector.innerHTML = `
			<div class="layout-selector-header">
				<h4>Layout Presets</h4>
				<button class="layout-close-btn">×</button>
			</div>
			<div class="layout-options">
				${this.getAvailableLayouts().map(layout => `
					<button 
						class="layout-option ${layout.name === this.#currentLayout ? 'active' : ''}"
						data-layout="${layout.name}"
					>
						<div class="layout-option-name">${layout.displayName}</div>
						<div class="layout-option-desc">${layout.description}</div>
					</button>
				`).join('')}
			</div>
		`;

		selector.querySelectorAll('.layout-option').forEach(btn => {
			btn.addEventListener('click', () => {
				const buttonEl = /** @type {HTMLElement} */ (btn);
				const layoutName = buttonEl.dataset.layout;
				this.applyLayout(layoutName);
				selector.querySelectorAll('.layout-option').forEach(b => b.classList.remove('active'));
				buttonEl.classList.add('active');
			});
		});

		selector.querySelector('.layout-close-btn').addEventListener('click', () => {
			selector.remove();
		});

		return selector;
	}

	#resetContainerStyles() {
		const style = this.#containerEl.style;
		style.display = 'block';
		style.gridTemplateColumns = '';
		style.gridTemplateRows = '';
		style.justifyContent = '';
		style.alignItems = '';
		style.maxWidth = '';
		style.height = '';
		style.gap = '';
		style.position = 'fixed';
		style.top = '0';
		style.left = '0';
		style.width = '100%';
		style.height = '100%';
		style.padding = `${DEFAULT_PADDING}px`;
		style.boxSizing = 'border-box';
		style.overflow = 'visible';
	}

	#applyContainerStyles(containerStyles = {}) {
		if (!containerStyles) return;
		const style = this.#containerEl.style;
		if (typeof containerStyles.padding === 'number') {
			style.padding = `${containerStyles.padding}px`;
		}
	}

	#positionComponents(layoutName, components) {
		const { scaleX, scaleY } = this.#getScaleFactors();
		const containerRect = this.#containerEl.getBoundingClientRect();
		Object.values(PANEL_META).forEach(({ id }) => {
			const el = document.getElementById(id);
			if (el) {
				el.style.display = 'none';
				el.removeAttribute('aria-hidden');
			}
		});

		Object.entries(components).forEach(([componentKey, config]) => {
			const meta = PANEL_META[componentKey];
			if (!meta) return;
			const element = document.getElementById(meta.id);
			if (!element) return;

			if (!config?.enabled) {
				element.style.display = 'none';
				element.setAttribute('aria-hidden', 'true');
				return;
			}

			element.style.display = config.display || meta.defaultDisplay;
			element.classList.add('draggable-panel');
			element.style.position = 'absolute';
			element.style.zIndex = config.zIndex ?? 10;
			element.dataset.panel = componentKey;
			element.style.transform = 'none';
			
			// Debug: Log panel setup
			console.log(`Setting up panel ${componentKey}:`, {
				display: element.style.display,
				position: element.style.position,
				left: element.style.left,
				top: element.style.top,
				class: element.className
			});

			this.#applyPanelSize(element, config.size);

			const saved = this.#getSavedPosition(layoutName, componentKey);
			const position = saved ?? config.position;
			if (position) {
				const actualPosition = this.#toActualPosition(position, scaleX, scaleY);
				const clampedPosition = this.#clampPosition(actualPosition, element, containerRect);
				element.style.left = `${Math.round(clampedPosition.left)}px`;
				element.style.top = `${Math.round(clampedPosition.top)}px`;
				const basePosition = this.#toBasePosition(clampedPosition);
				element.dataset.baseLeft = `${basePosition.left}`;
				element.dataset.baseTop = `${basePosition.top}`;
			}
		});
	}

	#applyPanelSize(element, size = {}) {
		const props = ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'];
		props.forEach(prop => {
			if (size[prop] !== undefined) {
				element.style[prop] = `${size[prop]}px`;
			} else {
				element.style[prop] = '';
			}
		});
	}

	#getSavedPosition(layoutName, component) {
		return this.#panelPositions[layoutName]?.[component] ?? null;
	}

	#getScaleFactors() {
		if (!this.#containerEl) {
			return { scaleX: 1, scaleY: 1 };
		}
		// Use 1:1 scale since we're working at native 1920x1080
		// The positions in layouts are already defined for this resolution
		const scaleX = 1;
		const scaleY = 1;
		console.log('Using 1:1 scale for 1920x1080 resolution');
		return { scaleX, scaleY };
	}

	#toActualPosition(position, scaleX, scaleY) {
		return {
			left: position.left * scaleX,
			top: position.top * scaleY
		};
	}

	#clampPosition(position, element, containerRect) {
		const elementRect = element.getBoundingClientRect();
		const elementWidth = elementRect.width || element.offsetWidth || 0;
		const elementHeight = elementRect.height || element.offsetHeight || 0;
		const maxLeft = Math.max(0, containerRect.width - elementWidth);
		const maxTop = Math.max(0, containerRect.height - elementHeight);
		return {
			left: Math.max(0, Math.min(maxLeft, position.left)),
			top: Math.max(0, Math.min(maxTop, position.top))
		};
	}

	#toBasePosition(position) {
		const { scaleX, scaleY } = this.#getScaleFactors();
		return {
			left: position.left / scaleX,
			top: position.top / scaleY
		};
	}

	/**
	 * Convert actual position (px) to base resolution coordinates
	 * @param {{left:number, top:number}} position
	 * @returns {{left:number, top:number}}
	 */
	convertToBasePosition(position) {
		return this.#toBasePosition(position);
	}

	/**
	 * Refresh current layout (useful after resize)
	 */
	refreshLayout() {
		this.applyLayout(this.#currentLayout);
	}

	#loadPanelPositions() {
		try {
			const raw = localStorage.getItem(this.#positionsKey);
			return raw ? JSON.parse(raw) : {};
		} catch (error) {
			console.warn('Failed to load saved panel positions', error);
			return {};
		}
	}

	#persistPanelPositions() {
		try {
			localStorage.setItem(this.#positionsKey, JSON.stringify(this.#panelPositions));
		} catch (error) {
			console.warn('Failed to persist panel positions', error);
		}
	}
}
