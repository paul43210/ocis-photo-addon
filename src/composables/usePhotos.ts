/**
 * Composable for photo filtering and grouping operations
 */

import type { Resource } from '../types'

// Supported image extensions
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg', 'ico', 'tiff', 'tif'
])

// Image MIME types for additional detection
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
  'image/heic', 'image/heif', 'image/bmp', 'image/svg+xml',
  'image/tiff', 'image/x-icon'
])

export function usePhotos() {
  
  /**
   * Check if a file is an image based on extension or MIME type
   */
  function isImage(file: Resource): boolean {
    // Check MIME type first
    if (file.mimeType && IMAGE_MIME_TYPES.has(file.mimeType.toLowerCase())) {
      return true
    }
    
    // Fall back to extension check
    const extension = getExtension(file.name)
    return extension ? IMAGE_EXTENSIONS.has(extension) : false
  }
  
  /**
   * Get file extension (lowercase)
   */
  function getExtension(filename: string): string | null {
    const parts = filename.split('.')
    if (parts.length < 2) return null
    return parts[parts.length - 1].toLowerCase()
  }
  
  /**
   * Filter a list of resources to only include images
   */
  function filterImages(files: Resource[]): Resource[] {
    return files.filter(file => {
      // Exclude directories
      if (file.type === 'folder' || file.isFolder) {
        return false
      }
      return isImage(file)
    })
  }
  
  /**
   * Get date string (YYYY-MM-DD) from a resource
   */
  function getDateKey(file: Resource): string {
    // Try different date properties
    const timestamp = file.mdate || file.mtime || file.cdate || file.ctime || Date.now()
    const date = new Date(timestamp)
    
    // Format as YYYY-MM-DD for sorting
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  }
  
  /**
   * Group photos by date
   * Returns a Map with date strings as keys, sorted newest first
   */
  function groupByDate(photos: Resource[]): Map<string, Resource[]> {
    const groups = new Map<string, Resource[]>()
    
    // Group photos
    for (const photo of photos) {
      const dateKey = getDateKey(photo)
      const existing = groups.get(dateKey) || []
      existing.push(photo)
      groups.set(dateKey, existing)
    }
    
    // Sort each group by time (newest first within each day)
    for (const [key, photos] of groups) {
      photos.sort((a, b) => {
        const timeA = a.mdate || a.mtime || 0
        const timeB = b.mdate || b.mtime || 0
        return timeB - timeA
      })
    }
    
    // Convert to array, sort by date (newest first), convert back to Map
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
    filterImages,
    groupByDate,
    getDateKey,
    getPhotoCountsByDate,
    IMAGE_EXTENSIONS: Array.from(IMAGE_EXTENSIONS)
  }
}
