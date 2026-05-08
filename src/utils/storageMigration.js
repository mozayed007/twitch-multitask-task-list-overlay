/**
 * Storage Migration Utility
 * Handles schema versioning and data migration for localStorage
 */

const CURRENT_SCHEMA_VERSION = 2;
const STORAGE_VERSION_KEY = 'app.storageVersion';

/**
 * Get the current storage schema version
 * @returns {number} The current schema version
 */
export function getStorageVersion() {
	try {
		const version = localStorage.getItem(STORAGE_VERSION_KEY);
		return version ? parseInt(version, 10) : 1;
	} catch (error) {
		console.warn('Failed to get storage version:', error);
		return 1;
	}
}

/**
 * Set the current storage schema version
 * @param {number} version - The schema version to set
 */
export function setStorageVersion(version) {
	try {
		localStorage.setItem(STORAGE_VERSION_KEY, version.toString());
	} catch (error) {
		console.warn('Failed to set storage version:', error);
	}
}

/**
 * Check if migration is needed
 * @returns {boolean} True if migration is needed
 */
export function needsMigration() {
	return getStorageVersion() < CURRENT_SCHEMA_VERSION;
}

/**
 * Run migrations if needed
 * @returns {boolean} True if migration was successful
 */
export function runMigrations() {
	if (!needsMigration()) {
		return true;
	}

	const currentVersion = getStorageVersion();
	console.log(`Running storage migration from version ${currentVersion} to ${CURRENT_SCHEMA_VERSION}`);

	try {
		// Migration from version 1 to 2
		if (currentVersion < 2) {
			migrateToV2();
		}

		// Add future migrations here
		// if (currentVersion < 3) {
		//     migrateToV3();
		// }

		setStorageVersion(CURRENT_SCHEMA_VERSION);
		console.log('Storage migration completed successfully');
		return true;
	} catch (error) {
		console.error('Storage migration failed:', error);
		return false;
	}
}

/**
 * Migration to version 2
 * - Add XSS escaping to existing data
 * - Clean up malformed data
 */
function migrateToV2() {
	console.log('Migrating to version 2...');

	// Migrate backlog items
	try {
		const backlogData = localStorage.getItem('taskBacklog');
		if (backlogData) {
			const items = JSON.parse(backlogData);
			const migratedItems = items.map(item => ({
				...item,
				description: escapeHtml(item.description || ''),
				creator: escapeHtml(item.creator || 'Unknown')
			}));
			localStorage.setItem('taskBacklog', JSON.stringify(migratedItems));
		}
	} catch (error) {
		console.warn('Failed to migrate backlog data:', error);
	}

	// Migrate viewer profiles
	try {
		const viewerData = localStorage.getItem('viewerProfiles');
		if (viewerData) {
			const data = JSON.parse(viewerData);
			const migratedData = data.map(([username, viewer]) => [
				escapeHtml(username),
				{
					...viewer,
					username: escapeHtml(viewer.username || username),
					info: Object.fromEntries(
						Object.entries(viewer.info || {}).map(([key, value]) => [
							escapeHtml(key),
							escapeHtml(value)
						])
					)
				}
			]);
			localStorage.setItem('viewerProfiles', JSON.stringify(migratedData));
		}
	} catch (error) {
		console.warn('Failed to migrate viewer data:', error);
	}

	// Migrate user list
	try {
		const userListData = localStorage.getItem('userList');
		if (userListData) {
			const users = JSON.parse(userListData);
			const migratedUsers = users.map(user => ({
				...user,
				username: escapeHtml(user.username || ''),
				tasks: (user.tasks || []).map(task => ({
					...task,
					description: escapeHtml(task.description || '')
				}))
			}));
			localStorage.setItem('userList', JSON.stringify(migratedUsers));
		}
	} catch (error) {
		console.warn('Failed to migrate user list data:', error);
	}

	console.log('Migration to version 2 completed');
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
	if (typeof text !== 'string') return text;
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Clear all storage data (useful for testing or reset)
 */
export function clearAllStorage() {
	try {
		const keys = Object.keys(localStorage);
		keys.forEach(key => {
			if (key.startsWith('taskBacklog') ||
				key.startsWith('viewerProfiles') ||
				key.startsWith('userList') ||
				key.startsWith('pomoTimer') ||
				key.startsWith('overlay.goal') ||
				key.startsWith('currentLayout') ||
				key.startsWith('currentTheme') ||
				key.startsWith('enhancedOverlay')) {
				localStorage.removeItem(key);
			}
		});
		setStorageVersion(CURRENT_SCHEMA_VERSION);
		console.log('All storage data cleared');
	} catch (error) {
		console.error('Failed to clear storage:', error);
	}
}