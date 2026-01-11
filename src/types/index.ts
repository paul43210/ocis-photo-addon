/**
 * Type definitions for the photo addon
 */

/**
 * Resource type - represents a file or folder in oCIS
 * This is a simplified version of the oCIS Resource type
 */
export interface Resource {
  id: string
  name: string
  path?: string
  webDavPath?: string
  downloadURL?: string
  
  // Type indicators
  type?: 'file' | 'folder'
  isFolder?: boolean
  
  // MIME type
  mimeType?: string
  
  // Timestamps (Unix timestamps in milliseconds)
  mdate?: number  // Modified date
  mtime?: number  // Modified time (alias)
  cdate?: number  // Created date
  ctime?: number  // Created time (alias)
  
  // Size
  size?: number
  
  // Thumbnail
  thumbnail?: string
  
  // Parent info
  parentFolderId?: string
  
  // Extension info
  extension?: string
}

/**
 * Photo group - photos grouped by date
 */
export interface PhotoGroup {
  date: string  // YYYY-MM-DD format
  photos: Resource[]
}

/**
 * Plugin configuration
 */
export interface PhotoAddonConfig {
  supportedExtensions?: string[]
  thumbnailSize?: number
  gridColumns?: number
}
