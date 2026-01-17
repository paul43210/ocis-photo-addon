/**
 * Shared type definitions for the oCIS photo addon
 */

import type { Resource } from '@ownclouders/web-client'

/**
 * GPS coordinates from EXIF data
 */
export interface GeoCoordinates {
  latitude?: number
  longitude?: number
  altitude?: number
}

/**
 * Photo metadata from Graph API / EXIF
 */
export interface GraphPhoto {
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

/**
 * Extended Resource with photo-specific fields
 */
export interface PhotoWithDate extends Resource {
  fileId?: string
  filePath?: string
  webDavPath?: string
  exifDate?: string       // YYYY-MM-DD from EXIF or mtime
  exifTime?: string       // HH:MM:SS
  timestamp?: number      // Unix timestamp for sorting/grouping
  dateSource?: string     // Track where the date came from
  graphPhoto?: GraphPhoto // Original Graph API photo metadata
}

/**
 * A sub-group (stack) of photos taken close together
 */
export interface PhotoSubGroup {
  id: string
  photos: PhotoWithDate[]
  timestamp: number
}

/**
 * Group mode for date-based grouping
 */
export type GroupMode = 'day' | 'week' | 'month' | 'year'

/**
 * View type for the photos app
 */
export type ViewType = 'calendar' | 'map'

/**
 * Photo group - photos grouped by date
 */
export interface PhotoGroup {
  date: string  // Date key (format depends on GroupMode)
  photos: PhotoWithDate[]
}

/**
 * Plugin configuration
 */
export interface PhotoAddonConfig {
  supportedExtensions?: string[]
  thumbnailSize?: number
  gridColumns?: number
}

/**
 * Supported image extensions (actual photo formats only)
 */
export const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif'
])
