<template>
  <div class="photos-app" ref="scrollContainer" @scroll="handleScroll">
    <div class="photos-header">
      <div class="header-top">
        <h1>Photos</h1>
        <div class="header-controls">
          <!-- Date filter -->
          <div class="date-filter">
            <span class="control-label">Jump to:</span>
            <select v-model="filterYear" @change="onDateFilterChange" class="date-select">
              <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
            </select>
            <select v-model="filterMonth" @change="onDateFilterChange" class="date-select">
              <option v-for="(name, index) in monthNames" :key="index" :value="index">{{ name }}</option>
            </select>
            <button v-if="!isCurrentMonth" @click="jumpToToday" class="today-btn" title="Jump to today">
              Today
            </button>
          </div>
          <!-- View mode selector -->
          <div class="view-selector">
            <span class="control-label">Show by:</span>
            <button
              v-for="mode in groupModes"
              :key="mode.value"
              :class="['view-btn', { active: groupMode === mode.value }]"
              @click="changeGroupMode(mode.value)"
            >
              {{ mode.label }}
            </button>
          </div>
          <!-- EXIF only toggle -->
          <label class="exif-toggle">
            <input type="checkbox" v-model="exifOnly" />
            <span class="toggle-label">EXIF only</span>
          </label>
        </div>
      </div>

      <!-- Breadcrumb Navigation (DISABLED)
      <div class="breadcrumb-nav">
        <button
          class="breadcrumb-item"
          :class="{ active: !selectedFolder }"
          @click="clearFolderFilter"
        >
          All Photos
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
      -->

      <p v-if="loading" class="loading-status">
        <span class="spinner"></span>
        Loading {{ currentDateRange }}... {{ photoCount }} photos
      </p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <p v-else class="photo-count">
        {{ photoCount }} photos
        <span v-if="!isFullyLoaded" class="load-more-hint"> - scroll for more</span>
        <span v-if="isFullyLoaded" class="complete-hint"> - all loaded</span>
      </p>
    </div>

    <div v-if="!error" class="photos-content">
      <div v-if="!loading && photoCount === 0" class="empty-state">
        <span class="empty-icon">📷</span>
        <p>No photos found</p>
        <p class="empty-hint">Photos will appear here after EXIF tags are synced</p>
      </div>

      <div v-else class="photo-groups">
        <div
          v-for="group in groupedPhotosWithStacks"
          :key="group.dateKey"
          class="date-group"
        >
          <h2 class="date-header">{{ formatDateHeader(group.dateKey) }} ({{ group.subGroups.reduce((sum, sg) => sum + sg.photos.length, 0) }})</h2>
          <div class="photo-grid">
            <template v-for="subGroup in group.subGroups" :key="subGroup.id">
              <!-- Single photo: regular item -->
              <div
                v-if="subGroup.photos.length === 1"
                class="photo-item"
                @click="openPhoto(subGroup.photos[0])"
              >
                <img
                  :src="getPhotoUrl(subGroup.photos[0])"
                  :alt="subGroup.photos[0].name"
                  loading="lazy"
                  @error="handleImageError"
                />
                <!-- Folder filter button (DISABLED)
                <button
                  class="folder-filter-btn"
                  @click.stop="selectFolder(subGroup.photos[0].filePath || '')"
                  title="Show photos from this folder"
                >
                  📁
                </button>
                -->
                <div class="photo-overlay">
                  <span class="photo-name">{{ subGroup.photos[0].name }}</span>
                </div>
              </div>
              <!-- Multiple photos: stack -->
              <PhotoStack
                v-else
                :photos="subGroup.photos"
                :get-photo-url="getPhotoUrl"
                @click="openStack(subGroup)"
              />
            </template>
          </div>
        </div>

        <div v-if="loadingMore" class="loading-more">
          Loading more photos...
        </div>
      </div>
    </div>

    <!-- Photo Lightbox with navigation -->
    <PhotoLightbox
      :photo="selectedPhoto"
      :group-photos="currentGroupPhotos"
      :current-index="currentPhotoIndex"
      :thumbnail-cache="blobUrlCache"
      @close="closeLightbox"
      @navigate="navigatePhoto"
      @action="handleLightboxAction"
    />

    <!-- Context Menu -->
    <PhotoContextMenu
      :visible="contextMenuVisible"
      :photo="contextMenuPhoto"
      :position="contextMenuPosition"
      @close="closeContextMenu"
      @action="handleContextAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useClientService, useSpacesStore, useConfigStore } from '@ownclouders/web-pkg'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import PhotoLightbox from '../components/PhotoLightbox.vue'
import PhotoStack from '../components/PhotoStack.vue'
import PhotoContextMenu from '../components/PhotoContextMenu.vue'

// Types for Graph API response
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
}

interface GraphDriveItem {
  id: string
  name: string
  file?: { mimeType: string }
  folder?: { childCount: number }
  photo?: GraphPhoto
  location?: GeoCoordinates
  lastModifiedDateTime?: string
  size?: number
  parentReference?: { driveId: string; id: string; path: string }
  webDavUrl?: string
}

interface GraphResponse {
  value: GraphDriveItem[]
  '@odata.nextLink'?: string
}

// Types
interface PhotoWithDate extends Resource {
  exifDate?: string  // YYYY-MM-DD from EXIF or mtime
  exifTime?: string  // HH:MM:SS
  timestamp?: number // Unix timestamp for sorting/grouping
  dateSource?: string // Track where the date came from (for debugging)
  graphPhoto?: GraphPhoto & { location?: GeoCoordinates } // Original Graph API photo metadata + location
  filePath?: string  // Full file path (our custom property, since Resource.path may be read-only)
}

// A sub-group (stack) of photos taken close together
interface PhotoSubGroup {
  id: string
  photos: PhotoWithDate[]
  timestamp: number // Earliest timestamp in group
}

type GroupMode = 'day' | 'week' | 'month' | 'year'

const clientService = useClientService()
const spacesStore = useSpacesStore()
const configStore = useConfigStore()

// Group mode options
const groupModes = [
  { value: 'day' as GroupMode, label: 'Day' },
  { value: 'week' as GroupMode, label: 'Week' },
  { value: 'month' as GroupMode, label: 'Month' },
  { value: 'year' as GroupMode, label: 'Year' }
]

// LocalStorage keys for persistent settings
const STORAGE_KEY_GROUP_MODE = 'photo-addon:groupMode'
const STORAGE_KEY_EXIF_ONLY = 'photo-addon:exifOnly'

// Load initial values from localStorage
function getStoredGroupMode(): GroupMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GROUP_MODE)
    if (saved && ['day', 'week', 'month', 'year'].includes(saved)) {
      return saved as GroupMode
    }
  } catch (e) { /* ignore */ }
  return 'day'
}

