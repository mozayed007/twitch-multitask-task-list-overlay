"""
FastAPI Backend for Twitch Task List Overlay
Provides persistent storage and advanced features
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import sqlite3
import json
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

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting API server...")
    print("📝 Documentation: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
