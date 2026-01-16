# Claude Code Prompt: Map View with Leaflet.js

## Project Context
- **Extension:** oCIS Photo-Addon (Vue 3)
- **Local Path:** `/home/AIScripts/ocis-photo-addon/`
- **Files to Modify/Create:**
  - `src/views/PhotosView.vue` (replace map placeholder)
  - `src/components/PhotoMap.vue` (new component)

## Feature Description

Replace the map placeholder with an interactive Leaflet.js map showing photos with GPS coordinates. Users can:
- See photo markers clustered by location
- Click a marker to open the photo in lightbox
- Click a cluster to zoom in
- Pan and zoom the map freely

## Dependencies

Install these packages first:
```bash
cd /home/AIScripts/ocis-photo-addon
pnpm add leaflet leaflet.markercluster
pnpm add -D @types/leaflet
```

## Implementation

### 1. Create PhotoMap Component

```vue
<!-- src/components/PhotoMap.vue -->
<template>
  <div class="photo-map-container">
    <div ref="mapContainer" class="map-element"></div>
    <div v-if="photosWithGps.length === 0" class="no-gps-overlay">
      <span class="icon">📍</span>
      <p>No photos with GPS data found</p>
    </div>
    <div class="map-stats">
      {{ photosWithGps.length }} photos with location data
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

// Fix Leaflet default marker icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

interface GeoCoordinates {
  latitude?: number
  longitude?: number
}

interface PhotoWithLocation {
  id: string
  name: string
  filePath?: string
  graphPhoto?: {
    location?: GeoCoordinates
    takenDateTime?: string
  }
  thumbnailUrl?: string
}

const props = defineProps<{
  photos: PhotoWithLocation[]
  getThumbnailUrl: (photo: PhotoWithLocation) => string
}>()

const emit = defineEmits<{
  (e: 'photo-click', photo: PhotoWithLocation): void
}>()

const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let markerClusterGroup: L.MarkerClusterGroup | null = null

// Filter photos that have GPS coordinates
const photosWithGps = computed(() => {
  return props.photos.filter(photo => {
    const loc = photo.graphPhoto?.location
    return loc?.latitude != null && loc?.longitude != null
  })
})

// Initialize map
onMounted(() => {
  if (!mapContainer.value) return

  // Create map centered on first photo or default location
  const firstPhoto = photosWithGps.value[0]
  const defaultCenter: L.LatLngExpression = firstPhoto?.graphPhoto?.location
    ? [firstPhoto.graphPhoto.location.latitude!, firstPhoto.graphPhoto.location.longitude!]
    : [45.4215, -75.6972] // Ottawa as default

  map = L.map(mapContainer.value, {
    center: defaultCenter,
    zoom: 10,
    zoomControl: true,
  })

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  // Create marker cluster group
  markerClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount()
      let size = 'small'
      if (count > 10) size = 'medium'
      if (count > 50) size = 'large'
      return L.divIcon({
        html: `<div><span>${count}</span></div>`,
        className: `marker-cluster marker-cluster-${size}`,
        iconSize: L.point(40, 40),
      })
    },
  })

  map.addLayer(markerClusterGroup)

  // Add markers
  addMarkers()

  // Fit bounds to show all markers
  if (photosWithGps.value.length > 0) {
    fitBoundsToMarkers()
  }
})

// Watch for photo changes
watch(() => props.photos, () => {
  if (markerClusterGroup) {
    markerClusterGroup.clearLayers()
    addMarkers()
    if (photosWithGps.value.length > 0) {
      fitBoundsToMarkers()
    }
  }
}, { deep: true })

function addMarkers() {
  if (!markerClusterGroup) return

  for (const photo of photosWithGps.value) {
    const loc = photo.graphPhoto?.location
    if (!loc?.latitude || !loc?.longitude) continue

    // Create custom icon with thumbnail
    const thumbnailUrl = props.getThumbnailUrl(photo)
    const customIcon = L.divIcon({
      className: 'photo-marker',
      html: `
        <div class="photo-marker-inner">
          <img src="${thumbnailUrl}" alt="${photo.name}" />
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 50],
      popupAnchor: [0, -50],
    })

    const marker = L.marker([loc.latitude, loc.longitude], {
      icon: customIcon,
      title: photo.name,
    })

    // Popup with photo info
    const popupContent = `
      <div class="photo-popup">
        <img src="${thumbnailUrl}" alt="${photo.name}" />
        <div class="popup-info">
          <strong>${photo.name}</strong>
          ${photo.graphPhoto?.takenDateTime 
            ? `<br><small>${new Date(photo.graphPhoto.takenDateTime).toLocaleDateString()}</small>` 
            : ''}
        </div>
      </div>
    `
    marker.bindPopup(popupContent, { maxWidth: 200 })

    // Click handler to open lightbox
    marker.on('click', () => {
      emit('photo-click', photo)
    })

    markerClusterGroup.addLayer(marker)
  }
}

