const TOKEN_STORAGE_KEY = "twitchAuthTokens";
const DEFAULT_REFRESH_ENDPOINT = "http://127.0.0.1:8000/auth/refresh";
const MAX_REFRESH_ATTEMPTS = 3;
const EXPIRY_BUFFER_MS = 60 * 1000;
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
 * @property {string} clientId
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
 * @param {TokenState|null} tokenState
 * @param {number} [now]
 * @returns {boolean}
 */
export function isTokenExpired(tokenState, now = Date.now()) {
	return Boolean(tokenState?.expiresAt && tokenState.expiresAt <= now + EXPIRY_BUFFER_MS);
}

/**
 * @param {Object} config
 * @param {string} config.twitch_oauth
 * @param {string} [config.twitch_refresh_token]
 * @param {string} [config.client_id]
 * @param {string} [config.twitch_auth_refresh_url]
 * @param {Storage} [storage]
 * @returns {{ accessToken: string, refreshToken: string, clientId: string, refreshEndpoint: string, storedTokenState: TokenState|null }}
 */
export function resolveTokenConfig(config, storage = getTokenStorage()) {
	const storedTokenState = readStoredTokenState(storage);
	const configuredClientId = config.client_id || "";
	const canUseStoredTokens = storedTokenState
		&& (!configuredClientId || storedTokenState.clientId === configuredClientId);
	const activeStoredTokenState = canUseStoredTokens ? storedTokenState : null;
	const clientId = configuredClientId || activeStoredTokenState?.clientId || "";
	const refreshToken = activeStoredTokenState?.refreshToken || config.twitch_refresh_token || "";
	const accessToken = activeStoredTokenState?.accessToken || config.twitch_oauth;
	const refreshEndpoint = config.twitch_auth_refresh_url || DEFAULT_REFRESH_ENDPOINT;

	return {
		accessToken,
		refreshToken,
		clientId,
		refreshEndpoint,
		storedTokenState: activeStoredTokenState,
	};
}

/**
 * @param {Object} options
 * @param {TwitchChat} options.client
 * @param {string} options.clientId
 * @param {string} options.refreshToken
 * @param {string} [options.refreshEndpoint]
 * @param {Storage} [options.storage]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<TokenState>}
 */
export async function refreshTwitchToken({
	client,
	clientId,
	refreshToken,
	refreshEndpoint = DEFAULT_REFRESH_ENDPOINT,
	storage = getTokenStorage(),
	fetchImpl = fetch,
}) {
	const response = await fetchImpl(refreshEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			client_id: clientId,
			refresh_token: refreshToken,
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Refresh failed (${response.status}): ${errorBody}`);
	}

	const tokenData = await response.json();
	const nextRefreshToken = tokenData.refresh_token || refreshToken;
	const tokenState = {
		accessToken: tokenData.access_token,
		refreshToken: nextRefreshToken,
		clientId,
		expiresAt: Date.now() + tokenData.expires_in * 1000,
	};

	client.setAuthToken(tokenState.accessToken);
	client.refreshToken = tokenState.refreshToken;
	client.clientId = clientId;
	saveTokenState(tokenState, storage);

	return tokenState;
}

/**
 * @param {Object} options
 * @param {TwitchChat} options.client
 * @param {string} options.clientId
 * @param {string} options.refreshToken
 * @param {string} [options.refreshEndpoint]
 * @param {() => void} options.openModal
 * @param {() => void} [options.onRefreshStart]
 * @param {Storage} [options.storage]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {{ refreshNow: () => Promise<boolean> }}
 */
export function setupTokenRefresh({
	client,
	clientId,
	refreshToken,
	refreshEndpoint = DEFAULT_REFRESH_ENDPOINT,
	openModal,
	onRefreshStart = () => {},
	storage = getTokenStorage(),
	fetchImpl = fetch,
}) {
	let refreshAttempts = 0;
	let activeRefresh = null;

	const refreshNow = async () => {
		if (!clientId || !refreshToken || refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
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
			clientId,
			refreshToken,
			refreshEndpoint,
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
