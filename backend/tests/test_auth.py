import os
from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

from main import OAUTH_STATES, app


def test_refresh_token_success():
    client = TestClient(app)
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "access_token": "new_access_token",
        "refresh_token": "new_refresh_token",
        "expires_in": 3600,
        "token_type": "bearer",
    }

    with patch.dict(os.environ, {"TWITCH_CLIENT_SECRET": "test_secret"}, clear=True):
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


def test_refresh_token_missing_secret():
    client = TestClient(app)

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


def test_refresh_token_twitch_error():
    client = TestClient(app)
    mock_response = AsyncMock()
    mock_response.status_code = 400
    mock_response.text = '{"message": "Invalid refresh token"}'

    with patch.dict(os.environ, {"TWITCH_CLIENT_SECRET": "test_secret"}, clear=True):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
            response = client.post(
                "/auth/refresh",
                json={
                    "client_id": "test_client_id",
                    "refresh_token": "bad_token",
                },
            )

    assert response.status_code == 400


def test_auth_start_redirects_to_twitch_authorize():
    client = TestClient(app)

    with patch.dict(os.environ, {
        "TWITCH_CLIENT_ID": "test_client_id",
        "TWITCH_REDIRECT_URI": "http://localhost:8000/auth/callback",
    }, clear=True):
        response = client.get("/auth/start", follow_redirects=False)

    assert response.status_code == 307
    location = response.headers["location"]
    assert location.startswith("https://id.twitch.tv/oauth2/authorize?")
    assert "client_id=test_client_id" in location
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fauth%2Fcallback" in location
    assert "scope=chat%3Aread+chat%3Aedit" in location
    assert "state=" in location


def test_auth_callback_exchanges_code_for_initial_tokens():
    client = TestClient(app)
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "access_token": "new_access_token",
        "refresh_token": "new_refresh_token",
        "expires_in": 3600,
        "token_type": "bearer",
    }

    with patch.dict(os.environ, {
        "TWITCH_CLIENT_ID": "test_client_id",
        "TWITCH_CLIENT_SECRET": "test_secret",
        "TWITCH_REDIRECT_URI": "http://localhost:8000/auth/callback",
    }, clear=True):
        OAUTH_STATES.add("test_state")
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as mock_post:
            response = client.get("/auth/callback?code=test_code&state=test_state")

    assert response.status_code == 200
    assert 'twitch_oauth: "oauth:new_access_token"' in response.text
    assert 'twitch_refresh_token: "new_refresh_token"' in response.text
    assert 'client_id: "test_client_id"' in response.text

    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert call_args[0][0] == "https://id.twitch.tv/oauth2/token"
    assert call_args[1]["data"]["client_id"] == "test_client_id"
    assert call_args[1]["data"]["client_secret"] == "test_secret"
    assert call_args[1]["data"]["code"] == "test_code"
    assert call_args[1]["data"]["grant_type"] == "authorization_code"
    assert call_args[1]["data"]["redirect_uri"] == "http://localhost:8000/auth/callback"
    assert "test_state" not in OAUTH_STATES


def test_auth_callback_requires_code():
    client = TestClient(app)

    response = client.get("/auth/callback")

    assert response.status_code == 400
    assert response.json()["detail"] == "Missing Twitch authorization code"


def test_auth_callback_rejects_invalid_state():
    client = TestClient(app)

    response = client.get("/auth/callback?code=test_code&state=bad_state")

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid Twitch authorization state"


def test_token_refresh_proxy_success():
    client = TestClient(app)
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "success": True,
        "access_token": "refreshed_access_token",
        "refresh_token": "same_refresh_token",
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_response) as mock_get:
        response = client.get("/api/token/refresh/test_refresh_token")

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "refreshed_access_token"
    assert data["refresh_token"] == "same_refresh_token"

    mock_get.assert_called_once()
    call_args = mock_get.call_args
    assert call_args[0][0] == "https://twitchtokengenerator.com/api/refresh/test_refresh_token"


def test_token_refresh_proxy_requires_success_flag():
    client = TestClient(app)
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"success": False, "message": "invalid token"}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_response):
        response = client.get("/api/token/refresh/bad_token")

    assert response.status_code == 502

