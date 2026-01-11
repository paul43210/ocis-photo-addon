# CLAUDE.md - Project Instructions for Claude Code

## Project Overview

An oCIS web extension that adds a "PhotoView" to the file browser, displaying photos grouped by date with non-image files filtered out.

**Status**: Extension built and registered with oCIS. Appears in `config.json` → `external_apps`. Testing view switcher visibility.

## Phase 1 Goals

1. ✅ Add a third view option called "PhotoView" (alongside List and Icon views)
2. ✅ Filter to show only image files (jpg, jpeg, png, gif, webp, heic)
3. ✅ Group photos by date (using file modification time)
4. 🔄 Clean, focused photo browsing experience (testing in progress)

## Environment

- **Development Server**: core-faure.ca (GCP e2-small → upgraded to 8GB RAM)
- **User**: AIScripts
- **Project Path**: `/home/AIScripts/ocis-photo-addon/`
- **oCIS Instance**: https://cloud.faure.ca
- **oCIS Version**: 7.3.1
- **Extension Deployment Path**: `/data/owncloud/ocis/web/assets/apps/photo-addon/`

## GitHub Repository

**Planned Repository**: `github.com/<username>/ocis-photo-addon`

To set up GitHub:
```bash
# As AIScripts user on core-faure:
gh auth login  # or create SSH key and add to GitHub
gh repo create ocis-photo-addon --public --source=. --push

# Or manually:
git remote add origin git@github.com:<username>/ocis-photo-addon.git
git push -u origin main
```

**License**: Apache-2.0 (same as oCIS)

