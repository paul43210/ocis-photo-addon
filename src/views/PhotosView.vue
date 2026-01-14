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
        </div>
      </div>
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
                <!-- Debug: show date source -->
                <span
                  v-if="subGroup.photos[0].dateSource"
                  :class="['date-source-badge', subGroup.photos[0].dateSource === 'mdate' ? 'fallback' : 'exif']"
                  :title="'Date from: ' + subGroup.photos[0].dateSource"
                >
                  {{ subGroup.photos[0].dateSource === 'mdate' ? 'mtime' : 'EXIF' }}
                </span>
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
      @close="closeLightbox"
      @navigate="navigatePhoto"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useClientService, useSpacesStore, useConfigStore } from '@ownclouders/web-pkg'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import PhotoLightbox from '../components/PhotoLightbox.vue'
import PhotoStack from '../components/PhotoStack.vue'

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
const groupMode = ref<GroupMode>('day')

// Refs
const scrollContainer = ref<HTMLElement | null>(null)
const allPhotos = ref<PhotoWithDate[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const currentDateRange = ref('')
const isFullyLoaded = ref(false)
const selectedPhoto = ref<PhotoWithDate | null>(null)

// Track loaded date ranges to avoid re-fetching
const loadedDates = ref<Set<string>>(new Set())

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
const INITIAL_DAYS = 7 // Search back 7 days on initial load
const DAYS_PER_BATCH = 14 // Load 14 days at a time when scrolling

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

const photoCount = computed(() => allPhotos.value.length)

// Group photos by date
const groupedPhotos = computed(() => {
  const mode = groupMode.value
  const groups = new Map<string, PhotoWithDate[]>()

  for (const photo of allPhotos.value) {
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
const SUB_GROUP_THRESHOLDS: Record<GroupMode, number> = {
  day: 60 * 1000,           // 60 seconds
  week: 60 * 60 * 1000,     // 1 hour
  month: 24 * 60 * 60 * 1000, // Same day (24 hours)
  year: 7 * 24 * 60 * 60 * 1000 // Same week (7 days)
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
  console.log(`Date filter changed to: ${filterYear.value}-${filterMonth.value + 1}`)
  loadPhotosFromFilter()
}

// Jump to today's date
function jumpToToday() {
  const now = new Date()
  filterYear.value = now.getFullYear()
  filterMonth.value = now.getMonth()
  loadPhotosFromFilter()
}

// Load photos for the selected month (filters from cache)
async function loadPhotosFromFilter() {
  // If cache is empty, do a full load first
  if (allPhotosCache.length === 0) {
    await loadPhotos()
    return
  }

  // Calculate date range for the selected month
  const year = filterYear.value
  const month = filterMonth.value

  // End of selected month (or today if current month)
  const now = new Date()
  let endDate: Date
  if (year === now.getFullYear() && month === now.getMonth()) {
    endDate = now
  } else {
    // Last day of selected month
    endDate = new Date(year, month + 1, 0)
  }

  // Start from beginning of month
  const startDate = new Date(year, month, 1)
  const startStr = formatDate(startDate)
  const endStr = formatDate(endDate)

  currentDateRange.value = `${monthNames[month]} ${year}`
  console.log(`[Filter] Filtering photos for: ${startStr} to ${endStr}`)

  // Filter from cache (instant, no API call)
  const filtered = allPhotosCache.filter(photo => {
    if (!photo.exifDate) return false
    return photo.exifDate >= startStr && photo.exifDate <= endStr
  }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  allPhotos.value = filtered
  console.log(`[Filter] ${filtered.length} photos for ${monthNames[month]} ${year}`)
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

  // DEBUG: Log the full resource structure for the first few photos
  if (debugPhotoCount < 3) {
    debugPhotoCount++
    console.log(`[DEBUG] Photo ${debugPhotoCount} raw resource:`, JSON.stringify(r, null, 2))
    console.log(`[DEBUG] Photo ${debugPhotoCount} .photo property:`, r.photo)
    console.log(`[DEBUG] Photo ${debugPhotoCount} .photo?.takenDateTime:`, r.photo?.takenDateTime)
  }

  // PRIMARY: Check for photo-taken-date-time WebDAV property (from our patched oCIS)
  // This is the oc:photo-taken-date-time property added to search results
  const photoTakenDateTime = r['photo-taken-date-time'] || r['oc:photo-taken-date-time'] ||
    r.photoTakenDateTime || r.extraProps?.['oc:photo-taken-date-time']
  if (photoTakenDateTime) {
    const parsed = parseExifDate(photoTakenDateTime)
    if (parsed) {
      console.log(`[EXIF] ${r.name}: Using photo-taken-date-time = ${photoTakenDateTime}`)
      return { ...parsed, source: 'photo-taken-date-time' }
    }
  }

  // SECONDARY: Check official oCIS SDK photo.takenDateTime field
  if (r.photo?.takenDateTime) {
    const parsed = parseExifDate(r.photo.takenDateTime)
    if (parsed) {
      console.log(`[EXIF] ${r.name}: Using photo.takenDateTime = ${r.photo.takenDateTime}`)
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
        console.log(`[EXIF] ${r.name}: Using legacy field ${field.name} = ${field.value}`)
        return { ...parsed, source: field.name }
      }
    }
  }

  // FALLBACK: Use file modification date
  const mdate = r.mdate || r.mtime
  if (mdate) {
    const d = new Date(mdate)
    if (!isNaN(d.getTime())) {
      console.log(`[EXIF] ${r.name}: No EXIF data, falling back to mdate = ${mdate}`)
      return {
        date: formatDate(d),
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`,
        timestamp: d.getTime(),
        source: 'mdate'
      }
    }
  }

  console.warn(`[EXIF] ${r.name}: No date found at all!`)
  return null
}

// Debug counter for limiting verbose logging
let debugPhotoCount = 0

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
 * Fetch all photos from a drive using Graph API
 * This recursively traverses all folders and returns items with photo metadata
 */
async function fetchAllPhotosFromDrive(driveId: string): Promise<PhotoWithDate[]> {
  const photos: PhotoWithDate[] = []
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')

  console.log(`[Graph] Fetching photos from drive: ${driveId}`)

  // For root folder, the itemId is: storageId$spaceId!spaceId
  // driveId format is: storageId$spaceId
  const [storageId, spaceId] = driveId.split('$')
  const rootItemId = `${storageId}$${spaceId}!${spaceId}`

  // Recursive function to fetch folder contents
  async function fetchFolderContents(folderId: string = rootItemId, folderPath: string = ''): Promise<void> {
    try {
      // oCIS Graph API: /drives/{driveId}/items/{itemId}/children
      const url = `${serverUrl}/graph/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderId)}/children`
      console.log(`[Graph] Fetching: ${url}`)

      const response = await clientService.httpAuthenticated.get<GraphResponse>(url)
      const items = response.data.value || []

      console.log(`[Graph] Got ${items.length} items from ${folderPath || 'root'}`)

      // Debug: log first item structure to see all available fields
      if (items.length > 0) {
        console.log('[Graph] First item full structure:', JSON.stringify(items[0], null, 2))
      }

      // Debug: log first item with photo
      const firstPhotoItem = items.find(item => item.photo)
      if (firstPhotoItem) {
        console.log('[Graph] First item with photo metadata:', {
          name: firstPhotoItem.name,
          photo: firstPhotoItem.photo,
          location: firstPhotoItem.location,
          webDavUrl: firstPhotoItem.webDavUrl,
          parentReference: firstPhotoItem.parentReference
        })
      }

      // Debug: check for any item with location data
      const itemWithLocation = items.find(item => item.location)
      if (itemWithLocation) {
        console.log('[Graph] Item with location data:', {
          name: itemWithLocation.name,
          location: itemWithLocation.location
        })
      } else {
        console.log('[Graph] No items have location data in this folder')
      }

      for (const item of items) {
        // If it's a folder, recurse into it
        if (item.folder) {
          await fetchFolderContents(item.id, `${folderPath}/${item.name}`)
          continue
        }

        // Check if it's an image file
        const mimeType = item.file?.mimeType || ''
        if (!mimeType.startsWith('image/')) continue

        // Skip non-photo images (SVG, icons)
        if (mimeType.includes('svg') || mimeType.includes('icon')) continue

        // Get unique ID for deduplication
        const photoId = item.id
        if (loadedPhotoIds.value.has(photoId)) continue
        loadedPhotoIds.value.add(photoId)

        // Extract date from photo.takenDateTime or lastModifiedDateTime
        let exifDate: string
        let exifTime: string
        let timestamp: number
        let dateSource: string

        if (item.photo?.takenDateTime) {
          // Use EXIF date from Graph API
          const d = new Date(item.photo.takenDateTime)
          exifDate = formatDate(d)
          exifTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
          timestamp = d.getTime()
          dateSource = 'photo.takenDateTime'
          console.log(`[Graph] ${item.name}: EXIF date = ${item.photo.takenDateTime}`)
        } else if (item.lastModifiedDateTime) {
          // Fallback to modification date
          const d = new Date(item.lastModifiedDateTime)
          exifDate = formatDate(d)
          exifTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
          timestamp = d.getTime()
          dateSource = 'lastModifiedDateTime'
        } else {
          // No date available, skip
          continue
        }

        // Create a Resource-compatible object
        // Use webDavUrl from Graph API for correct file access
        const photoResource: PhotoWithDate = {
          id: item.id,
          fileId: item.id,
          name: item.name,
          path: `${folderPath}/${item.name}`,
          webDavPath: item.webDavUrl || '',  // Full WebDAV URL from Graph API
          mimeType: mimeType,
          size: item.size || 0,
          exifDate,
          exifTime,
          timestamp,
          dateSource,
          graphPhoto: item.photo ? { ...item.photo, location: item.location } : { location: item.location }
        } as PhotoWithDate

        photos.push(photoResource)
      }

      // Handle pagination if there are more results
      // Note: oCIS Graph API uses @odata.nextLink for pagination
      // For now, we'll rely on the default page size being sufficient

    } catch (err) {
      console.error(`[Graph] Error fetching folder ${folderPath}:`, err)
    }
  }

  await fetchFolderContents()

  console.log(`[Graph] Total photos found: ${photos.length}`)
  return photos
}

/**
 * Search for photos by date range using Graph API
 * Fetches all photos then filters by date client-side
 */
async function searchPhotosByDateRange(startDate: string, endDate: string): Promise<PhotoWithDate[]> {
  if (!personalSpace) {
    console.error('[Graph] No personal space available')
    return []
  }

  console.log(`[Graph] Searching for photos from ${startDate} to ${endDate}`)

  // Check if we've already loaded all photos
  if (allPhotosCache.length === 0) {
    console.log('[Graph] Cache empty, fetching all photos...')
    allPhotosCache = await fetchAllPhotosFromDrive(personalSpace.id)
  }

  // Filter by date range
  const filtered = allPhotosCache.filter(photo => {
    if (!photo.exifDate) return false
    return photo.exifDate >= startDate && photo.exifDate <= endDate
  })

  console.log(`[Graph] ${filtered.length} photos in date range ${startDate} to ${endDate}`)
  return filtered
}

// Cache for all photos (avoid refetching on every date filter change)
let allPhotosCache: PhotoWithDate[] = []

/**
 * Search for photos by single date (wrapper for date range)
 */
async function searchPhotosByDate(dateStr: string): Promise<PhotoWithDate[]> {
  return searchPhotosByDateRange(dateStr, dateStr)
}

// Initial load - fetch all photos using Graph API
async function loadPhotos() {
  loading.value = true
  error.value = null
  allPhotos.value = []
  loadedPhotoIds.value.clear()
  allPhotosCache = [] // Clear cache for fresh load
  isFullyLoaded.value = false

  try {
    // Get personal space for thumbnail URLs
    const spaces = spacesStore.spaces
    personalSpace = spaces.find((s: SpaceResource) => s.driveType === 'personal') || null

    if (!personalSpace) {
      error.value = 'Could not find personal space'
      return
    }

    currentDateRange.value = 'all photos'
    console.log('[Graph] Initial load: fetching all photos')

    // Fetch all photos from the drive (will be cached)
    const photos = await fetchAllPhotosFromDrive(personalSpace.id)
    allPhotosCache = photos

    // Sort by date (newest first) and use all photos
    allPhotos.value = [...photos].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

    console.log(`[Graph] Initial load complete: ${allPhotos.value.length} photos`)

    // Mark as fully loaded since we fetched everything
    isFullyLoaded.value = true

  } catch (err: any) {
    console.error('Error loading photos:', err)
    error.value = err.message || 'Failed to load photos'
  } finally {
    loading.value = false
  }
}

// Load more photos (older dates) using date range
async function loadMorePhotos() {
  if (loadingMore.value || isFullyLoaded.value) return

  loadingMore.value = true
  const endDate = new Date(oldestLoadedDate.value)
  endDate.setDate(endDate.getDate() - 1)  // Start from day before oldest loaded

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - DAYS_PER_BATCH)

  try {
    currentDateRange.value = `${formatDate(startDate)} to ${formatDate(endDate)}`
    console.log(`Loading more: ${formatDate(startDate)} to ${formatDate(endDate)}`)

    const photos = await searchPhotosByDateRange(formatDate(startDate), formatDate(endDate))

    // Mark all dates in range as loaded
    const tempDate = new Date(startDate)
    while (tempDate <= endDate) {
      loadedDates.value.add(formatDate(tempDate))
      tempDate.setDate(tempDate.getDate() + 1)
    }

    oldestLoadedDate.value = new Date(startDate)

    if (photos.length > 0) {
      allPhotos.value = [...allPhotos.value, ...photos]
      console.log(`Loaded ${photos.length} more photos`)
    } else {
      // No photos found in this range - check if we should stop
      const today = new Date()
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      if (daysSinceStart > 365) {
        console.log('Gone back over a year, stopping search')
        isFullyLoaded.value = true
      } else {
        console.log('No photos in this batch, will try more on next scroll')
      }
    }

  } finally {
    loadingMore.value = false
  }
}

// Cache for blob URLs to avoid refetching
const blobUrlCache = new Map<string, string>()

function getPhotoUrl(photo: Resource): string {
  const p = photo as PhotoWithDate

  // Check if we already have a blob URL cached
  const cacheKey = p.id || p.fileId || p.name
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)!
  }

  // Return placeholder and fetch in background
  fetchAndCacheImage(p, cacheKey)

  // Return a placeholder or empty string while loading
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="10">Loading...</text></svg>'
}

// Fetch image with authentication and cache as blob URL
async function fetchAndCacheImage(photo: PhotoWithDate, cacheKey: string) {
  if (blobUrlCache.has(cacheKey)) return

  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  if (!personalSpace) return

  const spaceId = personalSpace.id
  const fileName = photo.name || ''
  if (!fileName) return

  // Construct the WebDAV URL for preview
  const url = `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}/${encodeURIComponent(fileName)}?preview=1&x=256&y=256&a=1`

  try {
    // Fetch with authentication
    const response = await clientService.httpAuthenticated.get(url, {
      responseType: 'blob'
    } as any)

    // Create blob URL
    const blob = response.data as Blob
    const blobUrl = URL.createObjectURL(blob)
    blobUrlCache.set(cacheKey, blobUrl)

    // Trigger reactivity by updating the photos array
    // Find and update the photo in allPhotos
    const index = allPhotos.value.findIndex(p => (p.id || p.fileId || p.name) === cacheKey)
    if (index >= 0) {
      // Force reactivity update
      allPhotos.value = [...allPhotos.value]
    }

    console.log(`[Image] Loaded: ${fileName}`)
  } catch (err) {
    console.error(`[Image] Failed to load ${fileName}:`, err)
    // Cache a placeholder for failed images
    blobUrlCache.set(cacheKey, 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="10">Error</text></svg>')
  }
}

function openPhoto(photo: PhotoWithDate, groupPhotos?: PhotoWithDate[]) {
  console.log('Open photo:', photo.name, groupPhotos ? `(group of ${groupPhotos.length})` : '(single)')
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

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="12">No preview</text></svg>'
}

function injectStyles() {
  const styleId = 'photo-addon-styles'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .photos-app {
      padding: 1.5rem;
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      max-height: calc(100vh - 60px);
      background: var(--oc-color-background-default, #fff);
    }
    .photos-header {
      margin-bottom: 1.5rem;
      position: sticky;
      top: 0;
      background: var(--oc-color-background-default, #fff);
      z-index: 10;
      padding-bottom: 0.5rem;
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
      gap: 0.5rem;
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
    /* Date source debug badges */
    .date-source-badge {
      position: absolute;
      top: 4px;
      left: 4px;
      padding: 2px 6px;
      font-size: 0.65rem;
      font-weight: 600;
      border-radius: 3px;
      z-index: 5;
      text-transform: uppercase;
    }
    .date-source-badge.exif {
      background: rgba(34, 139, 34, 0.9);
      color: white;
    }
    .date-source-badge.fallback {
      background: rgba(255, 165, 0, 0.9);
      color: white;
    }
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
    }
    .photo-item:hover .photo-overlay { opacity: 1; }
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
    }
    .lightbox-container {
      display: flex;
      flex-direction: column;
      max-width: 90vw;
      max-height: 90vh;
      background: var(--oc-color-background-default, #fff);
      border-radius: 8px;
      overflow: hidden;
      position: relative;
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
    /* Navigation buttons */
    .lightbox-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 3rem;
      height: 3rem;
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
      transition: background 0.2s, transform 0.2s;
    }
    .lightbox-nav:hover {
      background: rgba(0, 0, 0, 0.7);
      transform: translateY(-50%) scale(1.1);
    }
    .lightbox-nav-prev {
      left: 1rem;
    }
    .lightbox-nav-next {
      right: 1rem;
    }
    .nav-arrow {
      font-weight: bold;
      line-height: 1;
    }
    /* Photo counter */
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
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      min-height: 200px;
      padding: 2.5rem 1rem 1rem 1rem;
      box-sizing: border-box;
      overflow: auto;
    }
    .lightbox-image {
      max-width: calc(100% - 2rem);
      max-height: calc(70vh - 3rem);
      object-fit: contain;
      display: block;
      margin: auto;
    }
    .lightbox-panel {
      background: var(--oc-color-background-default, #fff);
      padding: 1rem;
      border-top: 1px solid var(--oc-color-border, #e0e0e0);
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
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.75rem;
    }
    .metadata-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .metadata-item.metadata-tags {
      grid-column: 1 / -1;
    }
    .metadata-label {
      font-size: 0.75rem;
      color: var(--oc-color-text-muted, #666);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .metadata-value {
      font-size: 0.875rem;
      color: var(--oc-color-text-default, #333);
    }
    .tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .tag-chip {
      background: var(--oc-color-background-default, #fff);
      border: 1px solid var(--oc-color-border, #e0e0e0);
      border-radius: 3px;
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
      color: var(--oc-color-text-default, #333);
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

onMounted(() => {
  injectStyles()
  loadPhotos()
})
</script>

<style scoped>
/* Scoped styles as backup */
</style>
