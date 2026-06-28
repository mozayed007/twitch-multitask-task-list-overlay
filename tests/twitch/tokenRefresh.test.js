import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	isTokenExpired,
	readStoredTokenState,
	refreshTwitchToken,
	resolveTokenConfig,
	saveTokenState,
	setupTokenRefresh,
} from "../../src/twitch/tokenRefresh";

describe("tokenRefresh", () => {
	let storage;

	beforeEach(() => {
		storage = window.localStorage;
		storage.clear();
		vi.useRealTimers();
	});

	it("should resolve stored tokens before config tokens for the same client", () => {
		saveTokenState({
			accessToken: "stored_access",
			refreshToken: "stored_refresh",
			clientId: "config_client",
			expiresAt: Date.now() + 3600000,
		}, storage);

		const tokenConfig = resolveTokenConfig({
			twitch_oauth: "config_access",
			twitch_refresh_token: "config_refresh",
			client_id: "config_client",
			twitch_auth_refresh_url: "http://127.0.0.1:9000/auth/refresh",
		}, storage);

		expect(tokenConfig.accessToken).toBe("stored_access");
		expect(tokenConfig.refreshToken).toBe("stored_refresh");
		expect(tokenConfig.clientId).toBe("config_client");
		expect(tokenConfig.refreshEndpoint).toBe("http://127.0.0.1:9000/auth/refresh");
	});

	it("should ignore stored tokens from a different client", () => {
		saveTokenState({
			accessToken: "stored_access",
			refreshToken: "stored_refresh",
			clientId: "old_client",
			expiresAt: Date.now() + 3600000,
		}, storage);

		const tokenConfig = resolveTokenConfig({
			twitch_oauth: "config_access",
			twitch_refresh_token: "config_refresh",
			client_id: "new_client",
		}, storage);

		expect(tokenConfig.accessToken).toBe("config_access");
		expect(tokenConfig.refreshToken).toBe("config_refresh");
		expect(tokenConfig.clientId).toBe("new_client");
		expect(tokenConfig.storedTokenState).toBeNull();
	});

	it("should detect tokens inside the expiry buffer as expired", () => {
		const now = Date.now();

		expect(isTokenExpired({ expiresAt: now + 30000 }, now)).toBe(true);
		expect(isTokenExpired({ expiresAt: now + 120000 }, now)).toBe(false);
	});

	it("should refresh and persist rotated tokens", async () => {
		const client = {
			setAuthToken: vi.fn(),
		};
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({
				access_token: "new_access",
				refresh_token: "new_refresh",
				expires_in: 3600,
				token_type: "bearer",
			}),
		});

		await refreshTwitchToken({
			client,
			clientId: "client_id",
			refreshToken: "old_refresh",
			refreshEndpoint: "http://127.0.0.1:9000/auth/refresh",
			storage,
			fetchImpl,
		});

		expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:9000/auth/refresh", expect.any(Object));
		expect(client.setAuthToken).toHaveBeenCalledWith("new_access");
		expect(client.refreshToken).toBe("new_refresh");
		expect(readStoredTokenState(storage).refreshToken).toBe("new_refresh");
	});

	it("should connect after oauthError refresh succeeds", async () => {
		const handlers = {};
		const client = {
			on: vi.fn((eventName, handler) => {
				handlers[eventName] = handler;
			}),
			setAuthToken: vi.fn(),
			connect: vi.fn(),
		};
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({
				access_token: "new_access",
				refresh_token: "new_refresh",
				expires_in: 3600,
				token_type: "bearer",
			}),
		});

		setupTokenRefresh({
			client,
			clientId: "client_id",
			refreshToken: "old_refresh",
			openModal: vi.fn(),
			storage,
			fetchImpl,
		});

		await handlers.oauthError();

		expect(client.connect).toHaveBeenCalledTimes(1);
		expect(client.setAuthToken).toHaveBeenCalledWith("new_access");
	});
});