function fitBoundsToMarkers() {
  if (!map || !markerClusterGroup) return
  
  const bounds = markerClusterGroup.getBounds()
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
  }
}

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style>
.photo-map-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 150px);
  min-height: 400px;
}

.map-element {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
}

.no-gps-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 2rem 3rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.no-gps-overlay .icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.no-gps-overlay p {
  margin: 0;
  color: #666;
}

.map-stats {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #333;
  z-index: 1000;
}

/* Photo marker styles */
.photo-marker {
  background: transparent;
  border: none;
}

.photo-marker-inner {
  width: 46px;
  height: 46px;
  border-radius: 6px;
  overflow: hidden;
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  background: #f0f0f0;
}

.photo-marker-inner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Cluster styles */
.marker-cluster {
  background: rgba(0, 112, 192, 0.6);
  border-radius: 50%;
}

.marker-cluster div {
  width: 30px;
  height: 30px;
  margin: 5px;
  background: rgba(0, 112, 192, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.marker-cluster span {
  color: #fff;
  font-weight: 600;
  font-size: 12px;
}

.marker-cluster-small {
  background: rgba(0, 112, 192, 0.5);
}

.marker-cluster-medium {
  background: rgba(0, 112, 192, 0.6);
}

.marker-cluster-large {
  background: rgba(0, 112, 192, 0.7);
}

/* Popup styles */
.photo-popup {
  text-align: center;
}

.photo-popup img {
  width: 150px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.popup-info {
  font-size: 0.85rem;
}

.popup-info strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}
</style>
```

### 2. Update PhotosView.vue

Replace the map placeholder with the PhotoMap component:

```vue
<!-- In template, replace the map-placeholder div -->
<div v-if="!error && viewType === 'map'" class="map-view-container">
  <PhotoMap
    :photos="displayedPhotos"
    :get-thumbnail-url="getPhotoUrl"
    @photo-click="openPhotoFromMap"
  />
</div>
```

```typescript
// Add import at top
import PhotoMap from '../components/PhotoMap.vue'

// Add handler function
function openPhotoFromMap(photo: PhotoWithDate) {
  openPhoto(photo)
}
```

### 3. Handle Leaflet CSS Import

If Leaflet CSS doesn't load properly via imports, add to the component or global styles:

```typescript
// Alternative: import in script
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
```

Or create a CSS file that's imported globally.

### 4. Handle Marker Icon Issue (Vite/Rollup)

Leaflet has a known issue with marker icons in bundlers. The fix is in the component, but if icons still don't show:

```typescript
// Alternative fix - use CDN icons
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})
```

## Features Implemented

1. **Map Display** - OpenStreetMap tiles via Leaflet
2. **Photo Markers** - Custom markers showing photo thumbnails
3. **Clustering** - Groups nearby photos into clusters with count
4. **Click to View** - Click marker opens photo in lightbox
5. **Auto-fit Bounds** - Map zooms to show all photo markers
6. **Stats Display** - Shows count of photos with GPS data
7. **Empty State** - Message when no photos have GPS coordinates

## Future Enhancements (Not in this prompt)

- Search within visible map bounds
- Filter by date range on map
- Heatmap view option
- Draw selection to view photos in area
- Sync map position with scroll position in calendar view

## Testing

1. Switch to Map view using the toggle button
2. Verify map loads with OpenStreetMap tiles
3. Verify photo markers appear for photos with GPS data
4. Click a marker → should open photo in lightbox
5. Click a cluster → should zoom in to show individual markers
6. Pan and zoom the map freely
7. Check "X photos with location data" counter

## Build & Deploy
```bash
cd /home/AIScripts/ocis-photo-addon
pnpm build
sudo cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/photo-addon/index.js
# Hard refresh browser (Ctrl+Shift+R)
```

## Troubleshooting

**Map doesn't render:**
- Check console for Leaflet errors
- Ensure container has explicit height
- Verify CSS is imported

**Markers don't show icons:**
- Use the CDN icon fix above
- Check network tab for 404 on marker images

**Clusters not working:**
- Ensure leaflet.markercluster is installed
- Check that MarkerClusterGroup is imported from the plugin

**TypeScript errors:**
- Ensure @types/leaflet is installed
- May need to declare module for markercluster:
```typescript
// src/shims-leaflet.d.ts
declare module 'leaflet.markercluster'
```