function getStoredExifOnly(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_EXIF_ONLY) === 'true'
  } catch (e) { /* ignore */ }
  return false
}

const groupMode = ref<GroupMode>(getStoredGroupMode())

// EXIF-only filter toggle
const exifOnly = ref(getStoredExifOnly())

// Refs
const scrollContainer = ref<HTMLElement | null>(null)
const allPhotos = ref<PhotoWithDate[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const currentDateRange = ref('')
const isFullyLoaded = ref(false)
const selectedPhoto = ref<PhotoWithDate | null>(null)

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuPhoto = ref<PhotoWithDate | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })

// Folder filter for breadcrumb navigation (DISABLED)
// const selectedFolder = ref<string | null>(null) // null = all photos

// Breadcrumb parts computed from selected folder path (DISABLED)
// const breadcrumbParts = computed(() => {
//   if (!selectedFolder.value) return []
//   return selectedFolder.value.split('/').filter(Boolean)
// })

// Track loaded photo IDs to avoid duplicates
const loadedPhotoIds = ref<Set<string>>(new Set())

// How far back we've loaded
const oldestLoadedDate = ref<Date>(new Date())

// Date filter state
const now = new Date()
const filterYear = ref(now.getFullYear())
const filterMonth = ref(now.getMonth())  // 0-indexed

// Month names for dropdown
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// Available years (current year back to 2015)
const availableYears = computed(() => {
  const years: number[] = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= 2015; y--) {
    years.push(y)
  }
  return years
})

// Check if filter is set to current month
const isCurrentMonth = computed(() => {
  const now = new Date()
  return filterYear.value === now.getFullYear() && filterMonth.value === now.getMonth()
})

// Store personal space reference for thumbnail generation
let personalSpace: SpaceResource | null = null

// Constants
const SCROLL_THRESHOLD = 500 // pixels from bottom to trigger load more
const MIN_PHOTOS_ON_SCREEN = 20 // Minimum photos to show before stopping initial load
const DAYS_PER_BATCH = 7 // Load 7 days at a time when scrolling
const MAX_DAYS_BACK = 365 * 10 // Maximum 10 years back to prevent infinite loading

// Supported image extensions (actual photo formats only)
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif'])

/**
 * Check if a resource is an actual image file (not sidecar metadata)
 */
function isImageFile(resource: Resource): boolean {
  const name = (resource.name || '').toLowerCase()

  // Explicitly exclude metadata/sidecar files
  if (name.includes('.json') || name.includes('.xml') || name.includes('.txt')) {
    return false
  }

  // Check MIME type first (most reliable)
  if (resource.mimeType) {
    const mime = resource.mimeType.toLowerCase()
    if (!mime.startsWith('image/')) {
      return false
    }
    // Exclude SVG and icons (not photos)
    if (mime.includes('svg') || mime.includes('icon')) {
      return false
    }
    return true
  }

  // Fallback: check file extension
  const ext = name.split('.').pop() || ''
  return IMAGE_EXTENSIONS.has(ext)
}

// Filter photos based on EXIF toggle and folder selection
const displayedPhotos = computed(() => {
  let photos = allPhotos.value

  // Apply EXIF filter
  if (exifOnly.value) {
    photos = photos.filter(photo => photo.dateSource === 'photo.takenDateTime')
  }

  // Apply folder filter (DISABLED)
  // if (selectedFolder.value) {
  //   photos = photos.filter(photo => {
  //     const path = (photo as any).filePath || ''
  //     return path.startsWith(selectedFolder.value!)
  //   })
  // }

  return photos
})

const photoCount = computed(() => displayedPhotos.value.length)

// Group photos by date
const groupedPhotos = computed(() => {
  const mode = groupMode.value
  const groups = new Map<string, PhotoWithDate[]>()

  for (const photo of displayedPhotos.value) {
    const dateKey = getGroupKey(photo.exifDate || '', mode)
    if (!dateKey) continue

    const existing = groups.get(dateKey) || []
    existing.push(photo)
    groups.set(dateKey, existing)
  }

  // Sort groups by date key (newest first)
  const sortedEntries = Array.from(groups.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))

  return sortedEntries
})

// Get group key based on mode
function getGroupKey(dateStr: string, mode: GroupMode): string {
  if (!dateStr) return ''

  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-')
  if (!year || !month) return ''

  switch (mode) {
    case 'year':
      return year
    case 'month':
      return `${year}-${month}`
    case 'week':
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day || '1'))
      const weekNum = getISOWeek(date)
      return `${year}-W${String(weekNum).padStart(2, '0')}`
    case 'day':
    default:
      return dateStr
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Sub-grouping thresholds based on view mode (in milliseconds)
// Max threshold is 24 hours to keep stacks manageable
const SUB_GROUP_THRESHOLDS: Record<GroupMode, number> = {
  day: 60 * 1000,             // 60 seconds
  week: 60 * 60 * 1000,       // 1 hour
  month: 24 * 60 * 60 * 1000, // 24 hours (same day)
  year: 24 * 60 * 60 * 1000   // 24 hours (same day) - capped at max
}

/**
 * Extract timestamp from photo for sub-grouping
 * Uses the timestamp field if available (from native EXIF), otherwise computes from available data
 */
function getPhotoTimestamp(photo: PhotoWithDate): number {
  // Use pre-computed timestamp from EXIF extraction
  if (photo.timestamp) return photo.timestamp

  // Try to combine exifDate and exifTime
  if (photo.exifDate && photo.exifTime) {
    const ts = new Date(`${photo.exifDate}T${photo.exifTime}`).getTime()
    if (!isNaN(ts)) return ts
  }

  // Fallback: use file modification time
  const mtime = (photo as any).mdate || (photo as any).mtime
  if (mtime) {
    const ts = new Date(mtime).getTime()
    if (!isNaN(ts)) return ts
  }

  // Use date only with noon time as fallback
  if (photo.exifDate) {
    const ts = new Date(photo.exifDate + 'T12:00:00').getTime()
    if (!isNaN(ts)) return ts
  }

  return 0
}

/**
 * Create sub-groups (stacks) from photos based on time proximity
 */
