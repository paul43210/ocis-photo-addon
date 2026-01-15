<template>
  <div v-if="photo" class="lightbox-overlay" @click.self="close" @keydown.escape="close">
    <div class="lightbox-container">
      <!-- Close button -->
      <button class="lightbox-close" @click="close" aria-label="Close">
        &times;
      </button>

      <!-- Photo counter -->
      <div v-if="groupPhotos.length > 1" class="lightbox-counter">
        {{ currentIndex + 1 }} / {{ groupPhotos.length }}
      </div>

      <!-- Main image with navigation inside - fixed size frame -->
      <div
        class="lightbox-image-container"
        :style="{ width: frameWidth + 'px', height: frameHeight + 'px' }"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <!-- Navigation: Previous (inside image container) -->
        <button
          v-if="canNavigatePrev"
          class="lightbox-nav lightbox-nav-prev"
          @click.stop="navigate('prev')"
          aria-label="Previous photo"
        >
          <span class="nav-arrow">&#8249;</span>
        </button>

        <!-- Show loading only if no thumbnail available -->
        <div v-if="imageLoading && !imageBlobUrl" class="lightbox-loading">Loading...</div>
        <template v-else>
          <img
            v-if="imageBlobUrl"
            :src="imageBlobUrl"
            :alt="photo.name || 'Photo'"
            class="lightbox-image"
          />
          <!-- Show loading indicator over thumbnail while full-size loads -->
          <div v-if="imageLoading && imageBlobUrl" class="lightbox-loading-overlay">
            <span class="loading-spinner"></span>
          </div>
        </template>

        <!-- Navigation: Next (inside image container) -->
        <button
          v-if="canNavigateNext"
          class="lightbox-nav lightbox-nav-next"
          @click.stop="navigate('next')"
          aria-label="Next photo"
        >
          <span class="nav-arrow">&#8250;</span>
        </button>
      </div>

      <!-- Bottom panel with download and metadata -->
      <div class="lightbox-panel">
        <div class="lightbox-header">
          <h3 class="lightbox-title">{{ photo.name || 'Untitled' }}</h3>
          <a
            :href="imageBlobUrl"
            class="lightbox-download"
            :download="photo.name"
            @click.stop
          >
            Download
          </a>
        </div>

        <!-- EXIF Metadata section -->
        <div class="lightbox-metadata">
          <div class="metadata-grid">
            <!-- EXIF: Date Taken -->
            <div v-if="exifData.takenDateTime" class="metadata-item">
              <span class="metadata-label">Date Taken</span>
              <span class="metadata-value">{{ formatExifDate(exifData.takenDateTime) }}</span>
            </div>

            <!-- EXIF: Camera -->
            <div v-if="exifData.cameraMake || exifData.cameraModel" class="metadata-item">
              <span class="metadata-label">Camera</span>
              <span class="metadata-value">{{ [exifData.cameraMake, exifData.cameraModel].filter(Boolean).join(' ') }}</span>
            </div>

            <!-- EXIF: Aperture -->
            <div v-if="exifData.fNumber" class="metadata-item">
              <span class="metadata-label">Aperture</span>
              <span class="metadata-value">f/{{ exifData.fNumber }}</span>
            </div>

            <!-- EXIF: Focal Length -->
            <div v-if="exifData.focalLength" class="metadata-item">
              <span class="metadata-label">Focal Length</span>
              <span class="metadata-value">{{ exifData.focalLength }}mm</span>
            </div>

            <!-- EXIF: ISO -->
            <div v-if="exifData.iso" class="metadata-item">
              <span class="metadata-label">ISO</span>
              <span class="metadata-value">{{ exifData.iso }}</span>
            </div>

            <!-- EXIF: Exposure -->
            <div v-if="exifData.exposureNumerator && exifData.exposureDenominator" class="metadata-item">
              <span class="metadata-label">Exposure</span>
              <span class="metadata-value">{{ exifData.exposureNumerator }}/{{ exifData.exposureDenominator }}s</span>
            </div>

            <!-- EXIF: Orientation -->
            <div v-if="exifData.orientation" class="metadata-item">
              <span class="metadata-label">Orientation</span>
              <span class="metadata-value">{{ getOrientationLabel(exifData.orientation) }}</span>
            </div>

            <!-- EXIF: Location (Lat/Long) -->
            <div v-if="exifData.location?.latitude != null && exifData.location?.longitude != null" class="metadata-item metadata-location">
              <span class="metadata-label">Location</span>
              <span class="metadata-value">
                {{ formatCoordinate(exifData.location.latitude, 'lat') }}, {{ formatCoordinate(exifData.location.longitude, 'lon') }}
                <a
                  :href="getMapUrl(exifData.location.latitude, exifData.location.longitude)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="map-link"
                  @click.stop
                >
                  View on Map
                </a>
              </span>
            </div>

            <!-- EXIF: Altitude -->
            <div v-if="exifData.location?.altitude != null" class="metadata-item">
              <span class="metadata-label">Altitude</span>
              <span class="metadata-value">{{ exifData.location.altitude.toFixed(1) }}m</span>
            </div>

            <!-- File info -->
            <div v-if="photo.size" class="metadata-item">
              <span class="metadata-label">File Size</span>
              <span class="metadata-value">{{ formatSize(photo.size) }}</span>
            </div>

            <div v-if="photo.mimeType" class="metadata-item">
              <span class="metadata-label">Type</span>
              <span class="metadata-value">{{ photo.mimeType }}</span>
            </div>

            <!-- Date source indicator -->
            <div v-if="photoWithDate?.dateSource" class="metadata-item">
              <span class="metadata-label">Date Source</span>
              <span class="metadata-value" :class="{ 'exif-source': photoWithDate.dateSource !== 'lastModifiedDateTime' }">
                {{ photoWithDate.dateSource }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useClientService, useConfigStore } from '@ownclouders/web-pkg'
