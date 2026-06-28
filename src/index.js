import App from "./app.js";
import { closeModal, openModal } from "./modal.js";
import TwitchChat from "./twitch/TwitchChat.js";
import { loadTestUsers } from "./twitch/loadTestUsers.js";
import { isTokenExpired, resolveTokenConfig, setupTokenRefresh } from "./twitch/tokenRefresh.js";

const {
	twitch_channel, twitch_oauth, twitch_username, twitch_refresh_token, client_id
} = _authConfig;
const tokenConfig = resolveTokenConfig({
	twitch_oauth,
	twitch_refresh_token,
	client_id,
	twitch_auth_refresh_url: _authConfig.twitch_auth_refresh_url,
});

const twitchIRC = "wss://irc-ws.chat.twitch.tv:443";
const client = new TwitchChat(twitchIRC, {
	username: twitch_username,
	authToken: tokenConfig.accessToken,
	channel: twitch_channel,
	refreshToken: tokenConfig.refreshToken,
	clientId: tokenConfig.clientId,
});

window.addEventListener("load", () => {
	let storeName = "userList";
	if (_settings.testMode) {
		console.log("Test mode enabled");
		storeName = "testUserList";
	}
	const app = new App(storeName);
	app.render();

	client.on("command", (data) => {
		const { user, command, message, flags, extra } = data;
		const response = app.chatHandler(user, command, message, flags, extra);
		if (!response.error) {
			client.say(response.message, extra.messageId);
		} else {
			// error logs also are added to OBS logs
			console.error(response.message);
		}
	});

	const tokenRefresh = setupTokenRefresh({
		client,
		clientId: tokenConfig.clientId,
		refreshToken: tokenConfig.refreshToken,
		refreshEndpoint: tokenConfig.refreshEndpoint,
		openModal,
		onRefreshStart: () => {
			console.warn("Twitch OAuth token expired. Attempting automatic refresh.");
		},
	});

	client.on("oauthSuccess", () => {
		closeModal();
	});

	if (isTokenExpired(tokenConfig.storedTokenState)) {
		tokenRefresh.refreshNow();
	} else {
		client.connect();
	}
	if (_settings.testMode) loadTestUsers(client);
});
