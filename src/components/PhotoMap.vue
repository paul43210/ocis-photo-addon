<template>
  <div class="photo-map-wrapper">
    <div class="photo-map-container">
      <div ref="mapContainer" class="map-element"></div>
      <div v-if="photosWithGps === 0" class="no-gps-overlay">
        <span class="icon">📍</span>
        <p>No photos with GPS data found</p>
      </div>
      <div class="map-stats">
        {{ visiblePhotosInView.length }} of {{ photosWithGps }} photos in view
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'  // Bundle CSS instead of CDN (CSP blocks external stylesheets)

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
  (e: 'photo-click', photo: PhotoWithLocation, group: PhotoWithLocation[]): void
  (e: 'visible-count-change', visibleCount: number, totalCount: number): void
}>()

const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let resizeObserver: ResizeObserver | null = null
let hadStoredPosition = false  // Track if we restored from localStorage

// Visible photos in current viewport
const visiblePhotosInView = ref<PhotoWithLocation[]>([])

// LocalStorage keys for map position persistence
const STORAGE_KEY_MAP_CENTER = 'photo-addon:map-center'
const STORAGE_KEY_MAP_ZOOM = 'photo-addon:map-zoom'

// Cluster radius in meters (photos within this distance are grouped)
// Map view uses 1km clustering for broader geographic grouping
const CLUSTER_RADIUS_METERS = 1000

