import { describe, it, expect } from 'vitest'
import { usePhotos } from '../../src/composables/usePhotos'

describe('usePhotos', () => {
  const { isImage, filterImages, groupByDate, getDateKey } = usePhotos()
  
  describe('isImage', () => {
    it('should identify jpg files as images', () => {
      expect(isImage({ id: '1', name: 'photo.jpg' })).toBe(true)
      expect(isImage({ id: '2', name: 'photo.JPEG' })).toBe(true)
    })
    
    it('should identify png files as images', () => {
      expect(isImage({ id: '1', name: 'image.png' })).toBe(true)
    })
    
    it('should identify files by MIME type', () => {
      expect(isImage({ id: '1', name: 'file', mimeType: 'image/jpeg' })).toBe(true)
      expect(isImage({ id: '2', name: 'file', mimeType: 'image/png' })).toBe(true)
    })
    
    it('should reject non-image files', () => {
      expect(isImage({ id: '1', name: 'document.pdf' })).toBe(false)
      expect(isImage({ id: '2', name: 'video.mp4' })).toBe(false)
      expect(isImage({ id: '3', name: 'readme.txt' })).toBe(false)
    })
  })
  
  describe('filterImages', () => {
    it('should filter out non-image files', () => {
      const files = [
        { id: '1', name: 'photo1.jpg' },
        { id: '2', name: 'document.pdf' },
        { id: '3', name: 'photo2.png' },
        { id: '4', name: 'folder', type: 'folder' as const },
      ]
      
      const result = filterImages(files)
      
      expect(result).toHaveLength(2)
      expect(result.map(f => f.name)).toEqual(['photo1.jpg', 'photo2.png'])
    })
    
    it('should exclude folders', () => {
      const files = [
        { id: '1', name: 'Photos', type: 'folder' as const },
        { id: '2', name: 'photo.jpg' },
      ]
      
      const result = filterImages(files)
      
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('photo.jpg')
    })
  })
  
  describe('getDateKey', () => {
    it('should format date as YYYY-MM-DD', () => {
      const file = { id: '1', name: 'photo.jpg', mdate: new Date('2026-01-10').getTime() }
      expect(getDateKey(file)).toBe('2026-01-10')
    })
    
    it('should handle mtime as fallback', () => {
      const file = { id: '1', name: 'photo.jpg', mtime: new Date('2025-12-25').getTime() }
      expect(getDateKey(file)).toBe('2025-12-25')
    })
  })
  
  describe('groupByDate', () => {
    it('should group photos by date', () => {
      const photos = [
        { id: '1', name: 'a.jpg', mdate: new Date('2026-01-10').getTime() },
        { id: '2', name: 'b.jpg', mdate: new Date('2026-01-10').getTime() },
        { id: '3', name: 'c.jpg', mdate: new Date('2026-01-09').getTime() },
      ]
      
      const result = groupByDate(photos)
      
      expect(result.size).toBe(2)
      expect(result.get('2026-01-10')).toHaveLength(2)
      expect(result.get('2026-01-09')).toHaveLength(1)
    })
    
    it('should sort groups newest first', () => {
      const photos = [
        { id: '1', name: 'a.jpg', mdate: new Date('2026-01-08').getTime() },
        { id: '2', name: 'b.jpg', mdate: new Date('2026-01-10').getTime() },
        { id: '3', name: 'c.jpg', mdate: new Date('2026-01-09').getTime() },
      ]
      
      const result = groupByDate(photos)
      const dates = Array.from(result.keys())
      
      expect(dates).toEqual(['2026-01-10', '2026-01-09', '2026-01-08'])
    })
  })
})
