# Claude Code Prompt: Context Menu (⋮) for Photos

## Project Context
- **Extension:** oCIS Photo-Addon (Vue 3)
- **Local Path:** `/home/AIScripts/ocis-photo-addon/`
- **Files to Modify:** 
  - `src/views/PhotosView.vue` (grid context menu)
  - `src/components/PhotoLightbox.vue` (lightbox context menu)
  - New: `src/components/PhotoContextMenu.vue`

## Problem Description

Users have no way to perform file operations (rename, move, delete, share, download) on photos without leaving the photo view and navigating to the Files app.

## Requirements

### 1. Context Menu Actions (Phase 1 - MVP)
- **Download** - Download original file
- **Open in Files** - Navigate to file location in standard oCIS Files view
- **Copy Link** - Copy shareable link to clipboard
- **Delete** - Delete with confirmation dialog

### 2. Context Menu Actions (Phase 2 - Future)
- Rename
- Move to folder
- Copy to folder
- Share (full sharing dialog)

### 3. Menu Trigger Locations
- **Photo Grid:** "⋮" button in top-right corner of each thumbnail (visible on hover)
- **Lightbox:** "⋮" button in the panel header next to Download button

## Implementation

### Create PhotoContextMenu Component

```vue
<!-- src/components/PhotoContextMenu.vue -->
<template>
  <div v-if="visible" class="context-menu" :style="menuPosition" ref="menuRef">
    <button class="menu-item" @click="handleAction('download')">
      <span class="menu-icon">⬇️</span>
      <span>Download</span>
    </button>
    <button class="menu-item" @click="handleAction('openInFiles')">
      <span class="menu-icon">📁</span>
      <span>Open in Files</span>
    </button>
    <button class="menu-item" @click="handleAction('copyLink')">
      <span class="menu-icon">🔗</span>
      <span>Copy Link</span>
    </button>
    <div class="menu-divider"></div>
    <button class="menu-item menu-item-danger" @click="handleAction('delete')">
      <span class="menu-icon">🗑️</span>
      <span>Delete</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  visible: boolean
  photo: any
  position: { x: number, y: number }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'action', action: string, photo: any): void
}>()

const menuRef = ref<HTMLElement | null>(null)

const menuPosition = computed(() => ({
  top: `${props.position.y}px`,
  left: `${props.position.x}px`
}))

function handleAction(action: string) {
  emit('action', action, props.photo)
  emit('close')
}

// Close menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>

<style>
.context-menu {
  position: fixed;
  background: var(--oc-color-background-default, #fff);
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  padding: 0.5rem 0;
  z-index: 10000;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.6rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--oc-color-text-default, #333);
  text-align: left;
  transition: background 0.15s;
}

.menu-item:hover {
  background: var(--oc-color-background-muted, #f5f5f5);
}

.menu-item-danger {
  color: var(--oc-color-swatch-danger-default, #c00);
}

.menu-item-danger:hover {
  background: rgba(200, 0, 0, 0.1);
}

.menu-icon {
  width: 1.25rem;
  text-align: center;
}

.menu-divider {
  height: 1px;
  background: var(--oc-color-border, #e0e0e0);
  margin: 0.5rem 0;
}
</style>
```

### Add to PhotosView.vue

#### Template
```vue
<!-- Add menu trigger button to photo-item -->
<div class="photo-item" @click="openPhoto(photo)">
  <img ... />
  <button 
    class="photo-menu-btn" 
    @click.stop="openContextMenu($event, photo)"
    aria-label="Photo options"
  >
    ⋮
  </button>
  <div class="photo-overlay">...</div>
</div>

<!-- Add context menu component -->
<PhotoContextMenu
  :visible="contextMenuVisible"
  :photo="contextMenuPhoto"
  :position="contextMenuPosition"
  @close="closeContextMenu"
  @action="handleContextAction"
/>
```