// Get stored map position
function getStoredMapPosition(): { center: [number, number], zoom: number } | null {
  try {
    const centerStr = localStorage.getItem(STORAGE_KEY_MAP_CENTER)
    const zoomStr = localStorage.getItem(STORAGE_KEY_MAP_ZOOM)
    if (centerStr && zoomStr) {
      const center = JSON.parse(centerStr) as [number, number]
      const zoom = parseInt(zoomStr, 10)
      if (Array.isArray(center) && center.length === 2 && !isNaN(zoom)) {
        return { center, zoom }
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

// Save map position to localStorage
function saveMapPosition() {
  if (!map) return
  try {
    const center = map.getCenter()
    const zoom = map.getZoom()
    localStorage.setItem(STORAGE_KEY_MAP_CENTER, JSON.stringify([center.lat, center.lng]))
    localStorage.setItem(STORAGE_KEY_MAP_ZOOM, String(zoom))
  } catch (e) {
    // ignore
  }
}

// Count photos with GPS (total)
const photosWithGps = computed(() => {
  return props.photos.filter(photo => {
    const loc = photo.graphPhoto?.location
    return loc?.latitude != null && loc?.longitude != null
  }).length
})

// Update visible photos based on current map bounds
function updateVisiblePhotos() {
  if (!map) {
    visiblePhotosInView.value = []
    return
  }

  const bounds = map.getBounds()
  const visible = props.photos.filter(photo => {
    const loc = photo.graphPhoto?.location
    if (loc?.latitude == null || loc?.longitude == null) return false
    return bounds.contains([loc.latitude, loc.longitude])
  })

  visiblePhotosInView.value = visible
  console.log('[PhotoMap] Visible photos in viewport:', visible.length, 'of', photosWithGps.value)
  emit('visible-count-change', visible.length, photosWithGps.value)
}

// Calculate distance between two points in meters (Haversine formula)
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Cluster photos by geographic proximity
interface PhotoCluster {
  photos: PhotoWithLocation[]
  centerLat: number
  centerLng: number
  representativePhoto: PhotoWithLocation // Most recent photo in cluster
}

function clusterPhotos(photos: PhotoWithLocation[]): PhotoCluster[] {
  const photosWithLocation = photos.filter(p =>
    p.graphPhoto?.location?.latitude != null &&
    p.graphPhoto?.location?.longitude != null
  )

  if (photosWithLocation.length === 0) return []

  const clusters: PhotoCluster[] = []
  const assigned = new Set<string>()

  for (const photo of photosWithLocation) {
    const photoId = photo.id
    if (assigned.has(photoId)) continue

    const lat = photo.graphPhoto!.location!.latitude!
    const lng = photo.graphPhoto!.location!.longitude!

    // Find all nearby photos not yet assigned
    const nearby: PhotoWithLocation[] = [photo]
    assigned.add(photoId)

    for (const other of photosWithLocation) {
      const otherId = other.id
      if (assigned.has(otherId)) continue

      const otherLat = other.graphPhoto!.location!.latitude!
      const otherLng = other.graphPhoto!.location!.longitude!
      const distance = getDistanceMeters(lat, lng, otherLat, otherLng)

      if (distance <= CLUSTER_RADIUS_METERS) {
        nearby.push(other)
        assigned.add(otherId)
      }
    }

    // Sort by date (most recent first) and pick representative
    nearby.sort((a, b) => {
      const dateA = a.graphPhoto?.takenDateTime ? new Date(a.graphPhoto.takenDateTime).getTime() : 0
      const dateB = b.graphPhoto?.takenDateTime ? new Date(b.graphPhoto.takenDateTime).getTime() : 0
      return dateB - dateA // Most recent first
    })

    // Calculate cluster center
    let sumLat = 0, sumLng = 0
    for (const p of nearby) {
      sumLat += p.graphPhoto!.location!.latitude!
      sumLng += p.graphPhoto!.location!.longitude!
    }

    clusters.push({
      photos: nearby,
      centerLat: sumLat / nearby.length,
      centerLng: sumLng / nearby.length,
      representativePhoto: nearby[0]
    })
  }

  return clusters
}

// Inject critical CSS overrides (must be global, not scoped)
function injectTileFixCSS() {
  if (document.getElementById('leaflet-tile-fix')) return

  const style = document.createElement('style')
  style.id = 'leaflet-tile-fix'
  style.textContent = `
    /* === Leaflet CSS Fixes for oCIS Photo Addon === */

    /* The map container needs absolute positioning to work properly */
    .photo-map-container .leaflet-container {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: auto !important;
      height: auto !important;
      overflow: hidden !important;
      background: #ddd !important;
    }

    /* Panes need absolute positioning with base coordinates */
    .leaflet-pane,
    .leaflet-map-pane,
    .leaflet-tile-pane {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
    }

    /* Tile container - holds grid of tiles */
    .leaflet-tile-container {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      display: block !important;
    }

    /* Individual tiles - positioned via transforms by Leaflet */
    .leaflet-tile {
      position: absolute !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }

    /* Tile images - slightly oversized to prevent gap bug */
    .leaflet-tile-container img.leaflet-tile {
      width: 256.5px !important;
      height: 256.5px !important;
      max-width: none !important;
      max-height: none !important;
    }

    /* Overlay pane for markers - needs proper z-index and transforms */
    .leaflet-overlay-pane {
      z-index: 400 !important;
    }
    .leaflet-overlay-pane svg {
      overflow: visible !important;
      pointer-events: auto !important;
    }
    .leaflet-overlay-pane svg path {
      pointer-events: auto !important;
      cursor: pointer !important;
    }
    .leaflet-interactive {
      pointer-events: auto !important;
      cursor: pointer !important;
    }
    .leaflet-marker-pane {
      z-index: 600 !important;
    }
    .leaflet-tooltip-pane {
      z-index: 650 !important;
    }
    .leaflet-popup-pane {
      z-index: 700 !important;
    }

    /* Zoom animation - markers must follow map transforms */
    .leaflet-zoom-animated {
      transform-origin: 0 0 !important;
    }

    /* Wrapper constraint - fill parent and clip the map */
    .photo-map-wrapper {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      z-index: 0 !important; /* Stay below oCIS header dropdowns */
    }

    .photo-map-container {
      position: relative !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }

    /* Parent container in PhotosView - needs relative for absolute children */
    .map-view-container {
      position: relative !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }

    /* Photo thumbnail tooltip styles - disable Leaflet animations */
    .photo-marker-tooltip {
      padding: 0 !important;
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
      transition: none !important;
      opacity: 1 !important;
    }
    .photo-marker-tooltip.leaflet-tooltip {
      transition: none !important;
    }
    .leaflet-tooltip {
      transition: none !important;
    }
    .photo-marker-tooltip .leaflet-tooltip-content {
      margin: 0 !important;
    }
    /* Remove tooltip arrow */
    .photo-marker-tooltip::before {
      display: none !important;
    }
    .map-photo-tooltip {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      overflow: hidden;
      min-width: 120px;
      max-width: 180px;
    }
    .map-photo-tooltip img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      display: block;
      background: #f0f0f0;
    }
    .map-photo-tooltip .tooltip-info {
      padding: 8px;
      text-align: center;
    }
    .map-photo-tooltip .tooltip-name {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .map-photo-tooltip .tooltip-date {
      display: block;
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }
    .map-photo-tooltip .tooltip-count {
      display: inline-block;
      background: #e65100;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      margin-bottom: 4px;
    }
  `
  document.head.appendChild(style)
}

function initMap() {
  if (!mapContainer.value) {
    console.error('[PhotoMap] No container element')
    return
  }

  // Check for stored map position first
  const storedPosition = getStoredMapPosition()

  let center: L.LatLngExpression
  let initialZoom: number

  if (storedPosition) {
    // Use stored position
    center = storedPosition.center
    initialZoom = storedPosition.zoom
    hadStoredPosition = true
    console.log('[PhotoMap] Restoring saved position:', center, 'zoom:', initialZoom)
  } else {
    hadStoredPosition = false
    // Find center from photos with GPS, or default to Canada
    const photosWithLocation = props.photos.filter(p =>
      p.graphPhoto?.location?.latitude != null &&
      p.graphPhoto?.location?.longitude != null
    )

    center = [56, -96] // Canada default
    initialZoom = 4

    if (photosWithLocation.length > 0) {
      const first = photosWithLocation[0]
      center = [
        first.graphPhoto!.location!.latitude!,
        first.graphPhoto!.location!.longitude!
      ]
      initialZoom = 6
    }
  }

  // Create map with INTEGER zoom to minimize gap issues
  map = L.map(mapContainer.value, {
    center: center,
    zoom: initialZoom,
    zoomSnap: 1,      // Force integer zoom levels only
    zoomDelta: 1,     // Zoom by whole levels
    wheelPxPerZoomLevel: 120, // Require more scroll for zoom
  })

  // Save position and update visible photos when map moves or zooms
  map.on('moveend', () => {
    saveMapPosition()
    updateVisiblePhotos()
  })
  map.on('zoomend', () => {
    saveMapPosition()
    updateVisiblePhotos()
  })

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    keepBuffer: 2,
  }).addTo(map)

  // Add photo markers
  addPhotoMarkers()

  // Force layout recalculation after CSS applies
  setTimeout(() => {
    if (map && mapContainer.value) {
      map.invalidateSize()
      console.log('[PhotoMap] Container size:',
        mapContainer.value.offsetWidth, 'x', mapContainer.value.offsetHeight)
    }
  }, 100)
}

function addPhotoMarkers() {
  if (!map) return

  // Cluster photos by geographic proximity
  const clusters = clusterPhotos(props.photos)

  if (clusters.length === 0) return

  // Pre-fetch thumbnails for representative photos (the ones shown in tooltips)
  console.log('[PhotoMap] Pre-fetching thumbnails for', clusters.length, 'cluster representatives')
  for (const cluster of clusters) {
    props.getThumbnailUrl(cluster.representativePhoto)
  }

  const bounds = L.latLngBounds([])

  for (const cluster of clusters) {
    const { photos, centerLat, centerLng, representativePhoto } = cluster
    const photoCount = photos.length

    // Use circle markers with size based on cluster size
    const radius = photoCount > 1 ? Math.min(10 + Math.log2(photoCount) * 3, 20) : 10
    const marker = L.circleMarker([centerLat, centerLng], {
      radius: radius,
      fillColor: photoCount > 1 ? '#e65100' : '#0070c0', // Orange for clusters, blue for single
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
      interactive: true,
      bubblingMouseEvents: false,
    })

    // Use representative photo (most recent) for tooltip
    const photo = representativePhoto
    const dateStr = photo.graphPhoto?.takenDateTime
      ? new Date(photo.graphPhoto.takenDateTime).toLocaleDateString()
      : ''

    // Escape special chars for HTML attributes
    const safeName = photo.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const countBadge = photoCount > 1 ? '<span class="tooltip-count">' + photoCount + ' photos</span>' : ''

    // Helper to build tooltip HTML with current thumbnail URL
    const buildTooltipHtml = () => {
      const currentUrl = props.getThumbnailUrl(photo)
      const safeSrc = currentUrl.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E')
      return '<div class="map-photo-tooltip">' +
        '<img src="' + safeSrc + '" alt="' + safeName + '">' +
        '<div class="tooltip-info">' +
        countBadge +
        '<span class="tooltip-name">' + safeName + '</span>' +
        (dateStr ? '<span class="tooltip-date">' + dateStr + '</span>' : '') +
        '</div></div>'
    }

    // Show tooltip based on quadrant - opposite corner from mouse
    const gap = 15
    marker.on('mouseover', (e: L.LeafletMouseEvent) => {
      // Remove any existing tooltip
      const existing = document.getElementById('map-center-tooltip')
      if (existing) existing.remove()

      // Get map container bounds
      const container = mapContainer.value
      if (!container) return
      const rect = container.getBoundingClientRect()

      // Get marker screen position
      const markerPoint = map!.latLngToContainerPoint(marker.getLatLng())
      const markerScreenX = rect.left + markerPoint.x
      const markerScreenY = rect.top + markerPoint.y

      // Determine which quadrant marker is in
      const inTopHalf = markerPoint.y < rect.height / 2
      const inLeftHalf = markerPoint.x < rect.width / 2

      // Create tooltip
      const tooltip = document.createElement('div')
      tooltip.id = 'map-center-tooltip'
      tooltip.innerHTML = buildTooltipHtml()
      tooltip.style.position = 'fixed'
      tooltip.style.zIndex = '9999'

      // Position in opposite quadrant from marker
      if (inTopHalf && inLeftHalf) {
        // Marker top-left → tooltip bottom-right of marker
        tooltip.style.left = (markerScreenX + radius + gap) + 'px'
        tooltip.style.top = (markerScreenY + radius + gap) + 'px'
      } else if (inTopHalf && !inLeftHalf) {
        // Marker top-right → tooltip bottom-left of marker
        tooltip.style.right = (window.innerWidth - markerScreenX + radius + gap) + 'px'
        tooltip.style.top = (markerScreenY + radius + gap) + 'px'
      } else if (!inTopHalf && inLeftHalf) {
        // Marker bottom-left → tooltip top-right of marker
        tooltip.style.left = (markerScreenX + radius + gap) + 'px'
        tooltip.style.bottom = (window.innerHeight - markerScreenY + radius + gap) + 'px'
      } else {
        // Marker bottom-right → tooltip top-left of marker
        tooltip.style.right = (window.innerWidth - markerScreenX + radius + gap) + 'px'
        tooltip.style.bottom = (window.innerHeight - markerScreenY + radius + gap) + 'px'
      }

      document.body.appendChild(tooltip)
    })

    marker.on('mouseout', () => {
      const tooltip = document.getElementById('map-center-tooltip')
      if (tooltip) tooltip.remove()
    })

    // Handle click - open in lightbox with group navigation
    marker.on('click', () => {
      console.log('[PhotoMap] Cluster clicked:', photoCount, 'photos')
      emit('photo-click', representativePhoto, photos)
    })

    marker.addTo(map)
    bounds.extend([centerLat, centerLng])
  }

  // Fit to show all markers ONLY if we don't have a stored position
  if (bounds.isValid() && !hadStoredPosition) {
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 12
    })
  }

  // Update visible photos count after markers are added
  updateVisiblePhotos()
}

// Watch for photo changes
watch(() => props.photos, () => {
  if (map) {
    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        map!.removeLayer(layer)
      }
    })
    addPhotoMarkers()
  }
}, { deep: true })

onMounted(() => {
  injectTileFixCSS()
  // Small delay for CSS to apply
  setTimeout(initMap, 50)

  // Set up resize observer to handle dynamic container resizing
  if (mapContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.invalidateSize()
      }
    })
    resizeObserver.observe(mapContainer.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
/* Outer wrapper - fills parent container via absolute positioning */
.photo-map-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: #e0e0e0;
}

/* Inner container - positioning context for the map */
.photo-map-container {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Map element - Leaflet adds classes here */
.map-element {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  z-index: 450;
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
  background: rgba(255, 255, 255, 0.95);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #333;
  z-index: 450;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
</style>