function createSubGroups(photos: PhotoWithDate[], mode: GroupMode): PhotoSubGroup[] {
  if (photos.length === 0) return []

  const threshold = SUB_GROUP_THRESHOLDS[mode]

  // Sort by timestamp (newest first)
  const sorted = [...photos].map(p => ({
    ...p,
    timestamp: getPhotoTimestamp(p)
  })).sort((a, b) => b.timestamp - a.timestamp)

  const groups: PhotoSubGroup[] = []
  let currentGroup: PhotoWithDate[] = [sorted[0]]
  let currentGroupTime = sorted[0].timestamp

  for (let i = 1; i < sorted.length; i++) {
    const photo = sorted[i]
    const timeDiff = Math.abs(currentGroupTime - photo.timestamp)

    if (timeDiff <= threshold) {
      // Add to current group
      currentGroup.push(photo)
    } else {
      // Finish current group and start new one
      groups.push({
        id: `group-${currentGroupTime}-${currentGroup.length}`,
        photos: currentGroup,
        timestamp: currentGroupTime
      })
      currentGroup = [photo]
      currentGroupTime = photo.timestamp
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push({
      id: `group-${currentGroupTime}-${currentGroup.length}`,
      photos: currentGroup,
      timestamp: currentGroupTime
    })
  }

  return groups
}

// Computed: grouped photos with sub-groups (stacks)
const groupedPhotosWithStacks = computed(() => {
  const mode = groupMode.value
  const result: Array<{ dateKey: string, subGroups: PhotoSubGroup[] }> = []

  for (const [dateKey, photos] of groupedPhotos.value) {
    const subGroups = createSubGroups(photos, mode)
    result.push({ dateKey, subGroups })
  }

  return result
})

// Current group context for lightbox navigation
const currentGroupPhotos = ref<PhotoWithDate[]>([])
const currentPhotoIndex = ref(0)

// Format date header for display
function formatDateHeader(dateKey: string): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Handle different formats based on mode
  if (dateKey.includes('-W')) {
    // Week format: 2026-W02
    const [year, week] = dateKey.split('-W')
    const weekNum = parseInt(week)
    const jan1 = new Date(parseInt(year), 0, 1)
    const startDate = new Date(jan1)
    startDate.setDate(jan1.getDate() + (weekNum - 1) * 7 - jan1.getDay() + 1)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
    return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const parts = dateKey.split('-')
  if (parts.length === 1) {
    // Year only
    return parts[0]
  }
  if (parts.length === 2) {
    // Month: 2026-01
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  }

  // Full date: 2026-01-11
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// Change group mode and potentially reload
function changeGroupMode(newMode: GroupMode) {
  groupMode.value = newMode
}

// Handle date filter change - reload photos starting from selected month
function onDateFilterChange() {
  loadPhotosFromFilter()
}

// Jump to today's date
function jumpToToday() {
  const now = new Date()
  filterYear.value = now.getFullYear()
  filterMonth.value = now.getMonth()
  loadPhotosFromFilter()
}

// Load photos for the selected month - resets view and loads from selected date
async function loadPhotosFromFilter() {
  // Simply delegate to loadPhotos which respects the filter values
  await loadPhotos()
}

// Scroll handler
function handleScroll() {
  if (!scrollContainer.value || loadingMore.value || isFullyLoaded.value) return

  const { scrollHeight, clientHeight, scrollTop } = scrollContainer.value
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight

  if (distanceFromBottom < SCROLL_THRESHOLD) {
    loadMorePhotos()
  }
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Extract EXIF creation date from resource
 * Priority:
 *   1. resource.photo.takenDateTime (official oCIS SDK field from Tika EXIF extraction)
 *   2. Legacy EXIF property names
 *   3. File modification date (mdate) as last resort
 * Returns: { date: 'YYYY-MM-DD', time: 'HH:MM:SS', timestamp: number, source: string } or null
 */
function extractExifDateTime(resource: Resource): { date: string, time: string, timestamp: number, source: string } | null {
  const r = resource as any

  // PRIMARY: Check for photo-taken-date-time WebDAV property (from our patched oCIS)
  const photoTakenDateTime = r['photo-taken-date-time'] || r['oc:photo-taken-date-time'] ||
    r.photoTakenDateTime || r.extraProps?.['oc:photo-taken-date-time']
  if (photoTakenDateTime) {
    const parsed = parseExifDate(photoTakenDateTime)
    if (parsed) {
      return { ...parsed, source: 'photo-taken-date-time' }
    }
  }

  // SECONDARY: Check official oCIS SDK photo.takenDateTime field
  if (r.photo?.takenDateTime) {
    const parsed = parseExifDate(r.photo.takenDateTime)
    if (parsed) {
      return { ...parsed, source: 'photo.takenDateTime' }
    }
  }

  // TERTIARY: Try legacy EXIF fields (from older Tika configurations)
  const legacyFields = [
    { name: 'exif.creationdate', value: r['exif.creationdate'] },
    { name: 'exif.datetimeoriginal', value: r['exif.datetimeoriginal'] },
    { name: 'exifCreationDate', value: r.exifCreationDate },
    { name: 'exifDateTimeOriginal', value: r.exifDateTimeOriginal },
    { name: 'creationDate', value: r.creationDate },
    { name: 'dateTimeOriginal', value: r.dateTimeOriginal }
  ]

  for (const field of legacyFields) {
    if (field.value) {
      const parsed = parseExifDate(field.value)
      if (parsed) {
        return { ...parsed, source: field.name }
      }
    }
  }

  // FALLBACK: Use file modification date
  const mdate = r.mdate || r.mtime
  if (mdate) {
    const d = new Date(mdate)
    if (!isNaN(d.getTime())) {
      return {
        date: formatDate(d),
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`,
        timestamp: d.getTime(),
        source: 'mdate'
      }
    }
  }

  return null
}

/**
 * Parse EXIF date string in various formats
 * Supports: YYYY-MM-DD, YYYY:MM:DD HH:MM:SS, ISO 8601
 */
function parseExifDate(dateStr: string): { date: string, time: string, timestamp: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null

  try {
    // EXIF format: "YYYY:MM:DD HH:MM:SS"
    const exifMatch = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
    if (exifMatch) {
      const [, year, month, day, hour, min, sec] = exifMatch
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec))
      return {
        date: `${year}-${month}-${day}`,
        time: `${hour}:${min}:${sec}`,
        timestamp: d.getTime()
      }
    }

    // ISO 8601 or standard date format
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return {
        date: formatDate(d),
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`,
        timestamp: d.getTime()
      }
    }
  } catch {
    // Ignore parse errors
  }

  return null
}

/**
 * Parse WebDAV PROPFIND XML response into PhotoWithDate array
 */
function parseSearchResponse(xmlText: string, spaceId: string): PhotoWithDate[] {
  const photos: PhotoWithDate[] = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    console.error('[Search] XML parse error:', parseError.textContent)
    return photos
  }

  // Find all response elements (handle namespaced and non-namespaced)
  const responses = doc.getElementsByTagNameNS('DAV:', 'response')

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i]
    try {
      // Get the href (file path)
      const hrefEl = response.getElementsByTagNameNS('DAV:', 'href')[0]
      if (!hrefEl?.textContent) continue

      const href = decodeURIComponent(hrefEl.textContent)

      // Extract filename from path
      const pathParts = href.split('/')
      const fileName = pathParts[pathParts.length - 1]
      if (!fileName) continue

      // Get properties from propstat
      const propstat = response.getElementsByTagNameNS('DAV:', 'propstat')[0]
      if (!propstat) continue

      const prop = propstat.getElementsByTagNameNS('DAV:', 'prop')[0]
      if (!prop) continue

      // Get content type
      const contentTypeEl = prop.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]
      const mimeType = contentTypeEl?.textContent || ''

      // Only process images
      if (!mimeType.startsWith('image/')) continue
      if (mimeType.includes('svg') || mimeType.includes('icon')) continue

      // Get file ID from oc:fileid
      const fileIdEl = prop.getElementsByTagNameNS('http://owncloud.org/ns', 'fileid')[0]
      const fileId = fileIdEl?.textContent || ''

      // Get size
      const sizeEl = prop.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]
      const size = sizeEl?.textContent ? parseInt(sizeEl.textContent, 10) : 0

      // Get last modified
      const lastModEl = prop.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]
      const lastModified = lastModEl?.textContent || ''

      // Get photo metadata properties (ownCloud namespace)
      const ocNs = 'http://owncloud.org/ns'
      const takenDateTimeEl = prop.getElementsByTagNameNS(ocNs, 'photo-taken-date-time')[0]
      const cameraMakeEl = prop.getElementsByTagNameNS(ocNs, 'photo-camera-make')[0]
      const cameraModelEl = prop.getElementsByTagNameNS(ocNs, 'photo-camera-model')[0]
      const fNumberEl = prop.getElementsByTagNameNS(ocNs, 'photo-f-number')[0]
      const focalLengthEl = prop.getElementsByTagNameNS(ocNs, 'photo-focal-length')[0]
      const isoEl = prop.getElementsByTagNameNS(ocNs, 'photo-iso')[0]
      const orientationEl = prop.getElementsByTagNameNS(ocNs, 'photo-orientation')[0]
      const exposureNumEl = prop.getElementsByTagNameNS(ocNs, 'photo-exposure-numerator')[0]
      const exposureDenEl = prop.getElementsByTagNameNS(ocNs, 'photo-exposure-denominator')[0]
      const latitudeEl = prop.getElementsByTagNameNS(ocNs, 'photo-location-latitude')[0]
      const longitudeEl = prop.getElementsByTagNameNS(ocNs, 'photo-location-longitude')[0]
      const altitudeEl = prop.getElementsByTagNameNS(ocNs, 'photo-location-altitude')[0]

      // Build GraphPhoto object
      const graphPhoto: GraphPhoto & { location?: GeoCoordinates } = {}

      if (cameraMakeEl?.textContent) graphPhoto.cameraMake = cameraMakeEl.textContent
      if (cameraModelEl?.textContent) graphPhoto.cameraModel = cameraModelEl.textContent
      if (fNumberEl?.textContent) graphPhoto.fNumber = parseFloat(fNumberEl.textContent)
      if (focalLengthEl?.textContent) graphPhoto.focalLength = parseFloat(focalLengthEl.textContent)
      if (isoEl?.textContent) graphPhoto.iso = parseInt(isoEl.textContent, 10)
      if (orientationEl?.textContent) graphPhoto.orientation = parseInt(orientationEl.textContent, 10)
      if (exposureNumEl?.textContent) graphPhoto.exposureNumerator = parseInt(exposureNumEl.textContent, 10)
      if (exposureDenEl?.textContent) graphPhoto.exposureDenominator = parseInt(exposureDenEl.textContent, 10)
      if (takenDateTimeEl?.textContent) graphPhoto.takenDateTime = takenDateTimeEl.textContent

      // Add location if available
      if (latitudeEl?.textContent || longitudeEl?.textContent) {
        graphPhoto.location = {}
        if (latitudeEl?.textContent) graphPhoto.location.latitude = parseFloat(latitudeEl.textContent)
        if (longitudeEl?.textContent) graphPhoto.location.longitude = parseFloat(longitudeEl.textContent)
        if (altitudeEl?.textContent) graphPhoto.location.altitude = parseFloat(altitudeEl.textContent)
      }

      // Extract date - prefer EXIF, fallback to last modified
      let exifDate: string
      let exifTime: string
      let timestamp: number
      let dateSource: string

      if (takenDateTimeEl?.textContent) {
        const d = new Date(takenDateTimeEl.textContent)
        exifDate = formatDate(d)
        exifTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
        timestamp = d.getTime()
        dateSource = 'photo.takenDateTime'
      } else if (lastModified) {
        const d = new Date(lastModified)
        exifDate = formatDate(d)
        exifTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
        timestamp = d.getTime()
        dateSource = 'lastModifiedDateTime'
      } else {
        continue // Skip if no date available
      }

      // Extract file path from href
      // href format: /dav/spaces/{spaceId}/path/to/file.jpg
      const spacePrefix = `/dav/spaces/${spaceId}`
      let filePath = href
      if (href.startsWith(spacePrefix)) {
        filePath = href.substring(spacePrefix.length)
      }
      // Also handle URL-encoded space prefix
      const encodedSpacePrefix = `/dav/spaces/${encodeURIComponent(spaceId)}`
      if (href.startsWith(encodedSpacePrefix)) {
        filePath = href.substring(encodedSpacePrefix.length)
      }

      // Create PhotoWithDate object
      const photoResource: PhotoWithDate = {
        id: fileId || `${spaceId}!${fileName}`,
        fileId: fileId,
        name: fileName,
        filePath: filePath,
        webDavPath: href,
        mimeType: mimeType,
        size: size,
        exifDate,
        exifTime,
        timestamp,
        dateSource,
        graphPhoto
      } as PhotoWithDate

      photos.push(photoResource)
    } catch (err) {
      console.error('[Search] Error parsing response element:', err)
    }
  }

  return photos
}

