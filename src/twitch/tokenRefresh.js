const TOKEN_STORAGE_KEY = "twitchAuthTokens";
const DEFAULT_REFRESH_URL_TEMPLATE = "http://127.0.0.1:8000/api/token/refresh/{refresh_token}";
const FALLBACK_REFRESH_URL_TEMPLATE = "https://twitchtokengenerator.com/api/refresh/{refresh_token}";
const MAX_REFRESH_ATTEMPTS = 3;
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;
const DEFAULT_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const memoryStorage = new Map();

function createMemoryStorage() {
	return {
		getItem: (key) => memoryStorage.get(key) || null,
		setItem: (key, value) => memoryStorage.set(key, value),
		removeItem: (key) => memoryStorage.delete(key),
	};
}

export function getTokenStorage() {
	try {
		if (window.localStorage) return window.localStorage;
	} catch (error) {
		console.warn("Browser storage is unavailable. Twitch tokens will not survive source refreshes.", error);
	}

	return createMemoryStorage();
}

/**
 * @typedef {Object} TokenState
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresAt
 */

/**
 * @param {Storage} storage
 * @returns {TokenState|null}
 */
export function readStoredTokenState(storage = getTokenStorage()) {
	try {
		const rawState = storage.getItem(TOKEN_STORAGE_KEY);
		return rawState ? JSON.parse(rawState) : null;
	} catch (error) {
		console.warn("Stored Twitch token state could not be read.", error);
		return null;
	}
}

/**
 * @param {TokenState} tokenState
 * @param {Storage} storage
 * @returns {void}
 */
export function saveTokenState(tokenState, storage = getTokenStorage()) {
	try {
		storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenState));
	} catch (error) {
		console.warn("Twitch token state could not be saved.", error);
	}
}

/**
 * @param {string} rawToken
 * @returns {string}
 */
function normalizeAccessToken(rawToken) {
	if (!rawToken) return "";
	return rawToken.startsWith("oauth:") ? rawToken : `oauth:${rawToken}`;
}

/**
 * @param {TokenState|null} tokenState
 * @param {number} [now]
 * @returns {boolean}
 */
export function isTokenExpired(tokenState, now = Date.now()) {
	if (!tokenState?.expiresAt) return false;
	return tokenState.expiresAt <= now + EXPIRY_BUFFER_MS;
}

/**
 * @param {Object} config
 * @param {string} config.twitch_oauth
 * @param {string} [config.twitch_refresh_token]
 * @param {string} [config.twitch_token_refresh_url]
 * @param {Storage} [storage]
 * @returns {{ accessToken: string, refreshToken: string, storedTokenState: TokenState|null, refreshUrlTemplate: string }}
 */
export function resolveTokenConfig(config, storage = getTokenStorage()) {
	const storedTokenState = readStoredTokenState(storage);
	const refreshToken = config.twitch_refresh_token || "";
	const configuredAccessToken = config.twitch_oauth || "";
	const accessToken = normalizeAccessToken(storedTokenState?.accessToken || configuredAccessToken);
	const refreshUrlTemplate = config.twitch_token_refresh_url || DEFAULT_REFRESH_URL_TEMPLATE;

	return {
		accessToken,
		refreshToken,
		storedTokenState,
		refreshUrlTemplate,
	};
}

/**
 * @param {string} template
 * @param {string} refreshToken
 * @returns {string}
 */
function buildRefreshUrl(template, refreshToken) {
	return template.replace("{refresh_token}", encodeURIComponent(refreshToken));
}

/**
 * @param {Object} options
 * @param {TwitchChat} options.client
 * @param {string} options.refreshToken
 * @param {string} [options.refreshUrlTemplate]
 * @param {Storage} [options.storage]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<TokenState>}
 */
export async function refreshTwitchToken({
	client,
	refreshToken,
	refreshUrlTemplate = DEFAULT_REFRESH_URL_TEMPLATE,
	storage = getTokenStorage(),
	fetchImpl = fetch,
}) {
	try {
		return await exchangeRefreshToken({
			client,
			refreshToken,
			refreshUrlTemplate,
			storage,
			fetchImpl,
		});
	} catch (error) {
		const isBackendRequest = refreshUrlTemplate.startsWith("http://127.0.0.1:8000/");
		if (isBackendRequest) {
			console.warn("Local backend refresh failed, trying direct refresh service:", error);
			return await exchangeRefreshToken({
				client,
				refreshToken,
				refreshUrlTemplate: FALLBACK_REFRESH_URL_TEMPLATE,
				storage,
				fetchImpl,
			});
		}
		throw error;
	}
}

/**
 * @param {Object} options
 * @param {TwitchChat} options.client
 * @param {string} options.refreshToken
 * @param {string} options.refreshUrlTemplate
 * @param {Storage} options.storage
 * @param {typeof fetch} options.fetchImpl
 * @returns {Promise<TokenState>}
 */
async function exchangeRefreshToken({
	client,
	refreshToken,
	refreshUrlTemplate,
	storage,
	fetchImpl,
}) {
	const refreshUrl = buildRefreshUrl(refreshUrlTemplate, refreshToken);
	const response = await fetchImpl(refreshUrl, {
		method: "GET",
		headers: { Accept: "application/json" },
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Refresh failed (${response.status}): ${errorBody}`);
	}

	const tokenData = await response.json();
	if (!tokenData.success || !tokenData.access_token) {
		throw new Error(`Refresh failed: ${JSON.stringify(tokenData)}`);
	}

	const nextRefreshToken = tokenData.refresh_token || refreshToken;
	const tokenState = {
		accessToken: tokenData.access_token,
		refreshToken: nextRefreshToken,
		expiresAt: Date.now() + DEFAULT_TOKEN_LIFETIME_MS,
	};

	client.setAuthToken(tokenState.accessToken);
	client.refreshToken = tokenState.refreshToken;
	saveTokenState(tokenState, storage);

	return tokenState;
}

/**
 * @param {Object} options
 * @param {TwitchChat} options.client
 * @param {string} options.refreshToken
 * @param {string} [options.refreshUrlTemplate]
 * @param {() => void} options.openModal
 * @param {() => void} [options.onRefreshStart]
 * @param {Storage} [options.storage]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {{ refreshNow: () => Promise<boolean> }}
 */
export function setupTokenRefresh({
	client,
	refreshToken,
	refreshUrlTemplate = DEFAULT_REFRESH_URL_TEMPLATE,
	openModal,
	onRefreshStart = () => {},
	storage = getTokenStorage(),
	fetchImpl = fetch,
}) {
	let refreshAttempts = 0;
	let activeRefresh = null;

	const refreshNow = async () => {
		if (!refreshToken || refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
			openModal();
			return false;
		}

		if (activeRefresh) {
			return activeRefresh;
		}

		refreshAttempts++;
		onRefreshStart();

		activeRefresh = refreshTwitchToken({
			client,
			refreshToken,
			refreshUrlTemplate,
			storage,
			fetchImpl,
		})
			.then((tokenState) => {
				refreshToken = tokenState.refreshToken;
				refreshAttempts = 0;
				client.connect();
				return true;
			})
			.catch((error) => {
				console.error("Token refresh failed:", error);
				openModal();
				return false;
			})
			.finally(() => {
				activeRefresh = null;
			});

		return activeRefresh;
	};

	client.on("oauthError", refreshNow);

	return { refreshNow };
}
