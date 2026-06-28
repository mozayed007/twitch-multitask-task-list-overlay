# Twitch Auth Token Refresh Design

## Overview

Add automatic Twitch OAuth token refresh to the task-list overlay so the bot reconnects without manual token regeneration. The refresh exchange is handled by the existing FastAPI backend, which keeps the `client_secret` out of the browser. The frontend detects an invalid/expired token, asks the backend for a new access token, then reconnects to Twitch IRC.

This design implements **Option 2: automatic refresh via backend**, with a clear migration path to fully server-side token custody (Option 3) later.

## Goals

- Remove the need to manually regenerate the access token when it expires.
- Keep `client_secret` server-side only.
- Preserve current behavior when no refresh token is configured.
- Make the smallest secure change to the existing architecture.

## Non-Goals

- Replacing the frontend credential file with a full OAuth authorization-code flow.
- Encrypting credentials at rest in this iteration (out of scope; see Future Work).
- Changing how the backend stores viewer/backlog data.

## Architecture

### Backend (`backend/main.py`)

Add a new `/auth/refresh` endpoint:

- Accepts `client_id` and `refresh_token`.
- Reads `TWITCH_CLIENT_SECRET` from an environment variable.
- Calls Twitch's token endpoint:
  `POST https://id.twitch.tv/oauth2/token`
  with `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`.
- Returns the new `access_token`, `refresh_token`, `expires_in`, and `token_type`.
- Does not persist tokens itself; it is a stateless refresh proxy.
- Note: Twitch may return a new refresh token on each exchange. The frontend must update its stored refresh token whenever a new one is returned.

Add `httpx` to `backend/requirements.txt` for the HTTP call.

### Frontend Configuration

Extend `_authConfig` in `_auth.js`, `_auth.js.example`, and `backup_configs/_auth.js`:

```js
const _authConfig = {
  twitch_oauth: "oauth:...",        // access token
  twitch_refresh_token: "...",      // refresh token
  client_id: "...",                 // Twitch app client id
  twitch_username: "...",
  twitch_channel: "...",
};
```

Update `AuthConfig` typedef in `types/globals.d.js`.

### Frontend TwitchChat (`src/twitch/TwitchChat.js`)

- Accept an optional `refreshToken` and `clientId` in the constructor options.
- Add a method `setAuthToken(newToken)` so the token can be updated without recreating the client.
- Add a `#shouldReconnect` flag. When `false`, the automatic reconnect logic in `onclose` is skipped.
- On `NOTICE` authentication failure, emit `oauthError` as before, but also set `#shouldReconnect = false` so the generic 1006 reconnection loop does not spin with a stale token.

### Frontend Entry (`src/index-enhanced.js`)

- Read `twitch_refresh_token` and `client_id` from `_authConfig`.
- Pass them to `TwitchChat`.
- On `oauthError`:
  1. Set a UI message: "Token expired; attempting refresh...".
  2. Call `POST http://localhost:8000/auth/refresh`.
  3. On success, update the client token with `client.setAuthToken(...)` and call `client.connect()`.
  4. On failure, open the existing invalid-token modal.

### Security

- `client_secret` lives only in the `TWITCH_CLIENT_SECRET` environment variable on the backend host.
- `_auth.js` still contains tokens, but refresh tokens are now rotated, reducing the window of exposure.
- `_auth.js` and `backup_configs/_auth.js` must be removed from git history and added to `.gitignore`.
- Users must create their own Twitch app at https://dev.twitch.tv/console to obtain a `client_secret`; third-party token generators do not provide one and should not be used for production.

## Data Flow

```
Twitch IRC -> NOTICE (auth failure)
   |
   v
TwitchChat emits oauthError
   |
   v
index-enhanced.js calls POST /auth/refresh
   |
   v
backend/main.py calls Twitch OAuth token endpoint
   |
   v
Twitch returns new access_token + refresh_token
   |
   v
backend returns tokens to frontend
   |
   v
index-enhanced.js calls client.setAuthToken(newAccessToken)
   |
   v
client.connect() with new token
```

If any step fails, the existing invalid-token modal is shown.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No refresh token configured | Fall back to current behavior: show invalid-token modal. |
| Backend returns 4xx from Twitch | Show modal with Twitch's error message. |
| Backend unreachable | Show modal; do not retry indefinitely. |
| Refresh succeeds but IRC still fails | Show modal (token may be revoked or scopes missing). |
| Repeated failures in one session | Cap refresh attempts (e.g., 3) to avoid loops. |

## Testing

- Add unit tests for the backend `/auth/refresh` endpoint using `httpx` mocking.
- Add tests for `TwitchChat.setAuthToken`.
- Add tests verifying that `oauthError` disables automatic reconnect.

## Files Changed

- `backend/main.py`
- `backend/requirements.txt`
- `src/twitch/TwitchChat.js`
- `src/index-enhanced.js`
- `src/index.js`
- `_auth.js.example`
- `backup_configs/_auth.js`
- `types/globals.d.js`
- `.gitignore`
- `README.md` (update setup instructions)

## Future Work

- Move token storage entirely server-side so the frontend never holds `twitch_oauth`.
- Add token encryption at rest.
- Restrict backend CORS from `*` to explicit origins.
- Add a UI settings panel to paste/rotate tokens without editing `_auth.js`.
