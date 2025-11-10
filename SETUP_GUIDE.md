# 🎯 Complete Setup Guide

## Prerequisites

- Node.js 16+ (for building)
- Python 3.8+ (optional, for backend)
- OBS Studio
- Twitch account

## Step 1: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# OR if you use pnpm
pnpm install
```

## Step 2: Configure Twitch Auth

Edit `_auth.js`:

```javascript
twitch_oauth = "your_oauth_token_here",
twitch_username = "YourBotUsername",
twitch_channel = "YourChannelName",
```

**Get OAuth Token:**

1. Go to <https://dev.twitch.tv/console>
2. Register app
3. Get Client ID
4. Generate OAuth token with chat permissions

(See original README.md for detailed OAuth instructions)

## Step 3: Build the Project

```bash
npm run build
```

This creates `dist/taskBot.iife.js` with all enhanced features.

## Step 4: Add to OBS

### Option A: Compact Layout (Side Panel)

1. Add Browser Source
2. Local file: `index.html`
3. Width: 600px, Height: 1080px
4. Check "Refresh browser when scene becomes active"

### Option B: Full Overlay

1. Add Browser Source
2. Local file: `index.html`
3. Width: 1920px, Height: 1080px
4. Position over your stream

### Option C: Custom Size

1. Add Browser Source
2. Local file: `index.html`
3. Set any size
4. Use `!layout` command to adjust

## Step 5: Test Features

In Twitch chat:

```text
!task Test task
!theme sunset
!layout split
!pomo 25/5
!backlog add Long term goal
!setinfo goal Learn streaming
```

**Keyboard Shortcuts (Streamer Only):**

- `Alt + G` - Toggle grid overlay with resize handles (drag to resize panels)
- `Alt + T` - Toggle theme menu
- `Alt + L` - Toggle layout selector
- `Escape` - Close menus/grid

## Step 6: Optional Backend Setup

If you want persistent storage:

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Server runs at <http://localhost:8000>

## Step 7: Customize

### Add Custom Theme

Edit `themes.json`:

```json
{
  "themes": {
    "myTheme": {
      "name": "My Theme",
      "colors": {
        "primary": "#yourColor",
        ...
      }
    }
  }
}
```

### Modify Layouts

Edit `src/classes/LayoutManager.js` to add your layout.

### Adjust Styles

Edit `_styles.js` for quick visual tweaks.

## Keyboard Shortcuts

- `Ctrl+Shift+T` - Theme menu
- `Ctrl+Shift+L` - Layout selector

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Commands Don't Work

- Check OAuth token is valid
- Verify bot has mod status
- Check browser console for errors

### Themes Not Loading

- Hard refresh in OBS (right-click → Refresh)
- Check themes.json syntax
- Verify enhanced.css is loaded

### Timer Not Showing

- Check layout setting
- Try `!layout timerWithTasks`
- Verify CircularTimer.js loaded

## Development

### Watch Mode

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Format Code

```bash
npm run format
```

## File Structure

```text
├── index.html              # Main HTML
├── themes.json             # Theme definitions
├── _auth.js               # Twitch credentials
├── _enhancedCommands.js   # Command config
├── src/
│   ├── index-enhanced.js  # Main app (enhanced)
│   ├── app.js            # Core task list
│   └── classes/          # All components
├── styles/
│   ├── enhanced.css      # Modern styles
│   └── app.css          # Original styles
└── backend/
    └── main.py           # Optional API server
```

## Configuration Files

### _settings.js

```javascript
languageCode: "EN",
maxTasksPerUser: 10,
headerFeature: "timer",
testMode: false
```

### _styles.js

Basic style overrides (colors, fonts, sizes)

### themes.json

Complete theme definitions

## Chat Commands Reference

### Everyone

- `!task [text]` - Add task
- `!done [#]` - Mark done
- `!focus [#]` - Focus task
- `!backlog add [text]` - Add to backlog
- `!backlog done [#]` - Complete backlog item
- `!setinfo [field] [value]` - Set profile info
- `!getinfo [user]` - View profile

### Mod Only

- `!theme [name]` - Change theme
- `!layout [name]` - Change layout
- `!pomo [focus]/[break]` - Start timer
- `!stoptimer` - Stop timer
- `!clearlist` - Clear all tasks
- `!backlog clear` - Clear completed

## Performance Tips

1. **Enable "Shutdown when not visible"** in OBS
2. **Use appropriate layout** for your stream resolution
3. **Limit test mode users** to prevent lag
4. **Clear completed tasks** periodically
5. **Use backend** for better performance with many viewers

## Security Notes

- ⚠️ Never commit `_auth.js` with real tokens
- ⚠️ Use `.gitignore` for sensitive files
- ⚠️ Backend: Enable auth for production
- ⚠️ CORS: Restrict origins in production

## Updating

```bash
# Pull latest changes
git pull

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Refresh in OBS
```

## Getting Help

1. Check `ENHANCED_FEATURES.md` for feature docs
2. Check `QUICK_START.md` for basics
3. Check original `README.md` for setup
4. Open GitHub issue for bugs
5. Join Discord (if available)

## Advanced: Production Deployment

### Host Files

- Upload to web server
- Use absolute URLs
- Enable HTTPS

### Deploy Backend

- VPS (DigitalOcean, AWS, etc.)
- Docker container
- Reverse proxy (nginx)
- SSL certificate
- Environment variables for secrets

### Monitor Performance

- Check OBS stats
- Monitor backend logs
- Track API response times
- Watch browser console

## Tips for Success

1. **Start Simple**: Use compact layout first
2. **Test Themes**: Try each theme to find your style
3. **Engage Viewers**: Teach them commands
4. **Use Pomodoro**: Community focus sessions
5. **Profiles**: Encourage !setinfo for community
6. **Iterate**: Add features as you need them

## Next Steps

1. ✅ Complete setup above
2. ✅ Test all features
3. ✅ Choose your theme
4. ✅ Select layout
5. ✅ Start streaming!
6. ✅ Gather feedback
7. ✅ Customize further

---

- **You're ready to go live with a professional overlay! 🚀**

Need help? Check the docs or open an issue!