/**
 * Format date as YYYY-MM-DD for KQL queries
 */
function formatDateForKQL(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Calculate date range for search (default: 3 months back from given end date)
 */
function getSearchDateRange(endDate: Date, monthsBack: number = 3): { start: string, end: string } {
  const startDate = new Date(endDate)
  startDate.setMonth(startDate.getMonth() - monthsBack)

  return {
    start: formatDateForKQL(startDate),
    end: formatDateForKQL(endDate)
  }
}

/**
 * Fetch photos using WebDAV REPORT with KQL date filter
 * Uses server-side filtering to dramatically reduce response size
 * @param exifOnly - When true, filter by photo.takenDateTime (EXIF date). When false, filter by mtime (file modification date)
 */
async function fetchPhotosViaSearch(driveId: string, dateRange: { start: string, end: string }, useExifDate: boolean = true): Promise<PhotoWithDate[]> {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const spaceId = driveId

  // KQL pattern with date filter AND image type filter
  // Uses correct field names: mediatype (not mimeType)
  // Note: > and < must be XML-escaped in the pattern
  // When useExifDate is true: filter by photo.takenDateTime (EXIF capture date)
  // When useExifDate is false: filter by mtime (file modification date)
  const dateField = useExifDate ? 'photo.takenDateTime' : 'mtime'
  const pattern = `mediatype:image* AND ${dateField}&gt;=${dateRange.start} AND ${dateField}&lt;=${dateRange.end}`

  const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${pattern}</oc:pattern>
    <oc:limit>5000</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
    <oc:photo-taken-date-time/>
    <oc:photo-camera-make/>
    <oc:photo-camera-model/>
    <oc:photo-f-number/>
    <oc:photo-focal-length/>
    <oc:photo-iso/>
    <oc:photo-orientation/>
    <oc:photo-exposure-numerator/>
    <oc:photo-exposure-denominator/>
    <oc:photo-location-latitude/>
    <oc:photo-location-longitude/>
    <oc:photo-location-altitude/>
  </d:prop>
</oc:search-files>`

  console.log('[Search] Date-filtered request:', { spaceId, pattern, url: `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}` })

  try {
    const response = await clientService.httpAuthenticated.request({
      method: 'REPORT',
      url: `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}`,
      headers: {
        'Content-Type': 'application/xml'
      },
      data: searchBody
    })

    console.log('[Search] Date-filtered response status:', response.status)
    const xmlText = typeof response.data === 'string' ? response.data : new XMLSerializer().serializeToString(response.data)
    console.log('[Search] Date-filtered response length:', xmlText.length, 'first 500 chars:', xmlText.substring(0, 500))
    const photos = parseSearchResponse(xmlText, spaceId)
    console.log('[Search] Date-filtered parsed photos:', photos.length)
    return photos
  } catch (err: any) {
    console.error('[Search] REPORT search-files failed:', err)
    console.error('[Search] Error response:', err.response?.data, err.response?.status)
    throw new Error('Failed to search photos. Please try again.')
  }
}

/**
 * Fallback: Fetch photos without date filter (for photos without EXIF dates)
 * Only called if date-filtered search returns nothing
 */
async function fetchAllImagesViaSearch(driveId: string): Promise<PhotoWithDate[]> {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const spaceId = driveId

  // Just filter by image type, no date filter (use correct field name: mediatype)
  const pattern = `mediatype:image*`

  const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${pattern}</oc:pattern>
    <oc:limit>10000</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
    <oc:photo-taken-date-time/>
    <oc:photo-camera-make/>
    <oc:photo-camera-model/>
    <oc:photo-f-number/>
    <oc:photo-focal-length/>
    <oc:photo-iso/>
    <oc:photo-orientation/>
    <oc:photo-exposure-numerator/>
    <oc:photo-exposure-denominator/>
    <oc:photo-location-latitude/>
    <oc:photo-location-longitude/>
    <oc:photo-location-altitude/>
  </d:prop>
</oc:search-files>`

  console.log('[Search] Fallback request:', { spaceId, pattern })

  try {
    const response = await clientService.httpAuthenticated.request({
      method: 'REPORT',
      url: `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}`,
      headers: {
        'Content-Type': 'application/xml'
      },
      data: searchBody
    })

    console.log('[Search] Fallback response status:', response.status)
    const xmlText = typeof response.data === 'string' ? response.data : new XMLSerializer().serializeToString(response.data)
    console.log('[Search] Fallback response length:', xmlText.length, 'first 500 chars:', xmlText.substring(0, 500))
    const photos = parseSearchResponse(xmlText, spaceId)
    console.log('[Search] Fallback parsed photos:', photos.length)
    return photos
  } catch (err: any) {
    console.error('[Search] Fallback search failed:', err)
    console.error('[Search] Fallback error response:', err.response?.data, err.response?.status)
    throw new Error('Failed to search photos. Please try again.')
  }
}