Consider submitting to [awesome-ocis](https://github.com/owncloud/awesome-ocis) once working.

## Technology Stack

- **Language**: TypeScript
- **Framework**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **Package Manager**: pnpm
- **Testing**: Vitest

## Critical Build Configuration

### AMD Module Format (REQUIRED)

oCIS web extensions **MUST** use AMD module format, not ES modules. The official extensions use anonymous AMD modules.

**vite.config.ts** must have:
```typescript
build: {
  lib: {
    entry: resolve(__dirname, 'src/index.ts'),
    name: 'PhotoAddon',
    fileName: 'index',
    formats: ['amd']  // NOT 'es'
  },
  rollupOptions: {
    external: ['vue', '@ownclouders/web-pkg', '@ownclouders/web-client', 'vue3-gettext'],
    output: {
      // NO 'amd: { id: ... }' - must be anonymous module
      globals: {
        'vue': 'Vue',
        '@ownclouders/web-pkg': '@ownclouders/web-pkg',
        '@ownclouders/web-client': '@ownclouders/web-client',
        'vue3-gettext': 'vue3-gettext'
      }
    }
  }
}
```

**Correct output** (anonymous AMD):
```javascript
define(["@ownclouders/web-pkg","vue"],function(_,e){ ... })
```

**Wrong output** (named AMD - will fail):
```javascript
define("photo-addon",["@ownclouders/web-pkg","vue"],function(_,e){ ... })
```

### manifest.json Format
```json
{
  "entrypoint": "index.js",
  "config": {
    "supportedExtensions": ["jpg", "jpeg", "png", "gif", "webp", "heic"]
  }
}
```

## Deployment

### Default Extension Path
oCIS looks for runtime extensions at:
```
$OCIS_BASE_DATA_PATH/web/assets/apps/
```

On core-faure.ca: `/data/owncloud/ocis/web/assets/apps/`

### Deploy Script
```bash
#!/bin/bash
cd /home/AIScripts/ocis-photo-addon
pnpm build
sudo cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/photo-addon/index.js
sudo cp dist/style.css /data/owncloud/ocis/web/assets/apps/photo-addon/
sudo cp public/manifest.json /data/owncloud/ocis/web/assets/apps/photo-addon/
sudo systemctl restart ocis
```

### Verify Deployment
```bash
# Check extension is registered
curl -s "http://127.0.0.1:9100/config.json" | grep -o '"external_apps":\[.*\]'

# Check files are served
curl -s "http://127.0.0.1:9100/assets/apps/photo-addon/manifest.json"
curl -s "http://127.0.0.1:9100/assets/apps/photo-addon/index.js" | head -1
```

## Debugging Notes (January 2026)

### Issue: Extension not appearing in view switcher

**Investigation findings**:
1. ✅ Files deployed to correct location
2. ✅ oCIS discovers extension (visible in `config.json` → `external_apps`)
3. ✅ AMD format correct (anonymous module)
4. ✅ Extension JS served correctly via HTTP
5. 🔄 Testing if `folderView` extension type is properly registered

**Key learnings**:
- Default path is `web/assets/apps/`, NOT `web/apps/`
- `WEB_ASSET_APPS_PATH` env var can override but default works
- AMD modules must be **anonymous** (no id parameter)
- Check browser console (F12) for JS loading errors
- Compare against working extensions like `json-viewer`

### Reference: Working Extension (json-viewer)
```bash
# Download official extension for comparison
curl -L -o json-viewer.zip "https://github.com/owncloud/web-extensions/releases/download/json-viewer-v0.3.1/json-viewer-0.3.1.zip"
unzip json-viewer.zip
cat json-viewer/manifest.json
head -50 json-viewer/json-viewer.js
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Development build (watch mode)
pnpm dev

# Production build
pnpm build

# Run tests
pnpm test:unit

# Lint
pnpm lint
```

## File Structure

```
ocis-photo-addon/
├── src/
│   ├── index.ts                    # Extension entry point (defineWebApplication)
│   ├── components/
│   │   ├── PhotoView.vue           # Main view component
│   │   ├── DateGroup.vue           # Date header + photo group
│   │   └── PhotoGrid.vue           # Responsive photo grid
│   ├── composables/
│   │   └── usePhotos.ts            # Filtering & grouping logic
│   └── types/
│       └── index.ts                # TypeScript definitions
├── public/
│   └── manifest.json               # oCIS app manifest
├── dist/                           # Build output
│   ├── index.amd.js               # AMD bundle (rename to index.js when deploying)
│   ├── manifest.json
│   └── style.css
├── tests/unit/
│   └── usePhotos.spec.ts           # Unit tests
├── package.json
├── vite.config.ts
├── tsconfig.json
├── CLAUDE.md                       # This file
└── README.md
```

## Extension Registration

The extension registers as a `folderView` type in `src/index.ts`:

```typescript
import { defineWebApplication } from '@ownclouders/web-pkg'
import PhotoView from './components/PhotoView.vue'

export default defineWebApplication({
  setup() {
    return {
      appInfo: {
        name: 'Photo View',
        id: 'photo-addon',
        icon: 'image',
        color: '#339900'
      },
      extensions: [
        {
          id: 'com.github.ocis-photo-addon.folder-view',
          type: 'folderView',
          scopes: ['resource', 'space', 'favorite', 'share'],
          folderView: {
            name: 'photo-view',
            label: 'Photo View',
            icon: { name: 'image', fillType: 'line' },
            component: PhotoView,
            componentAttrs: {}
          }
        }
      ]
    }
  }
})
```

## oCIS Web Service Ports

- **9100**: Web service (serves UI, extensions, config.json)
- **9200**: Proxy (main entry point, handles auth)

## Testing

### Browser Testing
1. Hard refresh (Ctrl+Shift+R) to clear cached JS
2. Navigate to folder with images
3. Look for view switcher icons (top-right of file list)
4. Check browser console (F12) for errors

### Useful curl Commands
```bash
# Check oCIS version
/usr/local/bin/ocis version

# Check external apps registration
curl -s http://127.0.0.1:9100/config.json | python3 -m json.tool | grep -A20 external_apps

# Check if extension JS loads
curl -s http://127.0.0.1:9100/assets/apps/photo-addon/index.js | head -5
```

## Resources

- [oCIS Extension System](https://owncloud.dev/clients/web/extension-system/)
- [Understanding Web Applications in oCIS](https://owncloud.com/news/understanding-web-applications-in-ocis/)
- [web-app-skeleton](https://github.com/owncloud/web-app-skeleton)
- [web-extensions repo](https://github.com/owncloud/web-extensions)
- [oCIS Web Service Docs](https://doc.owncloud.com/ocis/next/deployment/webui/webui-customisation.html)
- [@ownclouders/web-client](https://www.npmjs.com/package/@ownclouders/web-client)
- [@ownclouders/web-pkg](https://www.npmjs.com/package/@ownclouders/web-pkg)

## Next Steps

1. Test if PhotoView appears in browser after hard refresh
2. If not, check browser console for JS errors
3. May need to adjust extension type or registration format
4. Compare props/events with working oCIS folder views
5. Set up GitHub repository for collaboration
