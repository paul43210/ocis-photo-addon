import { describe, it, expect } from 'vitest'
import { parseSpaceHref, buildDavUrl } from '../../src/composables/useDavPath'

const PERSONAL = 'space-aaa'
const SHARED = 'space-bbb'

describe('parseSpaceHref', () => {
  it('splits a personal space href into space id and path', () => {
    expect(parseSpaceHref(`/dav/spaces/${PERSONAL}/IMG_1761.jpg`)).toEqual({
      spaceId: PERSONAL,
      path: '/IMG_1761.jpg'
    })
  })

  it('splits a foreign space href (no personal prefix)', () => {
    expect(parseSpaceHref(`/dav/spaces/${SHARED}/dir/IMG.jpg`)).toEqual({
      spaceId: SHARED,
      path: '/dir/IMG.jpg'
    })
  })

  it('decodes encoded space ids and paths', () => {
    const href = `/dav/spaces/${encodeURIComponent('a/b+c')}/Photos/My%20Pic.jpg`
    expect(parseSpaceHref(href)).toEqual({
      spaceId: 'a/b+c',
      path: '/Photos/My Pic.jpg'
    })
  })

  it('returns null for non-space hrefs', () => {
    expect(parseSpaceHref(`/dav/files/user/IMG.jpg`)).toBeNull()
    expect(parseSpaceHref('/IMG.jpg')).toBeNull()
  })
})

describe('buildDavUrl', () => {
  it('builds a single-space url', () => {
    expect(buildDavUrl('', PERSONAL, '/IMG.jpg')).toBe(
      `/dav/spaces/${PERSONAL}/IMG.jpg`
    )
  })

  it('round-trips a foreign space href without doubling the prefix', () => {
    // Regression: personal id was prepended to a foreign space path,
    // yielding /dav/spaces/<personal>/dav/spaces/<space>/dir/IMG.jpg
    const href = `/dav/spaces/${SHARED}/dir/IMG.jpg`
    const { spaceId, path } = parseSpaceHref(href)!

    expect(buildDavUrl('', spaceId, path)).toBe(href)
  })

  it('encodes space id and path segments once', () => {
    expect(buildDavUrl('', 'a/b+c', '/Photos/My Pic.jpg')).toBe(
      '/dav/spaces/a%2Fb%2Bc/Photos/My%20Pic.jpg'
    )
  })

  it('appends query params', () => {
    expect(buildDavUrl('https://cloud', PERSONAL, '/IMG.jpg', { preview: '1', x: '256' })).toBe(
      `https://cloud/dav/spaces/${PERSONAL}/IMG.jpg?preview=1&x=256`
    )
  })
})
