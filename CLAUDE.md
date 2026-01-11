# CLAUDE.md - Project Instructions for Claude Code

## Project Overview

An oCIS web extension that adds a "PhotoView" to the file browser, displaying photos grouped by date with non-image files filtered out.

## Phase 1 Goals

1. Add a third view option called "PhotoView" (alongside List and Icon views)
2. Filter to show only image files (jpg, jpeg, png, gif, webp, heic)
3. Group photos by date (using file modification time)
4. Clean, focused photo browsing experience

## Environment

- **Development Server**: core-faure.ca (GCP)
- **User**: AIScripts
- **oCIS Instance**: https://cloud.faure.ca
- **oCIS Version**: Check with `curl -s https://cloud.faure.ca/.well-known/openid-configuration`

## Technology Stack

- **Language**: TypeScript
- **Framework**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **Package Manager**: pnpm
- **Testing**: Vitest

## Key oCIS Extension Concepts

### Extension Registration
Extensions register via `index.ts` exporting an `appInfo` object:
```typescript
export default {
  id: 'photo-addon',
  name: 'Photo View',
  // ... extension points
}
```

### File Structure for oCIS Web Apps
```
dist/
├── manifest.json    # Required - defines entrypoint
├── index.js         # Main bundle
└── (other assets)
```

### manifest.json Format
```json
{
  "entrypoint": "index.js",
  "config": {}
}
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Development build (watch mode)
pnpm build:w

# Production build
pnpm build

# Run tests
pnpm test:unit

# Lint
pnpm lint
```

## oCIS Web Extension Points

Key extension points we'll use:
- `folderView` - Register our PhotoView as a folder view option
- `quickActions` - Optional: add photo-specific actions

## Implementation Notes

### Detecting Image Files
Use MIME types or file extensions:
```typescript
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg']

function isImage(file: Resource): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext ? IMAGE_EXTENSIONS.includes(ext) : false
}
```

### Grouping by Date
```typescript
function groupByDate(files: Resource[]): Map<string, Resource[]> {
  // Group by YYYY-MM-DD from mtime
}
```

### oCIS Client Library
Use `@ownclouders/web-client` for API interactions:
```typescript
import { webdav } from '@ownclouders/web-client'
```

## Deployment to cloud.faure.ca

1. Build: `pnpm build`
2. Copy to oCIS: `scp -r dist/* user@core-faure:/path/to/ocis/web/apps/photo-addon/`
3. Restart oCIS or reload web interface

## Testing Strategy

1. Unit tests for grouping/filtering logic
2. Manual testing on cloud.faure.ca
3. Test with various image types and dates

## Resources

- [oCIS Extension System](https://owncloud.dev/clients/web/extension-system/)
- [web-app-skeleton](https://github.com/owncloud/web-app-skeleton)
- [web-extensions repo](https://github.com/owncloud/web-extensions)
- [@ownclouders/web-client](https://www.npmjs.com/package/@ownclouders/web-client)
