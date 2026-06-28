"""
FastAPI Backend for Twitch Task List Overlay
Provides persistent storage and advanced features
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import sqlite3
import json
import httpx
from html import escape
from pathlib import Path
import secrets
from urllib.parse import urlencode
from datetime import datetime
from contextlib import contextmanager

app = FastAPI(title="Task Overlay API", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
DB_PATH = "overlay_data.db"
ENV_PATH = Path(__file__).with_name(".env")
OAUTH_STATES = set()

def load_local_env_file():
    """Load backend/.env for local OBS usage without adding a dependency."""
    if not ENV_PATH.exists():
        return

    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

load_local_env_file()

@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Initialize database tables"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Viewer profiles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS viewers (
                username TEXT PRIMARY KEY,
                info TEXT,
                last_active TIMESTAMP,
                task_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Backlog items table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS backlog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                description TEXT NOT NULL,
                priority INTEGER DEFAULT 3,
                completed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (username) REFERENCES viewers(username)
            )
        """)
        
        # Theme preferences table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Stats table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                username TEXT,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()

# Pydantic models
class ViewerInfo(BaseModel):
    username: str
    info: Dict[str, str] = {}
    task_count: int = 0

class BacklogItem(BaseModel):
    username: str
    description: str
    priority: int = 3
    completed: bool = False

class BacklogItemResponse(BacklogItem):
    id: int
    created_at: str

class Preference(BaseModel):
    key: str
    value: str

class TokenRefreshRequest(BaseModel):
    client_id: str
    refresh_token: str

class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: int
    token_type: str

def get_twitch_client_secret():
    client_secret = os.getenv("TWITCH_CLIENT_SECRET")
    if not client_secret:
        raise HTTPException(
            status_code=500,
            detail="TWITCH_CLIENT_SECRET environment variable is not set"
        )
    return client_secret

def get_twitch_client_id():
    client_id = os.getenv("TWITCH_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="TWITCH_CLIENT_ID environment variable is not set"
        )
    return client_id

def get_twitch_redirect_uri():
    return os.getenv("TWITCH_REDIRECT_URI", "http://localhost:8000/auth/callback")

def get_backend_host():
    return os.getenv("BACKEND_HOST", "127.0.0.1")

def get_backend_port():
    return int(os.getenv("BACKEND_PORT", "8000"))

# API Endpoints

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()
    print("🚀 API Server started successfully!")
    print(f"📊 Database: {DB_PATH}")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Task Overlay API",
        "version": "1.0.0"
    }

# Viewer endpoints
@app.get("/viewers", response_model=List[ViewerInfo])
async def get_viewers():
    """Get all viewer profiles"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM viewers ORDER BY last_active DESC")
        rows = cursor.fetchall()
        
        return [
            ViewerInfo(
                username=row["username"],
                info=json.loads(row["info"]) if row["info"] else {},
                task_count=row["task_count"]
            )
            for row in rows
        ]

@app.get("/viewers/{username}", response_model=ViewerInfo)
async def get_viewer(username: str):
    """Get specific viewer profile"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM viewers WHERE username = ?", (username,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Viewer not found")
        
        return ViewerInfo(
            username=row["username"],
            info=json.loads(row["info"]) if row["info"] else {},
            task_count=row["task_count"]
        )

@app.post("/viewers", response_model=ViewerInfo)
async def upsert_viewer(viewer: ViewerInfo):
    """Create or update viewer profile"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO viewers (username, info, last_active, task_count)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                info = excluded.info,
                last_active = excluded.last_active,
                task_count = excluded.task_count
        """, (
            viewer.username,
            json.dumps(viewer.info),
            datetime.now(),
            viewer.task_count
        ))
        conn.commit()
        
    return viewer

@app.put("/viewers/{username}/info")
async def set_viewer_info(username: str, field: str, value: str):
    """Set a specific info field for viewer"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get current info
        cursor.execute("SELECT info FROM viewers WHERE username = ?", (username,))
        row = cursor.fetchone()
        
        if row:
            info = json.loads(row["info"]) if row["info"] else {}
        else:
            info = {}
        
        # Update field
        info[field] = value
        
        # Upsert viewer
        cursor.execute("""
            INSERT INTO viewers (username, info, last_active)
            VALUES (?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                info = excluded.info,
                last_active = excluded.last_active
        """, (username, json.dumps(info), datetime.now()))
        conn.commit()
        
    return {"success": True, "field": field, "value": value}

# Backlog endpoints
@app.get("/backlog/{username}", response_model=List[BacklogItemResponse])
async def get_backlog(username: str):
    """Get user's backlog items"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM backlog 
            WHERE username = ? 
            ORDER BY completed ASC, priority DESC, created_at ASC
        """, (username,))
        rows = cursor.fetchall()
        
        return [
            BacklogItemResponse(
                id=row["id"],
                username=row["username"],
                description=row["description"],
                priority=row["priority"],
                completed=bool(row["completed"]),
                created_at=row["created_at"]
            )
            for row in rows
        ]

@app.post("/backlog", response_model=BacklogItemResponse)
async def add_backlog_item(item: BacklogItem):
    """Add item to backlog"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO backlog (username, description, priority, completed)
            VALUES (?, ?, ?, ?)
        """, (item.username, item.description, item.priority, item.completed))
        conn.commit()
        item_id = cursor.lastrowid
        
        # Get created item
        cursor.execute("SELECT * FROM backlog WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        
        return BacklogItemResponse(
            id=row["id"],
            username=row["username"],
            description=row["description"],
            priority=row["priority"],
            completed=bool(row["completed"]),
            created_at=row["created_at"]
        )

@app.put("/backlog/{item_id}/complete")
async def toggle_backlog_complete(item_id: int):
    """Toggle backlog item completion"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE backlog SET completed = NOT completed 
            WHERE id = ?
        """, (item_id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")
    
    return {"success": True, "id": item_id}

@app.delete("/backlog/{item_id}")
async def delete_backlog_item(item_id: int):
    """Delete backlog item"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM backlog WHERE id = ?", (item_id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")
    
    return {"success": True, "id": item_id}

# Preferences endpoints
@app.get("/preferences/{key}")
async def get_preference(key: str):
    """Get preference value"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM preferences WHERE key = ?", (key,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Preference not found")
        
        return {"key": key, "value": row["value"]}

@app.post("/preferences")
async def set_preference(pref: Preference):
    """Set preference value"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO preferences (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        """, (pref.key, pref.value, datetime.now()))
        conn.commit()
    
    return {"success": True, "key": pref.key}

# Stats endpoints
@app.post("/stats/log")
async def log_stat(event_type: str, username: Optional[str] = None, data: Optional[str] = None):
    """Log a stat event"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO stats (event_type, username, data)
            VALUES (?, ?, ?)
        """, (event_type, username, data))
        conn.commit()
    
    return {"success": True}