// Track loaded date ranges to avoid duplicate fetches
const loadedRanges = ref<Array<{ start: string, end: string }>>([])

// Flag to indicate if we've fallen back to non-date-filtered search
let useFallbackSearch = false

/**
 * Get the oldest date we've loaded so far
 */
function getOldestLoadedDate(): string | null {
  if (allPhotos.value.length === 0) return null
  // Photos are sorted newest first, so last item is oldest
  const oldest = allPhotos.value[allPhotos.value.length - 1]
  return oldest.exifDate || null
}

/**
 * Check if screen needs more photos (not enough to fill visible area + buffer)
 */
function needsMorePhotos(): boolean {
  if (!scrollContainer.value) return allPhotos.value.length < MIN_PHOTOS_ON_SCREEN

  const { scrollHeight, clientHeight } = scrollContainer.value
  // Need more if content doesn't fill screen + scroll threshold
  return scrollHeight < clientHeight + SCROLL_THRESHOLD && !isFullyLoaded.value
}

// Months per search request - varies by group mode for optimal loading
function getMonthsPerBatch(): number {
  switch (groupMode.value) {
    case 'day': return 1      // Day view: 1 month at a time
    case 'week': return 2     // Week view: 2 months at a time
    case 'month': return 3    // Month view: 3 months at a time
    case 'year': return 6     // Year view: 6 months at a time
    default: return 3
  }
}

// Initial load - start from today (or selected filter date) and progressively load
async function loadPhotos() {
  loading.value = true
  error.value = null
  allPhotos.value = []
  loadedPhotoIds.value.clear()
  loadedRanges.value = []
  isFullyLoaded.value = false
  useFallbackSearch = false

  try {
    // Find personal space
    if (!personalSpace) {
      const spaces = spacesStore.spaces
      personalSpace = spaces.find((s: SpaceResource) => s.driveType === 'personal') || null
    }

    if (!personalSpace) {
      throw new Error('Could not find personal space')
    }

    // Determine starting date based on filter
    let endDate: Date
    if (filterYear.value === new Date().getFullYear() && filterMonth.value === new Date().getMonth()) {
      endDate = new Date()
    } else {
      endDate = new Date(filterYear.value, filterMonth.value + 1, 0)
      const now = new Date()
      if (endDate > now) endDate = now
    }

    // Store the end date for progressive loading
    oldestLoadedDate.value = new Date(endDate)
    oldestLoadedDate.value.setDate(oldestLoadedDate.value.getDate() + 1)

    currentDateRange.value = 'Loading recent photos...'

    // Load initial batch (3 months)
    await loadMorePhotos()

    // If no photos found with date filter, try fallback search
    if (allPhotos.value.length === 0 && !useFallbackSearch) {
      currentDateRange.value = 'Searching all photos...'
      useFallbackSearch = true
      const photos = await fetchAllImagesViaSearch(personalSpace.id)

      // Filter out already loaded and sort
      const newPhotos = photos.filter(p => {
        const key = p.fileId || p.id || p.name
        if (loadedPhotoIds.value.has(key)) return false
        loadedPhotoIds.value.add(key)
        return true
      })

      newPhotos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      allPhotos.value = newPhotos
      isFullyLoaded.value = true
    }

    // Keep loading more months until screen is filled
    let loopGuard = 0
    while (needsMorePhotos() && !isFullyLoaded.value && !useFallbackSearch && loopGuard < 10) {
      loopGuard++
      await loadMorePhotos()
    }

  } catch (err: any) {
    console.error('Error loading photos:', err)
    error.value = err.message || 'Failed to load photos'
  } finally {
    loading.value = false
  }
}