import type { Resource } from '@ownclouders/web-client'

interface GeoCoordinates {
  latitude?: number
  longitude?: number
  altitude?: number
}

interface GraphPhoto {
  cameraMake?: string
  cameraModel?: string
  fNumber?: number
  focalLength?: number
  iso?: number
  orientation?: number
  takenDateTime?: string
  exposureNumerator?: number
  exposureDenominator?: number
  location?: GeoCoordinates
}

interface PhotoWithDate extends Resource {
  graphPhoto?: GraphPhoto
  dateSource?: string
}

const props = withDefaults(defineProps<{
  photo: Resource | null
  groupPhotos?: Resource[]
  currentIndex?: number
  thumbnailCache?: Map<string, string>  // Thumbnail blob URLs from parent
}>(), {
  groupPhotos: () => [],
  currentIndex: 0,
  thumbnailCache: () => new Map()
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', direction: 'prev' | 'next'): void
}>()

const clientService = useClientService()
const configStore = useConfigStore()

// Image loading state
const imageLoading = ref(true)
const imageKey = ref(0)

// Cache for loaded images
const imageCache = ref<Map<string, string>>(new Map())

// Fixed frame dimensions based on viewport (calculated once on mount)
const frameWidth = ref(Math.min(1200, Math.round(window.innerWidth * 0.85)))
const frameHeight = ref(Math.min(800, Math.round(window.innerHeight * 0.6)))

// Touch handling state
let touchStartX = 0
let touchStartY = 0
let touchMoved = false

// Cast to PhotoWithDate for accessing graphPhoto
const photoWithDate = computed(() => props.photo as PhotoWithDate | null)

// Get current image blob URL - prefer full-size from cache, fallback to thumbnail
const imageBlobUrl = computed(() => {
  if (!props.photo) return ''
  const photoId = props.photo.id || (props.photo as any).fileId || props.photo.name
  if (!photoId) return ''

  // First try full-size image cache
  const fullSize = imageCache.value.get(photoId)
  if (fullSize) return fullSize

  // Fallback to thumbnail from parent cache
  return props.thumbnailCache.get(photoId) || ''
})

// Extract EXIF data from graphPhoto
const exifData = computed<GraphPhoto>(() => {
  return photoWithDate.value?.graphPhoto || {}
})

// Navigation computed
const canNavigatePrev = computed(() => props.groupPhotos.length > 1 && props.currentIndex > 0)
const canNavigateNext = computed(() => props.groupPhotos.length > 1 && props.currentIndex < props.groupPhotos.length - 1)

// Load current image immediately, then preload others in background
watch(() => props.photo, async (newPhoto) => {
  if (newPhoto) {
    imageKey.value++
    await loadCurrentImage(newPhoto as PhotoWithDate)
  }
}, { immediate: true })

// Preload nearby images when navigating or group changes
watch([() => props.groupPhotos, () => props.currentIndex], ([photos, currentIdx]) => {
  if (photos.length > 1) {
    preloadNearbyImages(photos as PhotoWithDate[], currentIdx)
  }
}, { immediate: true })

function getPhotoUrl(photo: PhotoWithDate): string | null {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')

  const filePath = (photo as any).filePath || (photo as any).path || photo.name || ''
  if (!filePath) return null

  let spaceId = (photo as any).parentReference?.driveId || ''
  if (!spaceId && photo.id) {
    const idParts = photo.id.split('!')
    if (idParts.length > 0) {
      spaceId = idParts[0]
    }
  }
  if (!spaceId) return null

  const encodedPath = filePath.split('/').map((segment: string) => encodeURIComponent(segment)).join('/')
  return `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodedPath}`
}

// Load the current image immediately
async function loadCurrentImage(photo: PhotoWithDate) {
  // Check if already cached
  if (photo.id && imageCache.value.has(photo.id)) {
    imageLoading.value = false
    return
  }

  imageLoading.value = true
  const url = getPhotoUrl(photo)
  if (!url || !photo.id) {
    imageLoading.value = false
    return
  }

  try {
    const response = await clientService.httpAuthenticated.get(url, {
      responseType: 'blob'
    } as any)

    const blob = response.data as Blob
    const blobUrl = URL.createObjectURL(blob)
    imageCache.value.set(photo.id, blobUrl)
  } catch (err) {
    console.error(`[Lightbox] Failed to load image:`, err)
    if (photo.id) {
      imageCache.value.set(photo.id, 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="10">Error</text></svg>')
    }
  } finally {
    imageLoading.value = false
  }
}

// Preload next few images from current position (not all images)
async function preloadNearbyImages(photos: PhotoWithDate[], currentIdx: number) {
  const PRELOAD_AHEAD = 2  // Preload next 2 images
  const MAX_CONCURRENT = 2

  // Get next few photos that aren't cached yet
  const toPreload: PhotoWithDate[] = []
  for (let i = 1; i <= PRELOAD_AHEAD; i++) {
    const nextIdx = currentIdx + i
    if (nextIdx < photos.length) {
      const photo = photos[nextIdx]
      if (photo.id && !imageCache.value.has(photo.id)) {
        toPreload.push(photo)
      }
    }
  }

  if (toPreload.length === 0) return

  let activeLoads = 0
  const queue = [...toPreload]

  async function loadNext() {
    if (queue.length === 0 || activeLoads >= MAX_CONCURRENT) return

    const photo = queue.shift()!
    if (!photo.id || imageCache.value.has(photo.id)) {
      loadNext()
      return
    }

    activeLoads++
    const url = getPhotoUrl(photo)

    if (url) {
      try {
        const response = await clientService.httpAuthenticated.get(url, {
          responseType: 'blob'
        } as any)
        const blob = response.data as Blob
        const blobUrl = URL.createObjectURL(blob)
        imageCache.value.set(photo.id, blobUrl)
      } catch (err) {
        // Silently fail for background preloads
      }
    }

    activeLoads--
    loadNext()
  }

  // Start initial batch
  for (let i = 0; i < MAX_CONCURRENT; i++) {
    loadNext()
  }
}

function close() {
  // Clean up all cached blob URLs
  imageCache.value.forEach((blobUrl) => {
    if (blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl)
    }
  })
  imageCache.value.clear()
  emit('close')
}

function navigate(direction: 'prev' | 'next') {
  emit('navigate', direction)
}

// Handle escape key and arrow keys
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
  } else if (event.key === 'ArrowLeft' && canNavigatePrev.value) {
    navigate('prev')
  } else if (event.key === 'ArrowRight' && canNavigateNext.value) {
    navigate('next')
  }
}

