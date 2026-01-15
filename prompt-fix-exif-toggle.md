# Claude Code Prompt: Fix EXIF Toggle for Search API

## Project Context
- **Extension:** oCIS Photo-Addon (Vue 3)
- **Local Path:** `/home/AIScripts/ocis-photo-addon/`
- **Main File:** `src/views/PhotosView.vue`

## Problem Description

The "EXIF only" toggle checkbox no longer functions after migrating from folder crawling to the WebDAV Search API.

### Current Behavior (Broken)
- The search query **always** uses `photo.takenDateTime` for date filtering
- Photos without EXIF data (no `photo.takenDateTime`) are never returned by the search
- The `exifOnly` toggle only filters the **client-side display** via `displayedPhotos` computed property
- This means users cannot see photos that lack EXIF metadata

### Expected Behavior
- **EXIF toggle ON:** Query filters by `photo.takenDateTime` (only photos with EXIF capture date)
- **EXIF toggle OFF:** Query should return ALL images and sort/group by file `mtime` (modification time)

## Current Code Analysis

### Toggle State (lines ~197-202)
```typescript
const exifOnly = ref(getStoredExifOnly())
```

### Client-side Filter (lines ~261-268) - This works but is insufficient
```typescript
const displayedPhotos = computed(() => {
  if (!exifOnly.value) {
    return allPhotos.value
  }
  return allPhotos.value.filter(photo => {
    return photo.dateSource === 'photo.takenDateTime'
  })
})
```

### Search Query (lines ~757-762) - This is the problem
```typescript
// KQL pattern - ALWAYS uses photo.takenDateTime regardless of toggle
const pattern = `mediatype:image* AND photo.takenDateTime>=${dateRange.start} AND photo.takenDateTime<=${dateRange.end}`
```

## Required Changes

### 1. Modify `fetchPhotosViaSearch()` function
- Accept `exifOnly` parameter
- When `exifOnly === true`: Use current query with `photo.takenDateTime` filter
- When `exifOnly === false`: Use query WITHOUT `photo.takenDateTime` filter, just `mediatype:image*`

### 2. Modify `loadPhotos()` and `loadMorePhotos()` functions
- Pass `exifOnly.value` to `fetchPhotosViaSearch()`

### 3. Add watcher for `exifOnly` toggle
- When toggle changes, reload photos with new query
- Currently only `groupMode` has a watcher that saves to localStorage

### 4. Update sorting logic
- When EXIF OFF: Sort by `lastModifiedDateTime` instead of `photo.takenDateTime`
- The `parseSearchResponse()` function already extracts both dates

## KQL Query Patterns

**EXIF ON (current):**
```
mediatype:image* AND photo.takenDateTime>=${start} AND photo.takenDateTime<=${end}
```

**EXIF OFF (needed):**
```
mediatype:image* AND mtime>=${start} AND mtime<=${end}
```

Note: You may need to verify the correct KQL field name for modification time. Check the oCIS search documentation or test with:
- `mtime`
- `lastModifiedDateTime`
- `getlastmodified`

## Testing

1. Toggle EXIF ON → Should show only photos with EXIF dates
2. Toggle EXIF OFF → Should show ALL photos including those without EXIF
3. Verify photos without EXIF appear grouped by their modification date
4. Verify infinite scroll works in both modes

## Build & Deploy
```bash
cd /home/AIScripts/ocis-photo-addon
pnpm build
sudo cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/photo-addon/index.js
# Hard refresh browser (Ctrl+Shift+R)
```

## Files to Modify
- `src/views/PhotosView.vue` - main view with search logic

## Reference: WebDAV Search Request
The search is done via REPORT method to `/dav/spaces/{spaceId}` with XML body containing KQL pattern in `<oc:pattern>`.
