# Claude Code Prompt: Breadcrumb Navigation in Photo View

## Project Context
- **Extension:** oCIS Photo-Addon (Vue 3)
- **Local Path:** `/home/AIScripts/ocis-photo-addon/`
- **File to Modify:** `src/views/PhotosView.vue`

## Problem Description

Users viewing the photo timeline have no way to filter by folder or navigate the folder hierarchy. All photos are shown in a flat timeline regardless of their folder location.

## Requirements

### 1. Folder Filter / Breadcrumb Bar
Add a breadcrumb navigation bar that allows users to:
- See they're viewing "All Photos" by default
- Click on a folder from any photo to filter to that folder
- Navigate up the folder hierarchy via breadcrumbs
- Return to "All Photos" view

### 2. UI Location
- Add below the main header controls (after the EXIF toggle)
- Or as a collapsible filter panel

### 3. Interaction Flow

**Default State:**
```
📁 All Photos
```

**When User Clicks a Folder (from photo or breadcrumb):**
```
📁 All Photos > Photos > 2024 > Vacation
```

**Clicking "All Photos" returns to unfiltered view.**
**Clicking "2024" filters to that folder and its subfolders.**

## Implementation Approach

### Option A: Client-Side Filter (Simpler)
- Store `selectedFolder` state
- Filter `displayedPhotos` by path prefix
- Pros: Fast, no additional API calls
- Cons: Only works for already-loaded photos

### Option B: Server-Side Search Filter (Better)
- Add folder path to KQL search query
- Modify `fetchPhotosViaSearch()` to include path filter
- Pros: Works with progressive loading, accurate counts
- Cons: More complex, may need backend testing

### Recommended: Start with Option A

### State Management
```typescript
const selectedFolder = ref<string | null>(null) // null = all photos

const breadcrumbParts = computed(() => {
  if (!selectedFolder.value) return []
  return selectedFolder.value.split('/').filter(Boolean)
})

const displayedPhotos = computed(() => {
  let photos = allPhotos.value
  
  // Apply EXIF filter
  if (exifOnly.value) {
    photos = photos.filter(p => p.dateSource === 'photo.takenDateTime')
  }
  
  // Apply folder filter
  if (selectedFolder.value) {
    photos = photos.filter(p => {
      const path = (p as any).filePath || ''
      return path.startsWith(selectedFolder.value!)
    })
  }
  
  return photos
})
```

### Template Addition
```vue
<!-- Breadcrumb Navigation -->
<div class="breadcrumb-nav">
  <button 
    class="breadcrumb-item" 
    :class="{ active: !selectedFolder }"
    @click="selectedFolder = null"
  >
    📁 All Photos
  </button>
  <template v-for="(part, index) in breadcrumbParts" :key="index">
    <span class="breadcrumb-separator">›</span>
    <button 
      class="breadcrumb-item"
      :class="{ active: index === breadcrumbParts.length - 1 }"
      @click="navigateToBreadcrumb(index)"
    >
      {{ part }}
    </button>
  </template>
</div>
```

### Method to Navigate
```typescript
function navigateToBreadcrumb(index: number) {
  const parts = breadcrumbParts.value.slice(0, index + 1)
  selectedFolder.value = '/' + parts.join('/') + '/'
}

function selectFolder(folderPath: string) {
  // Extract folder from file path (remove filename)
  const lastSlash = folderPath.lastIndexOf('/')
  selectedFolder.value = lastSlash > 0 ? folderPath.substring(0, lastSlash + 1) : '/'
}
```

### Add Folder Click to Photo Items
In the photo grid, add a way to filter by folder (could be via context menu or overlay icon):
```vue
<div class="photo-item" @click="openPhoto(photo)">
  <!-- existing content -->
  <button 
    class="folder-filter-btn" 
    @click.stop="selectFolder(photo.filePath)"
    title="Show photos from this folder"
  >
    📁
  </button>
</div>
```

### Styles
```css
.breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0;
  flex-wrap: wrap;
  font-size: 0.875rem;
}

.breadcrumb-item {
  background: none;
  border: none;
  color: var(--oc-color-swatch-primary-default, #0070c0);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.15s;
}

.breadcrumb-item:hover {
  background: var(--oc-color-background-muted, #f0f0f0);
}

.breadcrumb-item.active {
  color: var(--oc-color-text-default, #333);
  font-weight: 600;
  cursor: default;
}

.breadcrumb-separator {
  color: var(--oc-color-text-muted, #999);
}

.folder-filter-btn {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 4px;
  padding: 0.25rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 0.75rem;
}

.photo-item:hover .folder-filter-btn {
  opacity: 1;
}
```

## Testing

1. Default view shows "All Photos" with all photos
2. Click folder icon on a photo → filters to that folder
3. Breadcrumbs update to show path
4. Click any breadcrumb segment → navigates to that level
5. Click "All Photos" → returns to unfiltered view
6. Photo count updates correctly when filtered

## Build & Deploy
```bash
cd /home/AIScripts/ocis-photo-addon
pnpm build
sudo cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/photo-addon/index.js
# Hard refresh browser (Ctrl+Shift+R)
```
