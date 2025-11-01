/**
 * ThemeManager - Handles theme loading and switching
 * @class ThemeManager
 */
export default class ThemeManager {
	#themes = {};
	#currentTheme = null;
	#themeData = null;

	/**
	 * @constructor
	 */
	constructor() {
		this.#loadThemes();
	}

	/**
	 * Load themes from themes.json
	 */
	async #loadThemes() {
		try {
			const response = await fetch('./themes.json');
			this.#themeData = await response.json();
			this.#themes = this.#themeData.themes;
			
			// Load saved theme or default
			const savedTheme = localStorage.getItem('currentTheme') || this.#themeData.defaultTheme;
			this.applyTheme(savedTheme);
		} catch (error) {
			console.error('Failed to load themes:', error);
		}
	}

	/**
	 * Apply a theme by name
	 * @param {string} themeName - Name of the theme to apply
	 * @returns {boolean} - Success status
	 */
	applyTheme(themeName) {
		if (!this.#themes[themeName]) {
			console.error(`Theme "${themeName}" not found`);
			return false;
		}

		const theme = this.#themes[themeName];
		this.#currentTheme = themeName;
		
		// Save to localStorage
		localStorage.setItem('currentTheme', themeName);

		// Apply CSS variables
		this.#applyCSSVariables(theme);
		
		// Load theme fonts
		this.#loadFonts(theme.fonts);

		// Emit theme change event
		window.dispatchEvent(new CustomEvent('themeChanged', { 
			detail: { themeName, theme } 
		}));

		return true;
	}

	/**
	 * Apply CSS custom properties from theme
	 * @param {Object} theme - Theme object
	 */
	#applyCSSVariables(theme) {
		const root = document.documentElement;
		const { colors, effects } = theme;

		// Colors
		root.style.setProperty('--color-primary', colors.primary);
		root.style.setProperty('--color-secondary', colors.secondary);
		root.style.setProperty('--color-accent', colors.accent);
		root.style.setProperty('--color-text', colors.text);
		root.style.setProperty('--color-text-secondary', colors.textSecondary);
		root.style.setProperty('--color-card-bg', colors.cardBg);
		root.style.setProperty('--color-card-border', colors.cardBorder);
		root.style.setProperty('--color-timer-ring', colors.timerRing);
		root.style.setProperty('--color-timer-bg', colors.timerBg);
		root.style.setProperty('--color-task-done', colors.taskDone);
		root.style.setProperty('--color-task-focus', colors.taskFocus);
		root.style.setProperty('--shadow', colors.shadow);

		// Background (handle gradients)
		if (colors.background.includes('gradient')) {
			root.style.setProperty('--background', colors.background);
		} else {
			root.style.setProperty('--background', colors.background);
		}
		root.style.setProperty('--background-overlay', colors.backgroundOverlay);

		// Effects
		root.style.setProperty('--blur', effects.blur);
		root.style.setProperty('--border-radius', effects.borderRadius);
		root.style.setProperty('--card-radius', effects.cardRadius);
	}

	/**
	 * Load Google Fonts for the theme
	 * @param {Object} fonts - Fonts object
	 */
	#loadFonts(fonts) {
		// @ts-ignore - WebFont is loaded via CDN in index.html
		if (typeof WebFont !== 'undefined') {
			// @ts-ignore - WebFont is loaded via CDN in index.html
			WebFont.load({
				google: {
					families: [
						`${fonts.primary}:300,400,600,700`,
						`${fonts.secondary}:300,400,500,700`
					]
				}
			});
		}

		// Apply font families to CSS variables
		const root = document.documentElement;
		root.style.setProperty('--font-primary', `'${fonts.primary}', sans-serif`);
		root.style.setProperty('--font-secondary', `'${fonts.secondary}', sans-serif`);
	}

	/**
	 * Get list of available themes
	 * @returns {Array<{name: string, displayName: string}>}
	 */
	getAvailableThemes() {
		return Object.entries(this.#themes).map(([key, theme]) => ({
			name: key,
			displayName: theme.name
		}));
	}

	/**
	 * Get current theme name
	 * @returns {string}
	 */
	getCurrentTheme() {
		return this.#currentTheme;
	}

	/**
	 * Get current theme data
	 * @returns {Object}
	 */
	getCurrentThemeData() {
		return this.#themes[this.#currentTheme];
	}
}
