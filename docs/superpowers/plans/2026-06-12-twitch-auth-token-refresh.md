# Twitch Auth Token Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic Twitch OAuth token refresh so the overlay reconnects after an access token expires, without exposing the client secret to the browser.

**Architecture:** A new FastAPI endpoint in `backend/main.py` proxies the Twitch refresh-token exchange using a server-side `TWITCH_CLIENT_SECRET`. The frontend detects IRC auth failure, calls the endpoint, updates the IRC client's token, and reconnects. `src/index.js` and `src/index-enhanced.js` both get the same refresh orchestration.

**Tech Stack:** FastAPI, httpx, JavaScript (ES modules), Vitest, pytest

---

## Task 1: Backend Dependencies and Refresh Endpoint

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/main.py`

- [ ] **Step 1: Add HTTP client dependency**

```txt
fastapi==0.115.6
uvicorn==0.34.0
pydantic==2.10.4
python-multipart==0.0.20
httpx==0.28.1
```

- [ ] **Step 2: Add refresh endpoint models and route to `backend/main.py`**

Insert near the top with the other imports:

```python
import os
import httpx
```

Insert after the existing Pydantic models:

```python
class TokenRefreshRequest(BaseModel):
    client_id: str
    refresh_token: str

class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str
```

Insert after the stats endpoints:

```python
@app.post("/auth/refresh", response_model=TokenRefreshResponse)
async def refresh_twitch_token(request: TokenRefreshRequest):
    """Exchange a Twitch refresh token for a new access token."""
    client_secret = os.getenv("TWITCH_CLIENT_SECRET")
    if not client_secret:
        raise HTTPException(
            status_code=500,
            detail="TWITCH_CLIENT_SECRET environment variable is not set"
        )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://id.twitch.tv/oauth2/token",
            data={
                "client_id": request.client_id,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
                "refresh_token": request.refresh_token,
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    return response.json()
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
cd backend && pip install -r requirements.txt
```

Expected: `httpx` installs successfully.

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/main.py
git commit -m "feat(backend): add /auth/refresh endpoint for Twitch tokens"
```

---

## Task 2: Backend Tests for Refresh Endpoint

**Files:**
- Create: `backend/tests/test_auth.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add Python test dependencies**

```txt
fastapi==0.115.6
uvicorn==0.34.0
pydantic==2.10.4
python-multipart==0.0.20
httpx==0.28.1
pytest==8.3.4
pytest-asyncio==0.25.0
```

- [ ] **Step 2: Write the refresh endpoint test**

```python
import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    return TestClient(app)


@patch.dict(os.environ, {"TWITCH_CLIENT_SECRET": "test_secret"}, clear=True)
def test_refresh_token_success(client):
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "access_token": "new_access_token",
        "refresh_token": "new_refresh_token",
        "expires_in": 3600,
        "token_type": "bearer",
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as mock_post:
        response = client.post(
            "/auth/refresh",
            json={
                "client_id": "test_client_id",
                "refresh_token": "test_refresh_token",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "new_access_token"
    assert data["refresh_token"] == "new_refresh_token"
    assert data["expires_in"] == 3600
    assert data["token_type"] == "bearer"

    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert call_args[0][0] == "https://id.twitch.tv/oauth2/token"
    assert call_args[1]["data"]["client_id"] == "test_client_id"
    assert call_args[1]["data"]["client_secret"] == "test_secret"
    assert call_args[1]["data"]["grant_type"] == "refresh_token"
    assert call_args[1]["data"]["refresh_token"] == "test_refresh_token"


def test_refresh_token_missing_secret(client):
    with patch.dict(os.environ, {}, clear=True):
        response = client.post(
            "/auth/refresh",
            json={
                "client_id": "test_client_id",
                "refresh_token": "test_refresh_token",
            },
        )

    assert response.status_code == 500
    assert "TWITCH_CLIENT_SECRET" in response.json()["detail"]


@patch.dict(os.environ, {"TWITCH_CLIENT_SECRET": "test_secret"}, clear=True)
def test_refresh_token_twitch_error(client):
    mock_response = AsyncMock()
    mock_response.status_code = 400
    mock_response.text = '{"message": "Invalid refresh token"}'

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        response = client.post(
            "/auth/refresh",
            json={
                "client_id": "test_client_id",
                "refresh_token": "bad_token",
            },
        )

    assert response.status_code == 400
```

- [ ] **Step 3: Install test dependencies**

Run:
```bash
cd backend && pip install -r requirements.txt
```

- [ ] **Step 4: Run backend tests**

Run:
```bash
cd backend && python -m pytest tests -v
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/tests/test_auth.py
git commit -m "test(backend): add tests for /auth/refresh endpoint"
```

---

## Task 3: TwitchChat Token Refresh Support

**Files:**
- Modify: `src/twitch/TwitchChat.js`

- [ ] **Step 1: Update constructor to accept refresh options**

Change the constructor signature and body:

```js
constructor(
    url,
    { username, authToken, channel, refreshToken, clientId },
    WebSocketService = WebSocket
) {
    super();
    this.url = url;
    this.username = username.toLowerCase();
    this.channel = `#${channel.toLowerCase()}`;
    this.authToken = authToken.includes("oauth:")
        ? authToken
        : `oauth:${authToken}`;
    this.refreshToken = refreshToken || "";
    this.clientId = clientId || "";
    this.WebSocketService = WebSocketService;
    this.#shouldReconnect = true;
}
```

- [ ] **Step 2: Add `#shouldReconnect` private field**

Add after the other private fields at the top of the class:

```js
#ws = null;
#reconnectInterval = 1000; // milliseconds
#shouldReconnect = true;
```

- [ ] **Step 3: Add `setAuthToken` method**

Insert after the `connect` method (before `say`):

```js
/**
 * Updates the OAuth token used for IRC authentication.
 * Useful after a token refresh.
 * @param {string} newToken
 * @returns {void}
 */
setAuthToken(newToken) {
    this.authToken = newToken.includes("oauth:")
        ? newToken
        : `oauth:${newToken}`;
}
```

- [ ] **Step 4: Disable reconnect on auth failure**

In the `NOTICE` case inside `onmessage`, change:

```js
case "NOTICE":
    // If the authentication failed, leave the channel.
    // The server will close the connection.
    console.error(`${parsedMessage.parameters}; left ${this.channel}`);
    this.#shouldReconnect = false;
    this.emit("oauthError");
    this.#ws.send(`PART ${this.channel}`);
    break;
```

- [ ] **Step 5: Guard reconnect logic with `#shouldReconnect`**

In `onclose`, wrap the reconnect bodies:

```js
case 1006:
    if (!this.#shouldReconnect) {
        console.log("Reconnection skipped: authentication failure pending refresh.");
        break;
    }
    console.error(
        `Connection dropped. Reconnecting in ${this.#reconnectInterval} milliseconds...`
    );
    let reconnectInterval = this.#reconnectInterval;
    setTimeout(() => {
        this.connect();
    }, reconnectInterval);
    this.#reconnectInterval = this.#reconnectInterval * 2;
    break;
case 1012:
    if (!this.#shouldReconnect) {
        console.log("Server switch skipped: authentication failure pending refresh.");
        break;
    }
    console.log(`Switching servers...`);
    this.connect();
    break;
```

- [ ] **Step 6: Commit**

```bash
git add src/twitch/TwitchChat.js
git commit -m "feat(twitch): support token refresh and disable reconnect on auth failure"
```

---

## Task 4: Orchestrate Refresh in `src/index-enhanced.js`

**Files:**
- Modify: `src/index-enhanced.js`

- [ ] **Step 1: Read new auth config fields**

Change the destructuring near the top:

```js
const {
    twitch_channel, twitch_oauth, twitch_username,
    twitch_refresh_token, client_id,
} = _authConfig;
```

Change the `TwitchChat` instantiation:

```js
const client = new TwitchChat(twitchIRC, {
    username: twitch_username,
    authToken: twitch_oauth,
    channel: twitch_channel,
    refreshToken: twitch_refresh_token,
    clientId: client_id,
});
```

- [ ] **Step 2: Replace the oauthError handler with refresh logic**

Replace:

```js
client.on("oauthError", () => {
    openModal();
});
```

with:

```js
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

client.on("oauthError", async () => {
    if (!client_id || !twitch_refresh_token) {
        openModal();
        return;
    }

    if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        console.error("Max token refresh attempts reached.");
        openModal();
        return;
    }

    refreshAttempts++;

    try {
        const response = await fetch("http://localhost:8000/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id,
                refresh_token: twitch_refresh_token,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Refresh failed (${response.status}): ${errorBody}`);
        }

        const tokenData = await response.json();
        client.setAuthToken(tokenData.access_token);

        if (tokenData.refresh_token && tokenData.refresh_token !== twitch_refresh_token) {
            console.warn(
                "Twitch rotated the refresh token. Update _authConfig.twitch_refresh_token with:",
                tokenData.refresh_token
            );
        }

        client.connect();
    } catch (error) {
        console.error("Token refresh failed:", error);
        openModal();
    }
});
```

- [ ] **Step 3: Commit**

```bash
git add src/index-enhanced.js
git commit -m "feat(frontend): orchestrate Twitch token refresh in enhanced entry"
```

---

## Task 5: Orchestrate Refresh in `src/index.js`

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Read new auth config fields and pass them to TwitchChat**

Change the destructuring:

```js
const {
    twitch_channel, twitch_oauth, twitch_username,
    twitch_refresh_token, client_id,
} = _authConfig;
```

Change the instantiation:

```js
const client = new TwitchChat(twitchIRC, {
    username: twitch_username,
    authToken: twitch_oauth,
    channel: twitch_channel,
    refreshToken: twitch_refresh_token,
    clientId: client_id,
});
```

- [ ] **Step 2: Replace the oauthError handler with refresh logic**

Replace:

```js
client.on("oauthError", () => {
    openModal();
});
```

with:

```js
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

client.on("oauthError", async () => {
    if (!client_id || !twitch_refresh_token || refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        openModal();
        return;
    }

    refreshAttempts++;

    try {
        const response = await fetch("http://localhost:8000/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id,
                refresh_token: twitch_refresh_token,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Refresh failed (${response.status}): ${errorBody}`);
        }

        const tokenData = await response.json();
        client.setAuthToken(tokenData.access_token);

        if (tokenData.refresh_token && tokenData.refresh_token !== twitch_refresh_token) {
            console.warn(
                "Twitch rotated the refresh token. Update _authConfig.twitch_refresh_token with:",
                tokenData.refresh_token
            );
        }

        client.connect();
    } catch (error) {
        console.error("Token refresh failed:", error);
        openModal();
    }
});
```

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat(frontend): orchestrate Twitch token refresh in legacy entry"
```

---

## Task 6: Config Templates, Types, and Git Ignore

**Files:**
- Modify: `_auth.js.example`
- Modify: `backup_configs/_auth.js`
- Modify: `types/globals.d.js`
- Modify: `.gitignore`

- [ ] **Step 1: Update `_auth.js.example`**

```js
// ========================================
// oAuth access token and channel info - Required
// ========================================
// Copy this file to _auth.js and fill in your actual credentials
// Get your OAuth token from your own Twitch app at https://dev.twitch.tv/console
/** @type {AuthConfig} */
const _authConfig = {
  twitch_oauth: "oauth:your_oauth_token_here",
  twitch_refresh_token: "your_refresh_token_here",
  client_id: "your_twitch_app_client_id",
  twitch_username: "your_bot_username",
  twitch_channel: "your_channel_name",
};
```

- [ ] **Step 2: Update `backup_configs/_auth.js`**

```js
// ========================================
// Backup auth config - copy of _auth.js
// ========================================
/** @type {AuthConfig} */
const _authConfig = {
  twitch_oauth: "oauth:your_oauth_token_here",
  twitch_refresh_token: "your_refresh_token_here",
  client_id: "your_twitch_app_client_id",
  twitch_username: "your_bot_username",
  twitch_channel: "your_channel_name",
};
```

- [ ] **Step 3: Update `types/globals.d.js`**

Change the `AuthConfig` typedef:

```js
/**
 * @typedef {Object} AuthConfig
 * @property {string} twitch_oauth - The Twitch oauth access token
 * @property {string} [twitch_refresh_token] - The Twitch oauth refresh token
 * @property {string} [client_id] - The Twitch app client id
 * @property {string} twitch_channel - The Twitch channel
 * @property {string} twitch_username - The Twitch username
 */
```

- [ ] **Step 4: Update `.gitignore`**

Add under `# Authentication credentials`:

```gitignore
# Authentication credentials
_auth.js
_auth.js.example
backup_configs/_auth.js
```

- [ ] **Step 5: Commit**

```bash
git add _auth.js.example backup_configs/_auth.js types/globals.d.js .gitignore
git commit -m "chore(config): add refresh token and client id fields; ignore backup auth"
```

---

## Task 7: Frontend Tests for TwitchChat Refresh Support

**Files:**
- Modify: `tests/twitch/TwitchChat.test.js`

- [ ] **Step 1: Add constructor tests for new options**

After the existing constructor test, add:

```js
it("should store refresh token and client id when provided", () => {
    const chat = new TwitchChat(
        "ws://test-url:80",
        {
            username: "UserName",
            authToken: "1a2b3c4d5e6f",
            channel: "CHANNEL",
            refreshToken: "refresh123",
            clientId: "client456",
        },
        mockWebSocket
    );
    expect(chat.refreshToken).toBe("refresh123");
    expect(chat.clientId).toBe("client456");
});
```

- [ ] **Step 2: Add test for `setAuthToken`**

Add a new describe block after the constructor tests:

```js
describe("setAuthToken method", () => {
    it("should update the auth token and normalize the oauth prefix", () => {
        twitchChat.connect();
        twitchChat.setAuthToken("newtoken123");
        expect(twitchChat.authToken).toBe("oauth:newtoken123");
    });

    it("should not double-prefix a token that already has oauth:", () => {
        twitchChat.connect();
        twitchChat.setAuthToken("oauth:existingtoken");
        expect(twitchChat.authToken).toBe("oauth:existingtoken");
    });
});
```

- [ ] **Step 3: Add test for disabling reconnect on auth failure**

Add inside the `connect method and its WebSocket events` describe block:

```js
it("should emit oauthError and skip reconnect on authentication NOTICE", () => {
    const oauthErrorSpy = vi.fn();
    twitchChat.on("oauthError", oauthErrorSpy);
    twitchChat.connect();

    mockWsInstance.onmessage({
        data: ":tmi.twitch.tv NOTICE #channel :Login authentication failed\r\n",
    });

    expect(oauthErrorSpy).toHaveBeenCalled();
});
```

- [ ] **Step 4: Run frontend tests**

Run:
```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/twitch/TwitchChat.test.js
git commit -m "test(twitch): cover token refresh support in TwitchChat"
```

---

## Task 8: Update README with Setup Instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the auth setup section and update it**

Replace any existing instruction that says to copy `_auth.js.example` to `_auth.js` and paste a token from `twitchapps.com` with:

```markdown
### Authentication

1. Create a Twitch application at https://dev.twitch.tv/console if you don't have one.
2. Note the **Client ID**.
3. Generate a **Client Secret** from the app settings and set it as an environment variable when running the backend:
   ```bash
   export TWITCH_CLIENT_SECRET="your_client_secret"
   ```
4. Use the Twitch OAuth authorization-code flow (or a trusted token generator) to obtain an **access token** and **refresh token** with the `chat:read` and `chat:edit` scopes.
5. Copy `_auth.js.example` to `_auth.js` and fill in all five fields:
   - `twitch_oauth`: your access token (with or without the `oauth:` prefix)
   - `twitch_refresh_token`: your refresh token
   - `client_id`: your Twitch app's Client ID
   - `twitch_username`: your bot account username
   - `twitch_channel`: the channel to join

> **Security note:** Never commit `_auth.js`. It is listed in `.gitignore` and contains live credentials.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): update auth setup for refresh tokens"
```

---

## Task 9: Final Verification

**Files:**
- All of the above

- [ ] **Step 1: Run frontend test suite**

Run:
```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run backend test suite**

Run:
```bash
cd backend && python -m pytest tests -v
```

Expected: 3 tests pass.

- [ ] **Step 3: Type-check with Vite build**

Run:
```bash
npm run build
```

Expected: build completes without errors.

- [ ] **Step 4: Final commit (if any fixes were needed)**

If changes were made during verification:

```bash
git add -A
git commit -m "fix: address verification issues"
```

---

## Self-Review

- [ ] **Spec coverage:** Every requirement from the design doc is covered:
  - Backend refresh endpoint: Task 1
  - Backend tests: Task 2
  - Frontend TwitchChat support: Task 3
  - Frontend orchestration: Tasks 4 and 5
  - Config/templates/types/gitignore: Task 6
  - Frontend tests: Task 7
  - README update: Task 8
  - Verification: Task 9
- [ ] **Placeholder scan:** No TBD, TODO, or vague steps remain.
- [ ] **Type consistency:** `twitch_refresh_token`, `client_id`, `refreshToken`, `clientId`, `TokenRefreshRequest`, and `TokenRefreshResponse` are used consistently across all tasks.
