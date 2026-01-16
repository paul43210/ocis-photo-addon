# Claude Code Prompt: Pinch-to-Zoom Calendar Groupings

## Project Context
- **Extension:** oCIS Photo-Addon (Vue 3)
- **Local Path:** `/home/AIScripts/ocis-photo-addon/`
- **File to Modify:** `src/views/PhotosView.vue`

## Feature Description

Add pinch gesture support to change the photo grouping level. Pinching controls the "zoom level" of the timeline:

| Gesture | Action | View |
|---------|--------|------|
| Pinch IN (fingers together) | Zoom in / more detail | Day → (already at max) |
| Pinch OUT (fingers apart) | Zoom out / less detail | Day → Week → Month → Year |

This mirrors how Google Photos and Apple Photos work - pinch to zoom changes the grouping granularity.

## Current State

The grouping is already implemented via buttons:
```typescript
const groupMode = ref<GroupMode>('day')  // 'day' | 'week' | 'month' | 'year'

const groupModes = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' }
]
```

The pinch gesture simply needs to change `groupMode` programmatically.

## Implementation

### 1. Add Pinch Gesture Detection

Add touch event handlers to the scroll container:

```typescript
// Pinch gesture state
let initialPinchDistance = 0
let isPinching = false

// Get distance between two touch points
function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function handleTouchStart(event: TouchEvent) {
  if (event.touches.length === 2) {
    isPinching = true
    initialPinchDistance = getTouchDistance(event.touches)
    event.preventDefault() // Prevent browser zoom
  }
}

function handleTouchMove(event: TouchEvent) {
  if (!isPinching || event.touches.length !== 2) return
  
  // Prevent default to stop browser zoom/scroll during pinch
  event.preventDefault()
}

function handleTouchEnd(event: TouchEvent) {
  if (!isPinching) return
  
  if (event.touches.length < 2) {
    // Pinch ended - calculate final distance from changedTouches
    const finalDistance = getTouchDistance(event.changedTouches.length >= 2 
      ? event.changedTouches 
      : event.touches)
    
    // Only trigger if we have a valid comparison
    if (initialPinchDistance > 0 && finalDistance > 0) {
      const ratio = finalDistance / initialPinchDistance
      const threshold = 0.3 // 30% change required to trigger
      
      if (ratio < (1 - threshold)) {
        // Pinch IN - zoom in (more detail)
        zoomIn()
      } else if (ratio > (1 + threshold)) {
        // Pinch OUT - zoom out (less detail)
        zoomOut()
      }
    }
    
    isPinching = false
    initialPinchDistance = 0
  }
}
```

### 2. Add Zoom Functions

```typescript
const zoomLevels: GroupMode[] = ['day', 'week', 'month', 'year']

function zoomIn() {
  const currentIndex = zoomLevels.indexOf(groupMode.value)
  if (currentIndex > 0) {
    groupMode.value = zoomLevels[currentIndex - 1]
  }
}

function zoomOut() {
  const currentIndex = zoomLevels.indexOf(groupMode.value)
  if (currentIndex < zoomLevels.length - 1) {
    groupMode.value = zoomLevels[currentIndex + 1]
  }
}
```

### 3. Attach Event Handlers to Container

Update the template:
```vue
<div 
  class="photos-app" 
  ref="scrollContainer" 
  @scroll="handleScroll"
  @touchstart="handleTouchStart"
  @touchmove="handleTouchMove"
  @touchend="handleTouchEnd"
>
```

### 4. Add CSS to Prevent Browser Zoom

```css
.photos-app {
  touch-action: pan-y; /* Allow vertical scroll, prevent browser pinch-zoom */
}
```

### 5. Visual Feedback (Optional Enhancement)

Show a brief indicator when zoom level changes:

```vue
<transition name="fade">
  <div v-if="showZoomIndicator" class="zoom-indicator">
    {{ groupMode === 'day' ? '📅 Day' : 
       groupMode === 'week' ? '📆 Week' : 
       groupMode === 'month' ? '🗓️ Month' : '📊 Year' }}
  </div>
</transition>
```

```typescript
const showZoomIndicator = ref(false)
let zoomIndicatorTimeout: number | null = null

function showZoomFeedback() {
  showZoomIndicator.value = true
  if (zoomIndicatorTimeout) clearTimeout(zoomIndicatorTimeout)
  zoomIndicatorTimeout = window.setTimeout(() => {
    showZoomIndicator.value = false
  }, 800)
}

// Call showZoomFeedback() in zoomIn() and zoomOut()
```

```css
.zoom-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-size: 1.25rem;
  font-weight: 600;
  z-index: 1000;
  pointer-events: none;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
```

## Alternative: Continuous Pinch (Advanced)

For smoother UX like native photo apps, track pinch continuously and change zoom level at thresholds:

```typescript
function handleTouchMove(event: TouchEvent) {
  if (!isPinching || event.touches.length !== 2) return
  event.preventDefault()
  
  const currentDistance = getTouchDistance(event.touches)
  const ratio = currentDistance / initialPinchDistance
  
  // Change zoom at specific thresholds
  if (ratio < 0.6 && groupMode.value !== 'day') {
    zoomIn()
    initialPinchDistance = currentDistance // Reset baseline
  } else if (ratio > 1.6 && groupMode.value !== 'year') {
    zoomOut()
    initialPinchDistance = currentDistance // Reset baseline
  }
}
```

## Testing

1. **Mobile device or touch-enabled laptop required**
2. Open the photo gallery
3. Place two fingers on the photo grid
4. Pinch OUT (spread fingers) → Should zoom out: Day → Week → Month → Year
5. Pinch IN (bring fingers together) → Should zoom in: Year → Month → Week → Day
6. Verify the "Show by" buttons reflect the current zoom level
7. Verify the groupings update correctly after pinch

## Desktop Alternative (Optional)

For desktop testing, could add scroll-wheel zoom with Ctrl key:
```typescript
function handleWheel(event: WheelEvent) {
  if (event.ctrlKey) {
    event.preventDefault()
    if (event.deltaY > 0) {
      zoomOut()
    } else {
      zoomIn()
    }
  }
}
```

## Build & Deploy
```bash
cd /home/AIScripts/ocis-photo-addon
pnpm build
sudo cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/photo-addon/index.js
# Test on mobile device or touch-enabled display
```
