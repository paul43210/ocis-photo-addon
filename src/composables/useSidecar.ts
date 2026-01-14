/**
 * Composable for handling Google Photos JSON sidecar files
 * These contain metadata like photoTakenTime and geoData
 */

import type { Resource } from '@ownclouders/web-client'

export interface GeoData {
  latitude: number
  longitude: number
  altitude?: number
}

export interface PhotoMetadata {
  title?: string
  description?: string
  photoTakenTime?: {
    timestamp: string
    formatted?: string
  }
  geoData?: GeoData
  geoDataExif?: GeoData
  creationTime?: {
    timestamp: string
    formatted?: string
  }
}

export interface EnrichedPhoto extends Resource {
  metadata?: PhotoMetadata
  takenAt?: Date
  location?: GeoData
  hasMetadata?: boolean
}

/**
 * Parse Google Photos JSON sidecar content
 */
export function parseSidecarJson(jsonContent: string): PhotoMetadata | null {
  try {
    const data = JSON.parse(jsonContent)
    return {
      title: data.title,
      description: data.description,
      photoTakenTime: data.photoTakenTime,
      geoData: data.geoData,
      geoDataExif: data.geoDataExif,
      creationTime: data.creationTime
    }
  } catch (e) {
    console.warn('Failed to parse sidecar JSON:', e)
    return null
  }
}

/**
 * Sidecar filename patterns used by Google Photos/Takeout:
 * - photo.jpg.json (standard)
 * - photo.jpg.supplemental-metadata.json (Google Takeout)
 * - photo.jpg.suppl.json (shortened version)
 */
const SIDECAR_PATTERNS = [
  /^(.+\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov))\.json$/i,
  /^(.+\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov))\.supplemental-metadata\.json$/i,
  /^(.+\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov))\.suppl\.json$/i,
]

/**
 * Get the expected sidecar filenames for an image (multiple patterns)
 */
export function getSidecarFilenames(imageFilename: string): string[] {
  return [
    `${imageFilename}.json`,
    `${imageFilename}.supplemental-metadata.json`,
    `${imageFilename}.suppl.json`
  ]
}

/**
 * Check if a filename is a sidecar JSON file
 */
export function isSidecarFile(filename: string): boolean {
  return SIDECAR_PATTERNS.some(pattern => pattern.test(filename))
}

/**
 * Get the image filename from a sidecar filename
 */
export function getImageFromSidecar(sidecarFilename: string): string | null {
  for (const pattern of SIDECAR_PATTERNS) {
    const match = sidecarFilename.match(pattern)
    if (match) {
      return match[1] // First capture group is the image filename
    }
  }
  return null
}

/**
 * Extract the actual photo date from metadata
 * Prioritizes: photoTakenTime > creationTime > file mdate
 */
export function getPhotoDate(photo: EnrichedPhoto): Date {
  // Use photoTakenTime if available (actual capture time)
  if (photo.metadata?.photoTakenTime?.timestamp) {
    const ts = parseInt(photo.metadata.photoTakenTime.timestamp)
    if (!isNaN(ts)) {
      return new Date(ts * 1000)
    }
  }

  // Fall back to creationTime
  if (photo.metadata?.creationTime?.timestamp) {
    const ts = parseInt(photo.metadata.creationTime.timestamp)
    if (!isNaN(ts)) {
      return new Date(ts * 1000)
    }
  }

  // Fall back to file modification date
  if (photo.mdate) {
    return new Date(photo.mdate)
  }

  return new Date()
}

/**
 * Get location from metadata
 */
export function getPhotoLocation(photo: EnrichedPhoto): GeoData | null {
  // Prefer geoDataExif (more accurate) over geoData
  const geo = photo.metadata?.geoDataExif || photo.metadata?.geoData

  if (geo && geo.latitude !== 0 && geo.longitude !== 0) {
    return geo
  }

  return null
}

/**
 * Build a map of sidecar files to their paths
 */
export function buildSidecarMap(files: Resource[]): Map<string, Resource> {
  const sidecarMap = new Map<string, Resource>()

  for (const file of files) {
    if (file.name && isSidecarFile(file.name)) {
      const imageName = getImageFromSidecar(file.name)
      if (imageName) {
        // Key by the image name (without path) for easy lookup
        sidecarMap.set(imageName.toLowerCase(), file)
      }
    }
  }

  return sidecarMap
}

export function useSidecar() {
  return {
    parseSidecarJson,
    getSidecarFilenames,
    isSidecarFile,
    getImageFromSidecar,
    getPhotoDate,
    getPhotoLocation,
    buildSidecarMap
  }
}
