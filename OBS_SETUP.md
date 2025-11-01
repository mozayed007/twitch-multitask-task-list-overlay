# 🎬 OBS Setup Guide - Fixed for 1920x1080

## ✅ Layout Fixed for OBS

Your overlay is now **properly configured** for 1920x1080 resolution in OBS Browser Source.

---

## 📐 What Was Fixed

### **Problem:**

- CSS was using scaling (`* 2`) causing layout to break
- Viewport wasn't fixed to 1920x1080
- Components weren't positioned correctly for OBS

### **Solution:**

- ✅ Fixed viewport to 1920x1080
- ✅ Removed problematic scaling
- ✅ Added `obs-fix.css` with proper grid layouts
- ✅ Set fixed dimensions for all components
- ✅ Ensured transparent background works in OBS

---

## 🎯 OBS Browser Source Settings

### **Step 1: Add Browser Source**

1. In OBS Studio, click **+** in Sources
2. Select **Browser**
3. Name it: `Task List Overlay`
4. Use these **EXACT** settings:

```
☑️ Local file: YES
📁 Local File: F:\Streaming-business\twitch-multitask-task-list-overlay-main\index.html

Width: 1920
Height: 1080

FPS: 30

☑️ Shutdown source when not visible: NO
☑️ Refresh browser when scene becomes active: YES
☐ Control audio via OBS: NO

Custom CSS: (leave blank)
```

5. Click **OK**

### **Step 2: Position the Overlay**

The overlay will now **fill the entire 1920x1080 canvas**. You can:

- **Keep it full screen** for dashboard layouts
- **Crop it** (Alt+Click drag) to show only part
- **Scale it down** (Ctrl+drag corner) for smaller overlay
- **Position it** anywhere in your scene

---

## 🎨 Layout Behavior in OBS

Each layout preset is now **perfectly sized** for 1920x1080:

### **Compact Layout** (`!layout compact`)

```
Grid: 300px timer | Rest for tasks
Perfect for: Corner overlay during gameplay
Recommended crop: Right side only (1620x1080)
```

### **Split Layout** (`!layout split`)

```
Grid: 3 equal columns (640px each)
Perfect for: Bottom third overlay
Recommended crop: Keep all or crop to 1920x360
```

### **Full Overlay** (`!layout fullOverlay`)

```
Grid: Full 1920x1080 with all panels
Perfect for: Intermission/BRB scenes
Use full screen - no cropping needed
```

### **Minimal Layout** (`!layout minimal`)

```
Grid: Centered 600px column
Perfect for: Clean minimal look
Recommended: Crop sides, keep center 600px wide
```

### **Timer With Tasks** (`!layout timerWithTasks`)

```
Grid: 400px timer | Rest for tasks
Perfect for: Side panel during streams
Recommended crop: Show left or right half
```

### **Dashboard** (`!layout dashboard`)

```
Grid: 2x3 grid showing everything
Perfect for: Productivity streams
Use full screen or scale to 80%
```

---

## 🎬 Recommended OBS Scene Setups

### **Scene 1: Gameplay with Overlay**

```
Browser Source Settings:
- Layout: compact
- Position: Bottom-right corner
- Transform: Scale to 60%, Crop left 800px
- Result: Clean timer + tasks in corner
```

### **Scene 2: Just Chatting**

```
Browser Source Settings:
- Layout: split
- Position: Bottom third
- Transform: Crop top 720px (keep bottom 360px)
- Result: 3-column info bar at bottom
```

### **Scene 3: Productivity/Coding**

```
Browser Source Settings:
- Layout: timerWithTasks
- Position: Right side
- Transform: Crop left half, scale to 80%
- Result: Timer + tasks sidebar
```

### **Scene 4: BRB/Intermission**

```
Browser Source Settings:
- Layout: fullOverlay
- Position: Full screen
- Transform: None (use as-is)
- Result: Beautiful full-screen dashboard
```

---

## 🔧 Testing the Layout

### **In OBS:**

1. Add the browser source with settings above
2. Test theme switching:

   ```
   !theme ocean
   ```

   - Should see instant color change
   - All panels should stay in position

3. Test layout switching:

   ```
   !layout split
   ```

   - Should see layout rearrange smoothly
   - Everything fits within 1920x1080

4. Start a timer:

   ```
   !pomo 1/1
   ```

   - Circular timer should be visible and sized correctly
   - Progress ring should animate smoothly