// Load more photos (older dates) - called on scroll or initial fill
async function loadMorePhotos() {
  if (loadingMore.value || isFullyLoaded.value || useFallbackSearch) return
  if (!personalSpace) return

  loadingMore.value = true

  try {
    // Calculate date range based on group mode
    const endDate = new Date(oldestLoadedDate.value)
    endDate.setDate(endDate.getDate() - 1)

    const dateRange = getSearchDateRange(endDate, getMonthsPerBatch())

    currentDateRange.value = `${dateRange.start} to ${dateRange.end}`

    // Check if we've gone too far back (10 years)
    const startDate = new Date(dateRange.start)
    const today = new Date()
    const yearsDiff = (today.getTime() - startDate.getTime()) / (365 * 24 * 60 * 60 * 1000)
    if (yearsDiff > 10) {
      isFullyLoaded.value = true
      return
    }

    // Fetch photos from server with date filter
    // Pass exifOnly.value to determine which date field to filter by
    const photos = await fetchPhotosViaSearch(personalSpace.id, dateRange, exifOnly.value)

    // Track this range as loaded
    loadedRanges.value.push(dateRange)

    // Update oldest loaded date for next batch
    oldestLoadedDate.value = startDate

    // Filter duplicates and add new photos
    const newPhotos = photos.filter(p => {
      const key = p.fileId || p.id || p.name
      if (loadedPhotoIds.value.has(key)) return false
      loadedPhotoIds.value.add(key)
      return true
    })

    if (newPhotos.length > 0) {
      // Sort new photos by date (newest first)
      newPhotos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      // Append to existing (older photos go at end)
      allPhotos.value = [...allPhotos.value, ...newPhotos]
    }

    // If we got very few photos, we might be near the end
    // But don't mark fully loaded yet - let user keep scrolling
    if (photos.length === 0 && loadedRanges.value.length > 5) {
      // After 5 empty batches (15 months), assume we're done
      const emptyBatches = loadedRanges.value.slice(-5).filter((_, i, arr) => {
        // Check if consecutive empty
        return true
      })
      if (emptyBatches.length >= 5) {
        isFullyLoaded.value = true
      }
    }

  } finally {
    loadingMore.value = false
  }
}

// Cache for blob URLs to avoid refetching
const blobUrlCache = new Map<string, string>()

// Request queue to limit concurrent fetches
const MAX_CONCURRENT_FETCHES = 4
let activeFetches = 0
const fetchQueue: Array<{ photo: PhotoWithDate, cacheKey: string }> = []
const pendingFetches = new Set<string>()

function getPhotoUrl(photo: Resource): string {
  const p = photo as PhotoWithDate

  // Check if we already have a blob URL cached
  const cacheKey = p.id || p.fileId || p.name
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)!
  }

  // Queue the fetch if not already pending
  if (!pendingFetches.has(cacheKey)) {
    pendingFetches.add(cacheKey)
    fetchQueue.push({ photo: p, cacheKey })
    processQueue()
  }

  // Return a placeholder while loading
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="10">Loading...</text></svg>'
}

// Process the fetch queue
function processQueue() {
  while (activeFetches < MAX_CONCURRENT_FETCHES && fetchQueue.length > 0) {
    const item = fetchQueue.shift()
    if (item) {
      activeFetches++
      doFetch(item.photo, item.cacheKey).finally(() => {
        activeFetches--
        pendingFetches.delete(item.cacheKey)
        processQueue()
      })
    }
  }
}

// Fetch image with authentication and cache as blob URL
async function doFetch(photo: PhotoWithDate, cacheKey: string) {
  if (blobUrlCache.has(cacheKey)) return

  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  if (!personalSpace) return

  const spaceId = personalSpace.id
  const photoPath = photo.filePath || photo.name || ''
  if (!photoPath) return

  const encodedPath = photoPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
  const url = `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodedPath}?preview=1&x=256&y=256&a=1`

  try {
    const response = await clientService.httpAuthenticated.get(url, {
      responseType: 'blob'
    } as any)

    const blob = response.data as Blob
    const blobUrl = URL.createObjectURL(blob)
    blobUrlCache.set(cacheKey, blobUrl)

    // Trigger reactivity update
    const index = allPhotos.value.findIndex(p => (p.id || p.fileId || p.name) === cacheKey)
    if (index >= 0) {
      allPhotos.value = [...allPhotos.value]
    }
  } catch (err) {
    // Silently cache error placeholder
    blobUrlCache.set(cacheKey, 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="10">Error</text></svg>')
  }
}

function openPhoto(photo: PhotoWithDate, groupPhotos?: PhotoWithDate[]) {
  selectedPhoto.value = photo

  // Set up group navigation context
  if (groupPhotos && groupPhotos.length > 1) {
    currentGroupPhotos.value = groupPhotos
    currentPhotoIndex.value = groupPhotos.findIndex(p =>
      (p.fileId || p.id || p.path) === (photo.fileId || photo.id || photo.path)
    )
    if (currentPhotoIndex.value < 0) currentPhotoIndex.value = 0
  } else {
    currentGroupPhotos.value = [photo]
    currentPhotoIndex.value = 0
  }
}

function openStack(subGroup: PhotoSubGroup) {
  // Open the first photo in the stack with group context
  if (subGroup.photos.length > 0) {
    openPhoto(subGroup.photos[0], subGroup.photos)
  }
}

function navigatePhoto(direction: 'prev' | 'next') {
  if (currentGroupPhotos.value.length <= 1) return

  if (direction === 'prev' && currentPhotoIndex.value > 0) {
    currentPhotoIndex.value--
    selectedPhoto.value = currentGroupPhotos.value[currentPhotoIndex.value]
  } else if (direction === 'next' && currentPhotoIndex.value < currentGroupPhotos.value.length - 1) {
    currentPhotoIndex.value++
    selectedPhoto.value = currentGroupPhotos.value[currentPhotoIndex.value]
  }
}

function closeLightbox() {
  selectedPhoto.value = null
  currentGroupPhotos.value = []
  currentPhotoIndex.value = 0
}

// Breadcrumb navigation functions (DISABLED)
// function navigateToBreadcrumb(index: number) {
//   const parts = breadcrumbParts.value.slice(0, index + 1)
//   selectedFolder.value = '/' + parts.join('/') + '/'
// }

// function selectFolder(filePath: string) {
//   // Extract folder from file path (remove filename)
//   const lastSlash = filePath.lastIndexOf('/')
//   selectedFolder.value = lastSlash > 0 ? filePath.substring(0, lastSlash + 1) : '/'
// }

// function clearFolderFilter() {
//   selectedFolder.value = null
// }

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="12">No preview</text></svg>'
}