@app.get("/stats/summary")
async def get_stats_summary():
    """Get statistics summary"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Total viewers
        cursor.execute("SELECT COUNT(*) as count FROM viewers")
        total_viewers = cursor.fetchone()["count"]
        
        # Active viewers (last 24 hours)
        cursor.execute("""
            SELECT COUNT(*) as count FROM viewers 
            WHERE last_active > datetime('now', '-1 day')
        """)
        active_viewers = cursor.fetchone()["count"]
        
        # Total backlog items
        cursor.execute("SELECT COUNT(*) as count FROM backlog")
        total_backlog = cursor.fetchone()["count"]
        
        # Completed backlog items
        cursor.execute("SELECT COUNT(*) as count FROM backlog WHERE completed = 1")
        completed_backlog = cursor.fetchone()["count"]
        
        return {
            "total_viewers": total_viewers,
            "active_viewers_24h": active_viewers,
            "total_backlog_items": total_backlog,
            "completed_backlog_items": completed_backlog,
            "completion_rate": round(completed_backlog / total_backlog * 100, 1) if total_backlog > 0 else 0
        }

@app.get("/auth/start")
async def start_twitch_auth():
    """Start a local Twitch authorization flow for initial token setup."""
    state = secrets.token_urlsafe(32)
    OAUTH_STATES.add(state)
    query = urlencode({
        "client_id": get_twitch_client_id(),
        "redirect_uri": get_twitch_redirect_uri(),
        "response_type": "code",
        "scope": "chat:read chat:edit",
        "state": state,
    })
    return RedirectResponse(f"https://id.twitch.tv/oauth2/authorize?{query}")

@app.get("/auth/callback", response_class=HTMLResponse)
async def twitch_auth_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, error_description: Optional[str] = None):
    """Exchange Twitch's authorization code for initial access and refresh tokens."""
    if error:
        detail = error_description or error
        raise HTTPException(status_code=400, detail=detail)
    if not code:
        raise HTTPException(status_code=400, detail="Missing Twitch authorization code")
    if not state or state not in OAUTH_STATES:
        raise HTTPException(status_code=400, detail="Invalid Twitch authorization state")
    OAUTH_STATES.remove(state)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://id.twitch.tv/oauth2/token",
            data={
                "client_id": get_twitch_client_id(),
                "client_secret": get_twitch_client_secret(),
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": get_twitch_redirect_uri(),
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    token_data = response.json()
    access_token = escape(token_data["access_token"])
    refresh_token = escape(token_data["refresh_token"])
    client_id = escape(get_twitch_client_id())

    return f"""
    <!doctype html>
    <html>
      <head>
        <title>Twitch Auth Tokens</title>
        <style>
          body {{ font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; line-height: 1.5; }}
          textarea {{ width: 100%; height: 220px; font-family: monospace; }}
          code {{ background: #eee; padding: 2px 4px; }}
        </style>
      </head>
      <body>
        <h1>Twitch tokens created</h1>
        <p>Paste these values into <code>_auth.js</code>. Keep them private.</p>
        <textarea readonly>twitch_oauth: "oauth:{access_token}",
twitch_refresh_token: "{refresh_token}",
client_id: "{client_id}",
twitch_auth_refresh_url: "http://127.0.0.1:8000/auth/refresh",</textarea>
        <p>After saving <code>_auth.js</code>, refresh the OBS browser source.</p>
      </body>
    </html>
    """

@app.post("/auth/refresh", response_model=TokenRefreshResponse)
async def refresh_twitch_token(request: TokenRefreshRequest):
    """Exchange a Twitch refresh token for a new access token."""
    client_secret = get_twitch_client_secret()

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

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting API server...")
    host = get_backend_host()
    port = get_backend_port()
    print(f"📝 Documentation: http://{host}:{port}/docs")
    uvicorn.run(app, host=host, port=port, log_level="info")
