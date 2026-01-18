/**
 * GoalPanel - Minimalist goal tracking component
 * @class GoalPanel
 */
export default class GoalPanel {
	#container;
	#goalData = {
		title: 'Stream Goal',
		current: 0,
		target: 100,
		active: false
	};
	#stateKey = 'overlay.goalData';

	constructor(containerId) {
		this.#container = document.getElementById(containerId);
		if (!this.#container) {
			console.error(`Goal container "${containerId}" not found`);
			return;
		}
		this.#loadState();
		this.#initializeUI();
	}

	#initializeUI() {
		this.#container.innerHTML = `
			<div class="goal-panel ${this.#goalData.active ? 'active' : 'hidden'}">
				<div class="goal-info">
					<span class="goal-title">${this.#goalData.title}</span>
					<span class="goal-progress-text">${this.#goalData.current} / ${this.#goalData.target}</span>
				</div>
				<div class="goal-bar-container">
					<div class="goal-bar-fill" style="width: ${this.#calculatePercentage()}%"></div>
				</div>
			</div>
		`;
	}

	#calculatePercentage() {
		if (this.#goalData.target <= 0) return 0;
		const percent = (this.#goalData.current / this.#goalData.target) * 100;
		return Math.min(Math.max(percent, 0), 100);
	}

	setGoal(title, target, current = 0) {
		this.#goalData = {
			title: title || 'Goal',
			target: typeof target === 'number' ? target : (parseInt(target) || 100),
			current: typeof current === 'number' ? current : (parseInt(current) || 0),
			active: true
		};
		this.#saveState();
		this.render();
	}

	updateProgress(amount) {
		const val = typeof amount === 'number' ? amount : (parseInt(amount) || 0);
		this.#goalData.current += val;
		if (this.#goalData.current < 0) this.#goalData.current = 0;
		this.#saveState();
		this.render();
	}

	reset() {
		this.#goalData.current = 0;
		this.#saveState();
		this.render();
	}

	hide() {
		this.#goalData.active = false;
		this.#saveState();
		this.render();
	}

	render() {
		if (!this.#container) return;
		
		const panel = this.#container.querySelector('.goal-panel');
		if (!panel) {
			this.#initializeUI();
			return;
		}

		if (this.#goalData.active) {
			panel.classList.remove('hidden');
			panel.classList.add('active');
		} else {
			panel.classList.add('hidden');
			panel.classList.remove('active');
		}

		const titleEl = panel.querySelector('.goal-title');
		const progressEl = panel.querySelector('.goal-progress-text');
		const fillEl = panel.querySelector('.goal-bar-fill');

		if (titleEl) titleEl.textContent = this.#goalData.title;
		if (progressEl) progressEl.textContent = `${this.#goalData.current} / ${this.#goalData.target}`;
		if (fillEl instanceof HTMLElement) {
			fillEl.style.width = `${this.#calculatePercentage()}%`;
		}
	}

	#saveState() {
		localStorage.setItem(this.#stateKey, JSON.stringify(this.#goalData));
	}

	#loadState() {
		const saved = localStorage.getItem(this.#stateKey);
		if (saved) {
			try {
				this.#goalData = JSON.parse(saved);
			} catch (e) {
				console.error("Failed to load goal state", e);
			}
		}
	}
}
