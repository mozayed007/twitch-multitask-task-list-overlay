import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getTokenStorage,
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
		storage.removeItem("twitchAuthTokens");
	});

	it("should resolve config refresh token and stored access token", () => {
		saveTokenState({
			accessToken: "stored_access",
			refreshToken: "stored_refresh",
			expiresAt: Date.now() + 3600000,
		}, storage);

		const tokenConfig = resolveTokenConfig({
			twitch_oauth: "config_access",
			twitch_refresh_token: "config_refresh",
		}, storage);

		expect(tokenConfig.accessToken).toBe("oauth:stored_access");
		expect(tokenConfig.refreshToken).toBe("config_refresh");
	});

	it("should detect tokens inside the expiry buffer as expired", () => {
		const now = Date.now();
		expect(isTokenExpired({ expiresAt: now + 30000 }, now)).toBe(true);
		expect(isTokenExpired({ expiresAt: now + 60000 }, now)).toBe(true);
		expect(isTokenExpired({ expiresAt: now + 3600000 }, now)).toBe(false);
	});

	it("should refresh via local backend by default", async () => {
		const client = {
			setAuthToken: vi.fn(),
		};
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({
				success: true,
				access_token: "new_access",
				refresh_token: "new_refresh",
			}),
		});

		await refreshTwitchToken({
			client,
			refreshToken: "old_refresh",
			storage,
			fetchImpl,
		});

		expect(fetchImpl).toHaveBeenCalledWith(
			"http://127.0.0.1:8000/api/token/refresh/old_refresh",
			expect.objectContaining({ method: "GET" })
		);
		expect(client.setAuthToken).toHaveBeenCalledWith("new_access");
		expect(client.refreshToken).toBe("new_refresh");
		expect(readStoredTokenState(storage).accessToken).toBe("new_access");
	});

	it("should fall back to direct refresh when backend fails", async () => {
		const client = {
			setAuthToken: vi.fn(),
		};
		const fetchImpl = vi.fn()
			.mockRejectedValueOnce(new Error("backend down"))
			.mockResolvedValueOnce({
				ok: true,
				json: vi.fn().mockResolvedValue({
					success: true,
					access_token: "fallback_access",
					refresh_token: "new_refresh",
				}),
			});

		await refreshTwitchToken({
			client,
			refreshToken: "old_refresh",
			storage,
			fetchImpl,
		});

		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(fetchImpl).toHaveBeenLastCalledWith(
			"https://twitchtokengenerator.com/api/refresh/old_refresh",
			expect.objectContaining({ method: "GET" })
		);
		expect(client.setAuthToken).toHaveBeenCalledWith("fallback_access");
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
				success: true,
				access_token: "new_access",
				refresh_token: "new_refresh",
			}),
		});
		const openModal = vi.fn();

		setupTokenRefresh({
			client,
			refreshToken: "old_refresh",
			openModal,
			storage,
			fetchImpl,
		});

		await handlers.oauthError();

		expect(client.connect).toHaveBeenCalledTimes(1);
		expect(client.setAuthToken).toHaveBeenCalledWith("new_access");
		expect(openModal).not.toHaveBeenCalled();
	});

	it("should open modal when refresh fails", async () => {
		const handlers = {};
		const client = {
			on: vi.fn((eventName, handler) => {
				handlers[eventName] = handler;
			}),
			setAuthToken: vi.fn(),
			connect: vi.fn(),
		};
		const fetchImpl = vi.fn().mockRejectedValue(new Error("network error"));
		const openModal = vi.fn();

		setupTokenRefresh({
			client,
			refreshToken: "bad_refresh",
			openModal,
			storage,
			fetchImpl,
		});

		await handlers.oauthError();

		expect(client.connect).not.toHaveBeenCalled();
		expect(openModal).toHaveBeenCalledTimes(1);
	});
});
