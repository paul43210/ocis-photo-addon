/**
 * Composable for photo filtering and grouping operations
 * Works with oCIS Resource type from @ownclouders/web-client
 */

import type { Resource } from '@ownclouders/web-client'

// Supported image extensions (strict list)
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif'
])

export function usePhotos() {

  /**
   * Check if a file is an image based on MIME type (primary) and extension (fallback)
   * Very strict - only actual photo formats
   */
  function isImage(file: Resource): boolean {
    const name = (file.name || '').toLowerCase()

    // STRICT: Exclude any file containing .json, .xml, .txt in the name
    if (name.includes('.json') || name.includes('.xml') || name.includes('.txt')) {
      return false
    }

    // Must have a MIME type that starts with 'image/'
    if (file.mimeType) {
      const mime = file.mimeType.toLowerCase()
      if (!mime.startsWith('image/')) {
        return false
      }
      // Exclude SVG and icons - not photos
      if (mime.includes('svg') || mime.includes('icon')) {
        return false
      }
      return true
    }

    // Fallback: check extension (strict list)
    const ext = name.split('.').pop() || ''
    return IMAGE_EXTENSIONS.has(ext)
  }

  /**
   * Check if file has our EXIF imported tag
   */
  function hasExifTag(file: Resource): boolean {
    const tags = (file as any).tags
    if (!tags) return false

    if (Array.isArray(tags)) {
      return tags.some(t => t && t.includes('exifimported'))
    }
    if (typeof tags === 'string') {
      return tags.includes('exifimported')
    }
    return false
  }

  /**
   * Get file extension (lowercase)
   */
  function getExtension(filename: string): string | null {
    const parts = filename.split('.')
    if (parts.length < 2) return null
    return parts[parts.length - 1].toLowerCase()
  }

  // Debug counter for limiting verbose logging
  let filterDebugCount = 0

  /**
   * Filter a list of resources to only include images
   * Now uses built-in oCIS photo metadata (photo.takenDateTime) instead of custom tags
   */
  function filterImages(files: Resource[]): Resource[] {
    // Reset debug counter for each filter call
    filterDebugCount = 0

    const filtered = files.filter(file => {
      // Exclude directories
      if (file.isFolder || file.type === 'folder') {
        return false
      }
      const img = isImage(file)

      // Debug: log first few resources to see structure
      if (img && filterDebugCount < 5) {
        filterDebugCount++
        const f = file as any
        console.log(`[usePhotos] Resource ${filterDebugCount}:`, file.name)
        console.log(`  - file.photo:`, file.photo)
        console.log(`  - file.photo?.takenDateTime:`, file.photo?.takenDateTime)
        console.log(`  - file.mdate:`, file.mdate)
        // Check for any EXIF-like properties
        const exifProps = Object.keys(f).filter(k =>
          k.toLowerCase().includes('exif') ||
          k.toLowerCase().includes('date') ||
          k.toLowerCase().includes('photo') ||
          k.toLowerCase().includes('taken')
        )
        if (exifProps.length > 0) {
          console.log(`  - EXIF-related props:`, exifProps.map(k => `${k}=${f[k]}`))
        }
      }

      return img
    })
    console.log(`filterImages: ${files.length} files -> ${filtered.length} photos`)
    return filtered
  }

  /**
   * Filter images without requiring EXIF tag (for browsing unprocessed)
   */
  function filterAllImages(files: Resource[]): Resource[] {
    return files.filter(file => {
      if (file.isFolder || file.type === 'folder') {
        return false
      }
      return isImage(file)
    })
  }

  type GroupMode = 'day' | 'week' | 'month' | 'year'

  /**
   * Extract EXIF date from a file resource
   * Priority:
   *   1. resource.photo.takenDateTime (official oCIS SDK field)
   *   2. Legacy/fallback property names
   * Returns null if no EXIF date is found
   */
  function getExifDate(file: Resource): Date | null {
    // Primary: Check official oCIS photo.takenDateTime field
    // This is populated from EXIF DateTimeOriginal during Tika indexing
    if (file.photo?.takenDateTime) {
      const parsed = parseExifDate(file.photo.takenDateTime)
      if (parsed) {
        return parsed
      }
    }

    // Fallback: Check legacy/alternate property locations
    const f = file as any
    const fallbackSources = [
      // Direct properties (legacy)
      f.exifDateTimeOriginal,
      f.exifDate,
      f.dateTaken,
      f.photoTakenTime,
      f.dateTimeOriginal,

      // Nested in metadata object
      f.metadata?.exifDateTimeOriginal,
      f.metadata?.dateTaken,
      f.metadata?.photoTakenTime,
      f.metadata?.dateTimeOriginal,

      // Custom WebDAV properties (oc: namespace)
      f['oc:exif-date'],
      f['oc:date-taken'],
      f['oc:photo-taken-time'],

      // Additional common property names
      f.additionalData?.exifDate,
      f.additionalData?.dateTaken,

      // Tags-based (if stored as structured data)
      f.exif?.DateTimeOriginal,
      f.exif?.DateTime,
    ]

    for (const source of fallbackSources) {
      if (source) {
        const parsed = parseExifDate(source)
        if (parsed) {
          return parsed
        }
      }
    }

    return null
  }

  /**
   * Parse various EXIF date formats
   * EXIF dates can be: Unix timestamp, ISO string, or "YYYY:MM:DD HH:MM:SS" format
   */
  function parseExifDate(value: any): Date | null {
    if (!value) return null

    // Handle Unix timestamp (seconds or milliseconds)
    if (typeof value === 'number') {
      // If it looks like seconds (before year 3000 in seconds)
      if (value < 32503680000) {
        return new Date(value * 1000)
      }
      return new Date(value)
    }

    // Handle timestamp object { timestamp: "..." }
    if (typeof value === 'object' && value.timestamp) {
      const ts = parseInt(value.timestamp)
      if (!isNaN(ts)) {
        return new Date(ts * 1000)
      }
    }

    // Handle string formats
    if (typeof value === 'string') {
      // Try EXIF format: "YYYY:MM:DD HH:MM:SS"
      const exifMatch = value.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
      if (exifMatch) {
        const [, year, month, day, hour, min, sec] = exifMatch
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(min),
          parseInt(sec)
        )
      }

      // Try ISO format or other parseable strings
      const parsed = new Date(value)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }

    return null
  }

  /**
   * Get the best available date for a photo
   * Priority: 1) EXIF data, 2) File modification date
   */
  function getPhotoDate(file: Resource): Date {
    // First, try to get EXIF date
    const exifDate = getExifDate(file)
    if (exifDate) {
      return exifDate
    }

    // Fall back to file modification date
    if (file.mdate) {
      return new Date(file.mdate)
    }

    // Last resort: current date
    return new Date()
  }

  /**
   * Get date string based on grouping mode
   * Uses EXIF date if available, falls back to mdate
   */
  function getDateKey(file: Resource, mode: GroupMode = 'day'): string {
    const date = getPhotoDate(file)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    switch (mode) {
      case 'year':
        return `${year}`
      case 'month':
        return `${year}-${month}`
      case 'week':
        // Get ISO week number
        const weekNum = getISOWeek(date)
        return `${year}-W${String(weekNum).padStart(2, '0')}`
      case 'day':
      default:
        return `${year}-${month}-${day}`
    }
  }

  /**
   * Get ISO week number
   */
  function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  /**
   * Format date key for display based on mode
   */
  function formatDateKey(dateKey: string, mode: GroupMode): string {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    switch (mode) {
      case 'year':
        return dateKey // Just the year
      case 'month': {
        const [year, month] = dateKey.split('-').map(Number)
        const date = new Date(year, month - 1, 1)
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
      }
      case 'week': {
        const [year, weekPart] = dateKey.split('-W')
        const weekNum = parseInt(weekPart)
        // Get first day of the week
        const firstDayOfYear = new Date(parseInt(year), 0, 1)
        const daysOffset = (weekNum - 1) * 7
        const weekStart = new Date(firstDayOfYear)
        weekStart.setDate(firstDayOfYear.getDate() + daysOffset - firstDayOfYear.getDay() + 1)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      }
      case 'day':
      default: {
        const [year, month, day] = dateKey.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        if (date.toDateString() === today.toDateString()) return 'Today'
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
        return date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
    }
  }

  /**
   * Group photos by date with specified mode
   */
  function groupByDate(photos: Resource[], mode: GroupMode = 'day'): Map<string, Resource[]> {
    const groups = new Map<string, Resource[]>()

    for (const photo of photos) {
      const dateKey = getDateKey(photo, mode)
      const existing = groups.get(dateKey) || []
      existing.push(photo)
      groups.set(dateKey, existing)
    }

    // Sort each group by time (newest first within each group)
    // Uses EXIF date when available, falls back to mdate
    for (const [, groupPhotos] of groups) {
      groupPhotos.sort((a, b) => {
        const timeA = getPhotoDate(a).getTime()
        const timeB = getPhotoDate(b).getTime()
        return timeB - timeA
      })
    }

    // Sort by date key (newest first)
    const sortedEntries = Array.from(groups.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))

    return new Map(sortedEntries)
  }

  /**
   * Get photo count by date for statistics
   */
  function getPhotoCountsByDate(photos: Resource[]): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const photo of photos) {
      const dateKey = getDateKey(photo)
      counts[dateKey] = (counts[dateKey] || 0) + 1
    }

    return counts
  }

  return {
    isImage,
    hasExifTag,
    filterImages,
    filterAllImages,
    groupByDate,
    getDateKey,
    formatDateKey,
    getPhotoCountsByDate,
    getPhotoDate,
    getExifDate,
    IMAGE_EXTENSIONS: Array.from(IMAGE_EXTENSIONS)
  }
}

export type GroupMode = 'day' | 'week' | 'month' | 'year'
