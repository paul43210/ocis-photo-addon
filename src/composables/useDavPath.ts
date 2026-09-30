/**
 * WebDAV space path helpers.
 *
 * Space hrefs look like:
 *
 *   /dav/spaces/<spaceId>/Photos/2024/IMG.jpg
 *                ^^^^^^^^ everything after it is relative to that space
 *
 * Search results may come from spaces other than the queried one, so the
 * space id must be taken from the href itself, never assumed from context.
 */

export interface SpaceHref {
  spaceId: string // decoded, safe to pass to buildDavUrl
  path: string    // decoded, space-relative, e.g. "/Photos/IMG.jpg"
}

const DAV_SPACES_PREFIX = '/dav/spaces/'

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Split a space href into space id and space-relative path.
 * Parses the raw (encoded) href so space ids containing encoded
 * characters cannot break the segment split. Null when not a space href.
 */
export function parseSpaceHref(href: string): SpaceHref | null {
  if (!href.startsWith(DAV_SPACES_PREFIX)) return null

  const rest = href.slice(DAV_SPACES_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null

  return {
    spaceId: safeDecode(rest.slice(0, slash)),
    path: safeDecode(rest.slice(slash))
  }
}

/**
 * Build a server URL for a photo inside a space:
 *   <serverUrl>/dav/spaces/<spaceId>/<encoded path>?<query>
 */
export function buildDavUrl(
  serverUrl: string,
  spaceId: string,
  filePath: string,
  query?: Record<string, string>
): string {
  const encodedPath = filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')

  const url = `${serverUrl}${DAV_SPACES_PREFIX}${encodeURIComponent(spaceId)}${encodedPath}`
  if (!query) return url

  const qs = new URLSearchParams(query).toString()
  return qs ? `${url}?${qs}` : url
}