// Touch handlers for swipe navigation
function handleTouchStart(event: TouchEvent) {
  touchStartX = event.touches[0].clientX
  touchStartY = event.touches[0].clientY
  touchMoved = false
}

function handleTouchMove(event: TouchEvent) {
  touchMoved = true
  // Prevent browser back/forward swipe navigation
  const deltaX = Math.abs(event.touches[0].clientX - touchStartX)
  const deltaY = Math.abs(event.touches[0].clientY - touchStartY)
  if (deltaX > deltaY) {
    event.preventDefault()
  }
}

function handleTouchEnd(event: TouchEvent) {
  if (!touchMoved) return

  const touchEndX = event.changedTouches[0].clientX
  const touchEndY = event.changedTouches[0].clientY
  const deltaX = touchEndX - touchStartX
  const deltaY = touchEndY - touchStartY

  // Only trigger swipe if horizontal movement is greater than vertical
  // and the swipe distance is significant (> 50px)
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
    if (deltaX > 0 && canNavigatePrev.value) {
      navigate('prev')
    } else if (deltaX < 0 && canNavigateNext.value) {
      navigate('next')
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
  // Clean up all cached blob URLs
  imageCache.value.forEach((blobUrl) => {
    if (blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl)
    }
  })
  imageCache.value.clear()
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatExifDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

function getOrientationLabel(orientation: number): string {
  const labels: Record<number, string> = {
    1: 'Normal',
    2: 'Flipped horizontally',
    3: 'Rotated 180',
    4: 'Flipped vertically',
    5: 'Rotated 90 CW + flipped',
    6: 'Rotated 90 CW',
    7: 'Rotated 90 CCW + flipped',
    8: 'Rotated 90 CCW'
  }
  return labels[orientation] || `${orientation}`
}

function formatCoordinate(value: number, type: 'lat' | 'lon'): string {
  const absolute = Math.abs(value)
  const degrees = Math.floor(absolute)
  const minutesDecimal = (absolute - degrees) * 60
  const minutes = Math.floor(minutesDecimal)
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(1)

  let direction: string
  if (type === 'lat') {
    direction = value >= 0 ? 'N' : 'S'
  } else {
    direction = value >= 0 ? 'E' : 'W'
  }

  return `${degrees}°${minutes}'${seconds}"${direction}`
}

function getMapUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
}
</script>

