# Backend API Server

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Run Server
```bash
python main.py
```

Server will start at `http://localhost:8000`

### 3. View API Documentation
Open browser: `http://localhost:8000/docs`

## Features

- **Persistent Storage**: SQLite database for all data
- **Viewer Profiles**: Store and retrieve viewer information
- **Backlog Management**: Server-side backlog with advanced queries
- **Preferences**: Save theme/layout preferences
- **Statistics**: Track usage and completion rates

## API Endpoints

### Viewers
- `GET /viewers` - Get all viewers
- `GET /viewers/{username}` - Get specific viewer
- `POST /viewers` - Create/update viewer
- `PUT /viewers/{username}/info` - Set viewer info field

### Backlog
- `GET /backlog/{username}` - Get user's backlog
- `POST /backlog` - Add backlog item
- `PUT /backlog/{item_id}/complete` - Toggle completion
- `DELETE /backlog/{item_id}` - Delete item

### Preferences
- `GET /preferences/{key}` - Get preference
- `POST /preferences` - Set preference

### Stats
- `POST /stats/log` - Log event
- `GET /stats/summary` - Get statistics

## Frontend Integration

### Enable API in Overlay
Update your JavaScript to use the API:

```javascript
const API_URL = 'http://localhost:8000';

// Save viewer info
async function saveViewerInfo(username, field, value) {
  await fetch(`${API_URL}/viewers/${username}/info?field=${field}&value=${value}`, {
    method: 'PUT'
  });
}

// Get viewer info
async function getViewerInfo(username) {
  const response = await fetch(`${API_URL}/viewers/${username}`);
  return await response.json();
}
```

## Production Deployment

### Option 1: Local Server
Keep running on localhost for personal use

### Option 2: VPS/Cloud
Deploy to DigitalOcean, AWS, or any VPS:

1. Install Python 3.8+
2. Clone repository
3. Install dependencies
4. Run with systemd or supervisor
5. Use nginx reverse proxy
6. Enable HTTPS with Let's Encrypt

### Option 3: Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY main.py .
CMD ["python", "main.py"]
```

## Security Notes

⚠️ **Important for Production:**

1. **CORS**: Update `allow_origins` in main.py to your domain
2. **Authentication**: Add API keys or OAuth
3. **HTTPS**: Use SSL certificates
4. **Rate Limiting**: Implement rate limiting
5. **Database**: Consider PostgreSQL for production

## Database

SQLite database (`overlay_data.db`) includes:

- **viewers**: User profiles and info
- **backlog**: Backlog items
- **preferences**: App preferences
- **stats**: Usage statistics

## Backup

Backup database regularly:
```bash
cp overlay_data.db overlay_data_backup_$(date +%Y%m%d).db
```

## Troubleshooting

### Port already in use
Change port in main.py:
```python
uvicorn.run(app, host="0.0.0.0", port=8001)
```

### Database locked
Close all connections and restart server

### CORS errors
Check `allow_origins` in middleware configuration