// Context menu functions
function openContextMenu(event: MouseEvent, photo: PhotoWithDate) {
  console.log('[PhotosView] openContextMenu called', event.clientX, event.clientY, photo)
  event.preventDefault()
  event.stopPropagation()
  contextMenuPhoto.value = photo
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
  console.log('[PhotosView] contextMenuVisible set to', contextMenuVisible.value)
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuPhoto.value = null
}

function handleLightboxAction(action: string, photo: Resource) {
  console.log('[PhotosView] handleLightboxAction called', action, photo)
  handleContextAction(action, photo as PhotoWithDate)
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
  const cacheKey = photo.id || (photo as any).fileId || photo.name
  let url = blobUrlCache.get(cacheKey)

  if (!url || url.startsWith('data:')) {
    // Fetch full image if not cached or is placeholder
    const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
    const spaceId = personalSpace?.id || ''
    const photoPath = (photo as any).filePath || photo.name || ''
    const encodedPath = photoPath.split('/').map((s: string) => encodeURIComponent(s)).join('/')
    const fetchUrl = `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodedPath}`

    try {
      const response = await clientService.httpAuthenticated.get(fetchUrl, {
        responseType: 'blob'
      } as any)
      const blob = response.data as Blob
      url = URL.createObjectURL(blob)
    } catch (err) {
      console.error('Failed to download photo:', err)
      alert('Failed to download photo. Please try again.')
      return
    }
  }

  const link = document.createElement('a')
  link.href = url
  link.download = photo.name || 'photo'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function openInFiles(photo: PhotoWithDate) {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const fileId = (photo as any).fileId || photo.id || ''
  const filePath = (photo as any).filePath || photo.name || ''

  // Get the drive alias (e.g., "personal/paul")
  const driveAlias = (personalSpace as any)?.driveAlias || 'personal/home'

  // Build the full path for preview URL: driveAlias + filePath
  const fullPath = `${driveAlias}${filePath}`
  const encodedFullPath = fullPath.split('/').map((s: string) => encodeURIComponent(s)).join('/')

  // Get folder path (without filename) for contextRouteParams
  const lastSlash = filePath.lastIndexOf('/')
  const folderPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : ''
  const driveAliasAndItem = `${driveAlias}${folderPath}`

  // Get parent folder's fileId from parentReference if available
  const parentId = (photo as any).parentReference?.id || ''

  // Build the preview URL with context parameters
  const params = new URLSearchParams()
  params.set('fileId', fileId)
  params.set('contextRouteName', 'files-spaces-generic')
  params.set('contextRouteParams.driveAliasAndItem', driveAliasAndItem)
  if (parentId) {
    params.set('contextRouteQuery.fileId', parentId)
  }

  const previewUrl = `${serverUrl}/preview/${encodedFullPath}?${params.toString()}`
  window.open(previewUrl, '_blank')
}

async function copyPhotoLink(photo: PhotoWithDate) {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const fileId = (photo as any).fileId || photo.id || ''

  // Use the short /f/{fileId} format
  const shareUrl = `${serverUrl}/f/${encodeURIComponent(fileId)}`

  try {
    await navigator.clipboard.writeText(shareUrl)
    alert('Link copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy link:', err)
    alert('Failed to copy link. Please try again.')
  }
}

async function confirmAndDelete(photo: PhotoWithDate) {
  const confirmed = confirm(`Are you sure you want to delete "${photo.name}"?\n\nThe file will be moved to the recycle bin.`)
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
    const photoKey = photo.id || (photo as any).fileId || photo.name
    allPhotos.value = allPhotos.value.filter(p => {
      const key = p.id || (p as any).fileId || p.name
      return key !== photoKey
    })
    loadedPhotoIds.value.delete(photoKey)

    // Clean up blob cache
    if (blobUrlCache.has(photoKey)) {
      const cachedUrl = blobUrlCache.get(photoKey)
      if (cachedUrl && cachedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cachedUrl)
      }
      blobUrlCache.delete(photoKey)
    }

    // Handle lightbox state after deletion
    if (currentGroupPhotos.value.length > 0) {
      // Remove deleted photo from current group
      const deletedIndex = currentGroupPhotos.value.findIndex(p => {
        const key = p.id || (p as any).fileId || p.name
        return key === photoKey
      })

      if (deletedIndex >= 0) {
        currentGroupPhotos.value.splice(deletedIndex, 1)

        if (currentGroupPhotos.value.length === 0) {
          // No more photos in stack, close lightbox
          closeLightbox()
        } else {
          // Adjust index and show next/prev photo
          if (currentPhotoIndex.value >= currentGroupPhotos.value.length) {
            currentPhotoIndex.value = currentGroupPhotos.value.length - 1
          }
          selectedPhoto.value = currentGroupPhotos.value[currentPhotoIndex.value]
        }
      }
    }
  } catch (err) {
    console.error('Failed to delete photo:', err)
    alert('Failed to delete photo. Please try again.')
  }
}