5. Add tasks:

   ```
   !add Test task
   !backlog add Test backlog @high
   ```

   - Text should be readable
   - Panels should not overflow

---

## 💡 Pro Tips for OBS

### **Tip 1: Use Transform for Different Scenes**

Right-click source → **Transform** → **Edit Transform**

- Set different positions/scales per scene
- Save as source properties (not scene-specific)

### **Tip 2: Crop for Gameplay**

1. Hold **Alt** and drag edges to crop
2. Remove empty space around active panels
3. Common crops:
   - Show only timer: Crop to 300x300
   - Show only tasks: Crop to center 600px
   - Bottom bar: Crop top 720px

### **Tip 3: Add Filters for Polish**

Right-click source → **Filters** → Add:

- **Color Correction** - Adjust brightness/contrast
- **Opacity** - Make it more subtle (try 85-90%)
- **Blur** - Slight background blur (1-2px)
- **Chroma Key** - Usually not needed (already transparent)

### **Tip 4: Multiple Instances**

Add the same source multiple times:

1. Right-click source → **Duplicate**
2. In each scene, set different layout via `!layout` command
3. Use scene-specific show/hide

### **Tip 5: Keyboard Shortcuts Work in OBS**

When browser source is active:

- **Ctrl+Shift+T** - Theme menu (works in OBS browser)
- **Ctrl+Shift+L** - Layout menu (works in OBS browser)

---

## 🐛 Troubleshooting

### **Layout looks broken?**

✅ **Solution:**

1. Check browser source dimensions are **1920 x 1080**
2. Right-click source → **Properties** → Verify settings
3. Right-click source → **Refresh**
4. Try: `!layout compact` then `!layout split`

### **Text is too small?**

✅ **Solution:**

1. The overlay is designed for 1920x1080
2. If OBS canvas is different size, scale the source:
   - Right-click → Transform → Scale
   - Or hold Ctrl and drag corner

### **Components overlapping?**

✅ **Solution:**

1. Reset layout: `!layout minimal`
2. Clear localStorage:
   - F12 in OBS → Console
   - Type: `localStorage.clear()`
   - Press Enter
3. Refresh source
4. Set layout again: `!layout split`

### **Theme not applying?**

✅ **Solution:**

1. Verify `obs-fix.css` is loaded:
   - F12 → Network tab → Look for obs-fix.css
2. Check `themes.json` is in root folder
3. Try: `!theme minimal` (always works)
4. Refresh browser source

### **Transparent background not working?**

✅ **Solution:**

- The overlay IS transparent by default
- If you see a background:
  1. Check OBS → Settings → Advanced
  2. Set Color Format: NV12
  3. Restart OBS
- No need for Color Key filter!

---

## 📏 Dimensions Reference

Fixed dimensions in OBS layout:

```
Full Canvas: 1920 x 1080

Timer (Circular): 200-300px diameter
Task List: Min 400px wide
Backlog Panel: Min 300px wide
Info Panel: Min 300px wide
Header Height: ~60px
Padding: 30px around edges

Grid Gaps: 20px between components
```

---

## ✅ Checklist

- [ ] Browser source set to **1920 x 1080**
- [ ] Local file points to `index.html` in project folder
- [ ] **FPS: 30** (smooth animations)
- [ ] **Refresh when scene active: YES**
- [ ] Test with `!theme ocean` - changes instantly
- [ ] Test with `!layout split` - rearranges properly
- [ ] Test with `!timer 1` - circular timer visible
- [ ] All text is readable at your stream resolution
- [ ] Background is transparent (no black box)
- [ ] Theme button (🎨) visible in top-right
- [ ] Ctrl+Shift+T opens theme menu
- [ ] Ctrl+Shift+L opens layout menu

---

## 🎉 You're All Set

The overlay is now **perfectly configured** for OBS at 1920x1080!

Switch themes and layouts on the fly:

```
!theme cyberpunk
!layout dashboard
!pomo 25/5
```

Everything will stay perfectly positioned! 🚀✨

---

## 📚 Related Files

- **obs-fix.css** - Layout fixes for OBS (new!)
- **enhanced.css** - Modern UI styles
- **index.html** - Now with fixed viewport
- **HOW_TO_USE.md** - Complete command reference
- **QUICK_USE.md** - 5-minute quick start

Happy streaming! 🎬