<style>
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  overscroll-behavior-x: none;
}

.lightbox-container {
  display: flex;
  flex-direction: column;
  background: var(--oc-color-background-default, #fff);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.lightbox-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 1.5rem;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.lightbox-close:hover {
  background: rgba(0, 0, 0, 0.7);
}

.lightbox-nav {
  position: absolute;
  top: 0;
  bottom: 0;
  margin: auto 0;
  width: 3rem;
  height: 3rem;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 1.5rem;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.2s;
}

.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(1.1);
}

.lightbox-nav-prev { left: 0.5rem; }
.lightbox-nav-next { right: 0.5rem; }

.nav-arrow {
  font-weight: bold;
  line-height: 1;
}

.lightbox-counter {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 0.3rem 0.75rem;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: 500;
  z-index: 10;
}

.lightbox-image-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: hidden;
  flex-shrink: 0;
}

.lightbox-loading {
  color: white;
  font-size: 1.2rem;
}

.lightbox-loading-overlay {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.5rem;
  border-radius: 4px;
  z-index: 5;
}

.loading-spinner {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.lightbox-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.lightbox-panel {
  background: var(--oc-color-background-default, #fff);
  padding: 1rem;
  border-top: 1px solid var(--oc-color-border, #e0e0e0);
  flex-shrink: 0;
}

.lightbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.lightbox-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--oc-color-text-default, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 1rem;
}

.lightbox-download {
  padding: 0.5rem 1rem;
  background: var(--oc-color-swatch-primary-default, #0070f3);
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.2s;
  white-space: nowrap;
}

.lightbox-download:hover {
  background: var(--oc-color-swatch-primary-hover, #0060d0);
}

.lightbox-metadata {
  background: var(--oc-color-background-muted, #f5f5f5);
  border-radius: 4px;
  padding: 0.75rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.metadata-label {
  font-size: 0.7rem;
  color: var(--oc-color-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metadata-value {
  font-size: 0.85rem;
  color: var(--oc-color-text-default, #333);
}

.metadata-value.exif-source {
  color: var(--oc-color-swatch-success-default, #2a7b2a);
  font-weight: 500;
}

.metadata-location {
  grid-column: span 2;
}

.map-link {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.15rem 0.4rem;
  background: var(--oc-color-swatch-primary-default, #0070f3);
  color: white;
  text-decoration: none;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 500;
  transition: background 0.2s;
}

.map-link:hover {
  background: var(--oc-color-swatch-primary-hover, #0060d0);
}

/* Fade transition for image changes */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