function injectStyles() {
  const styleId = 'photo-addon-styles'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .photos-app {
      padding: 0 1.5rem 1.5rem 1.5rem;
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      max-height: calc(100vh - 60px);
      background: var(--oc-color-background-default, #fff);
    }
    .photos-header {
      margin-bottom: 1rem;
      position: sticky;
      top: 0;
      background: var(--oc-color-background-default, #fff);
      z-index: 100;
      padding: 1rem 0 0.5rem 0;
      margin-left: -1.5rem;
      margin-right: -1.5rem;
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .photos-header h1 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--oc-color-text-default, #333);
    }
    .view-selector {
      display: flex;
      align-items: center;
      gap: 2px;
      background: var(--oc-color-background-muted, #e5e5e5);
      border-radius: 6px;
      padding: 2px;
    }
    .view-btn {
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: var(--oc-color-text-default, #333);
      font-size: 0.875rem;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.15s ease;
    }
    .view-btn:hover {
      background: var(--oc-color-background-default, #fff);
    }
    .view-btn.active {
      background: var(--oc-color-background-default, #fff);
      color: var(--oc-color-swatch-primary-default, #0070c0);
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    /* Header controls container */
    .header-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    /* Control labels */
    .control-label {
      font-size: 0.875rem;
      color: var(--oc-color-text-muted, #666);
      white-space: nowrap;
    }
    /* Date filter */
    .date-filter {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .date-select {
      padding: 6px 10px;
      border: 1px solid var(--oc-color-border, #ddd);
      border-radius: 4px;
      background: var(--oc-color-background-default, #fff);
      color: var(--oc-color-text-default, #333);
      font-size: 0.875rem;
      cursor: pointer;
      min-width: 80px;
    }
    .date-select:hover {
      border-color: var(--oc-color-swatch-primary-default, #0070c0);
    }
    .date-select:focus {
      outline: none;
      border-color: var(--oc-color-swatch-primary-default, #0070c0);
      box-shadow: 0 0 0 2px rgba(0, 112, 192, 0.2);
    }
    .today-btn {
      padding: 6px 12px;
      border: 1px solid var(--oc-color-swatch-primary-default, #0070c0);
      border-radius: 4px;
      background: transparent;
      color: var(--oc-color-swatch-primary-default, #0070c0);
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .today-btn:hover {
      background: var(--oc-color-swatch-primary-default, #0070c0);
      color: white;
    }
    /* EXIF only toggle */
    .exif-toggle {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      background: var(--oc-color-background-muted, #f0f0f0);
      transition: background 0.15s ease;
    }
    .exif-toggle:hover {
      background: var(--oc-color-background-highlight, #e5e5e5);
    }
    .exif-toggle input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--oc-color-swatch-primary-default, #0070c0);
    }
    .exif-toggle .toggle-label {
      font-size: 0.875rem;
      color: var(--oc-color-text-default, #333);
      white-space: nowrap;
    }
    /* Breadcrumb Navigation (DISABLED)
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
      font-size: 0.875rem;
    }
    .breadcrumb-item:hover {
      background: var(--oc-color-background-muted, #f0f0f0);
    }
    .breadcrumb-item.active {
      color: var(--oc-color-text-default, #333);
      font-weight: 600;
      cursor: default;
    }
    .breadcrumb-item.active:hover {
      background: none;
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
      padding: 0.25rem 0.35rem;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      font-size: 0.75rem;
      line-height: 1;
      z-index: 5;
    }
    .folder-filter-btn:hover {
      background: rgba(0, 0, 0, 0.7);
    }
    .photo-item:hover .folder-filter-btn {
      opacity: 1;
    }
    */
    .photo-count, .loading-status {
      color: var(--oc-color-text-muted, #666);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--oc-color-border, #ddd);
      border-top-color: var(--oc-color-swatch-primary-default, #0070c0);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .load-more-hint {
      color: var(--oc-color-swatch-primary-default, #0070c0);
      font-style: italic;
    }
    .complete-hint {
      color: var(--oc-color-swatch-success-default, #2a7b2a);
    }
    .error { color: var(--oc-color-swatch-danger-default, #c00); }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
      color: var(--oc-color-text-muted, #666);
    }
    .empty-icon { font-size: 4rem; margin-bottom: 1rem; }
    .empty-hint { font-size: 0.875rem; opacity: 0.7; }
    .photo-groups {
      position: relative;
    }
    .date-group {
      padding: 0 0 1rem 0;
    }
    .date-header {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 0.75rem 0;
      color: var(--oc-color-text-default, #333);
      border-bottom: 1px solid var(--oc-color-border, #ddd);
      padding-bottom: 0.5rem;
      background: var(--oc-color-background-default, #fff);
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1.5rem;
    }
    .photo-item {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 8px;
      cursor: pointer;
      background: var(--oc-color-background-muted, #f5f5f5);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .photo-item:hover {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .photo-item img { width: 100%; height: 100%; object-fit: contain; background: var(--oc-color-background-muted, #f0f0f0); }
    .photo-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      padding: 0.5rem;
      color: white;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .photo-item:hover .photo-overlay { opacity: 1; }
    /* Context menu button on photos */
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
      font-size: 1.1rem;
      font-weight: bold;
      opacity: 0;
      transition: opacity 0.2s, background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      line-height: 1;
    }
    .photo-item:hover .photo-menu-btn {
      opacity: 1;
    }
    .photo-menu-btn:hover {
      background: rgba(0, 0, 0, 0.7);
    }
    .photo-name {
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .loading-more {
      text-align: center;
      padding: 2rem;
      color: var(--oc-color-text-muted, #666);
      font-style: italic;
    }
    /* Lightbox styles */
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
    .lightbox-top-buttons {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      display: flex;
      gap: 0.5rem;
      z-index: 10;
    }
    .lightbox-menu-btn {
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      font-size: 1.25rem;
      font-weight: bold;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .lightbox-menu-btn:hover {
      background: rgba(0, 0, 0, 0.7);
    }
    .lightbox-close {
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      font-size: 1.5rem;
      border-radius: 50%;
      cursor: pointer;
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
    .nav-arrow { font-weight: bold; line-height: 1; }
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
    .lightbox-loading {
      color: white;
      font-size: 1.2rem;
    }
    /* Fade transition */
    .fade-enter-active,
    .fade-leave-active {
      transition: opacity 0.2s ease;
    }
    .fade-enter-from,
    .fade-leave-to {
      opacity: 0;
    }
    /* PhotoStack styles */
    .photo-stack {
      position: relative;
      aspect-ratio: 1;
      cursor: pointer;
    }
    .stack-layer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 8px;
      overflow: hidden;
      background: var(--oc-color-background-muted, #e5e5e5);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .stack-layer img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: var(--oc-color-background-muted, #f0f0f0);
    }
    .stack-top {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 8px;
      overflow: hidden;
      background: var(--oc-color-background-muted, #f5f5f5);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      z-index: 10;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .photo-stack:hover .stack-top {
      transform: scale(1.02);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
    .stack-top img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: var(--oc-color-background-muted, #f0f0f0);
    }
    .stack-badge {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: var(--oc-color-swatch-primary-default, #0070c0);
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
      z-index: 20;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .stack-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      padding: 0.5rem;
      color: white;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 15;
      border-radius: 0 0 8px 8px;
    }
    .photo-stack:hover .stack-overlay {
      opacity: 1;
    }
    .stack-name {
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .stack-count {
      font-size: 0.65rem;
      opacity: 0.8;
    }
  `
  document.head.appendChild(style)
}

// Save settings to localStorage on change
watch(groupMode, (newVal) => {
  try {
    localStorage.setItem(STORAGE_KEY_GROUP_MODE, newVal)
  } catch (e) {
    // ignore
  }
})

watch(exifOnly, (newVal) => {
  try {
    localStorage.setItem(STORAGE_KEY_EXIF_ONLY, String(newVal))
  } catch (e) {
    // ignore
  }
  // Reload photos with new filter when toggle changes
  loadPhotos()
})

onMounted(() => {
  injectStyles()
  loadPhotos()
})
</script>

<style scoped>
/* Scoped styles as backup */
</style>
