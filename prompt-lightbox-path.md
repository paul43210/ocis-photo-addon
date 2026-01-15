# Claude Code Prompt: Display Photo Path in Lightbox

## Project Context
- **Extension:** oCIS Photo-Addon (Vue 3)
- **Local Path:** `/home/AIScripts/ocis-photo-addon/`
- **File to Modify:** `src/components/PhotoLightbox.vue`

## Problem Description

Users cannot see where a photo is stored in their file system when viewing it in the lightbox. This makes it difficult to locate the original file or understand the folder organization.

## Current State

- The lightbox shows the filename in `<h3 class="lightbox-title">{{ photo.name }}</h3>`
- The `filePath` property is already available on photo objects (set in `PhotosView.vue` → `parseSearchResponse()`)
- No folder/path information is currently displayed

## Requirements

### 1. Display File Path
- Show the full folder path below the photo title (not including the filename)
- Example: If `filePath` is `/Photos/2024/Vacation/beach.jpg`, display `/Photos/2024/Vacation/`
- Style it as muted/secondary text below the title

### 2. Make Path Clickable (Optional Enhancement)
- Each path segment could be a link
- Clicking opens that folder in the standard oCIS Files view
- URL format: `https://{server}/files/spaces/personal/{spaceId}?fileId={folderId}`
- Note: This may require looking up folder IDs - can be deferred if complex

## Implementation

### Template Changes
Add path display below the title in the `.lightbox-header` section:

```vue
<div class="lightbox-header">
  <div class="lightbox-title-group">
    <h3 class="lightbox-title">{{ photo.name || 'Untitled' }}</h3>
    <span v-if="folderPath" class="lightbox-path">{{ folderPath }}</span>
  </div>
  <a :href="imageBlobUrl" class="lightbox-download" ...>Download</a>
</div>
```

### Computed Property
```typescript
const folderPath = computed(() => {
  const p = props.photo as PhotoWithDate
  if (!p?.filePath) return ''
  // Remove filename from path
  const lastSlash = p.filePath.lastIndexOf('/')
  if (lastSlash <= 0) return '/'
  return p.filePath.substring(0, lastSlash + 1)
})
```

### Styles
```css
.lightbox-title-group {
  flex: 1;
  min-width: 0; /* Allow text truncation */
  margin-right: 1rem;
}

.lightbox-path {
  display: block;
  font-size: 0.8rem;
  color: var(--oc-color-text-muted, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.25rem;
}
```

## Testing

1. Open a photo from a nested folder structure
2. Verify the path displays correctly (without the filename)
3. Verify path truncates gracefully on narrow screens
4. Verify photos at root level show "/" or handle gracefully

## Build & Deploy
```bash
cd /home/AIScripts/ocis-photo-addon
pnpm build
sudo cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/photo-addon/index.js
# Hard refresh browser (Ctrl+Shift+R)
```