#### Script
```typescript
import PhotoContextMenu from '../components/PhotoContextMenu.vue'

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuPhoto = ref<PhotoWithDate | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })

function openContextMenu(event: MouseEvent, photo: PhotoWithDate) {
  contextMenuPhoto.value = photo
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuPhoto.value = null
}

async function handleContextAction(action: string, photo: PhotoWithDate) {
  switch (action) {
    case 'download':
      await downloadPhoto(photo)
      break
    case 'openInFiles':
      openInFiles(photo)
      break
    case 'copyLink':
      await copyPhotoLink(photo)
      break
    case 'delete':
      await confirmAndDelete(photo)
      break
  }
}

async function downloadPhoto(photo: PhotoWithDate) {
  // Trigger download via blob URL
  const cacheKey = photo.id || photo.fileId || photo.name
  let url = blobUrlCache.get(cacheKey)
  
  if (!url) {
    // Fetch full image if not cached
    // ... fetch logic ...
  }
  
  const link = document.createElement('a')
  link.href = url
  link.download = photo.name || 'photo'
  link.click()
}

function openInFiles(photo: PhotoWithDate) {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const spaceId = personalSpace?.id || ''
  const fileId = photo.fileId || photo.id || ''
  
  // Navigate to Files app with file selected
  const filesUrl = `${serverUrl}/files/spaces/personal/${spaceId}?fileId=${fileId}`
  window.open(filesUrl, '_blank')
}

async function copyPhotoLink(photo: PhotoWithDate) {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const spaceId = personalSpace?.id || ''
  const filePath = (photo as any).filePath || photo.name || ''
  const encodedPath = filePath.split('/').map((s: string) => encodeURIComponent(s)).join('/')
  
  const shareUrl = `${serverUrl}/files/spaces/personal/${spaceId}${encodedPath}`
  
  try {
    await navigator.clipboard.writeText(shareUrl)
    // TODO: Show toast notification "Link copied!"
    alert('Link copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy link:', err)
  }
}

async function confirmAndDelete(photo: PhotoWithDate) {
  const confirmed = confirm(`Are you sure you want to delete "${photo.name}"?\n\nThis action cannot be undone.`)
  if (!confirmed) return
  
  try {
    const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
    const spaceId = personalSpace?.id || ''
    const filePath = (photo as any).filePath || photo.name || ''
    const encodedPath = filePath.split('/').map((s: string) => encodeURIComponent(s)).join('/')
    
    await clientService.httpAuthenticated.delete(
      `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodedPath}`
    )
    
    // Remove from local state
    const photoKey = photo.id || photo.fileId || photo.name
    allPhotos.value = allPhotos.value.filter(p => {
      const key = p.id || p.fileId || p.name
      return key !== photoKey
    })
    loadedPhotoIds.value.delete(photoKey)
    
    // TODO: Show toast "Photo deleted"
  } catch (err) {
    console.error('Failed to delete photo:', err)
    alert('Failed to delete photo. Please try again.')
  }
}
```

#### Styles
```css
.photo-menu-btn {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-item:hover .photo-menu-btn {
  opacity: 1;
}

.photo-menu-btn:hover {
  background: rgba(0, 0, 0, 0.7);
}
```

### Add to PhotoLightbox.vue

Add the same context menu button in the lightbox header:
```vue
<div class="lightbox-header">
  <h3 class="lightbox-title">{{ photo.name }}</h3>
  <div class="lightbox-actions">
    <button class="lightbox-menu-btn" @click.stop="openContextMenu($event)">⋮</button>
    <a :href="imageBlobUrl" class="lightbox-download" ...>Download</a>
  </div>
</div>
```

## API Reference

### Delete File (WebDAV)
```
DELETE /dav/spaces/{spaceId}/{filePath}
Authorization: Bearer {token}
```

### Get Shareable Link
For proper sharing with permissions, use the Graph API:
```
POST /graph/v1.0/drives/{driveId}/items/{itemId}/createLink
Content-Type: application/json

{ "type": "view" }
```

## Testing

1. Hover over photo thumbnail → "⋮" button appears
2. Click "⋮" → context menu appears at click position
3. Click outside menu → menu closes
4. Test each action:
   - Download: File downloads with correct name
   - Open in Files: Opens new tab to file location
   - Copy Link: Shows confirmation, link is in clipboard
   - Delete: Shows confirmation, removes photo from view

## Build & Deploy
```bash
cd /home/AIScripts/ocis-photo-addon
pnpm build
sudo cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/photo-addon/index.js
# Hard refresh browser (Ctrl+Shift+R)
```
