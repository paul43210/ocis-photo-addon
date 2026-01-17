/**
 * Composable for photo filtering and grouping operations
 * Works with oCIS Resource type from @ownclouders/web-client
 */

import type { Resource } from '@ownclouders/web-client'
import { IMAGE_EXTENSIONS, type GroupMode } from '../types'

export function usePhotos() {

  /**
   * Check if a file is an image based on MIME type (primary) and extension (fallback)
   */
  function isImage(file: Resource): boolean {
    const name = (file.name || '').toLowerCase()

    // Exclude metadata/sidecar files
    if (name.includes('.json') || name.includes('.xml') || name.includes('.txt')) {
      return false
    }

    // Check MIME type first (most reliable)
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

    // Fallback: check extension
    const ext = name.split('.').pop() || ''
    return IMAGE_EXTENSIONS.has(ext)
  }

  /**
   * Check if file has EXIF imported tag
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
   * Filter a list of resources to only include images
   */
  function filterImages(files: Resource[]): Resource[] {
    return files.filter(file => {
      if (file.isFolder || file.type === 'folder') {
        return false
      }
      return isImage(file)
    })
  }

  /**
   * Filter images without requiring EXIF tag
   */
  function filterAllImages(files: Resource[]): Resource[] {
    return filterImages(files)
  }

  /**
   * Extract EXIF date from a file resource
   * Priority:
   *   1. resource.photo.takenDateTime (official oCIS SDK field)
   *   2. Legacy/fallback property names
   * Returns null if no EXIF date is found
   */
  function getExifDate(file: Resource): Date | null {
    // Primary: Check official oCIS photo.takenDateTime field
    if (file.photo?.takenDateTime) {
      const parsed = parseExifDate(file.photo.takenDateTime)
      if (parsed) {
        return parsed
      }
    }

    // Fallback: Check legacy/alternate property locations
    const f = file as any
    const fallbackSources = [
      f.exifDateTimeOriginal,
      f.exifDate,
      f.dateTaken,
      f.photoTakenTime,
      f.dateTimeOriginal,
      f.metadata?.exifDateTimeOriginal,
      f.metadata?.dateTaken,
      f['oc:exif-date'],
      f['oc:date-taken'],
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
    const exifDate = getExifDate(file)
    if (exifDate) {
      return exifDate
    }

    if (file.mdate) {
      return new Date(file.mdate)
    }

    return new Date()
  }

  /**
   * Get date string based on grouping mode
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
        return dateKey
      case 'month': {
        const [year, month] = dateKey.split('-').map(Number)
        const date = new Date(year, month - 1, 1)
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
      }
      case 'week': {
        const [year, weekPart] = dateKey.split('-W')
        const weekNum = parseInt(weekPart)
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

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * Returns distance in meters
   */
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Format file size for display
   */
  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  /**
   * Format date for display
   */
  function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
    parseExifDate,
    getISOWeek,
    calculateDistance,
    formatSize,
    formatDate,
    IMAGE_EXTENSIONS: Array.from(IMAGE_EXTENSIONS)
  }
}

export type { GroupMode }
