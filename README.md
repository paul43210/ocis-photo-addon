# oCIS Photo Add-on

A web extension for ownCloud Infinite Scale (oCIS) that provides an enhanced photo browsing experience.

## Features (Phase 1)

- **PhotoView** - A new view option alongside List and Icon views
- **Date Grouping** - Photos grouped by day based on file date/time
- **Image Filtering** - Automatically filters out non-image files
- **Clean Interface** - Focused photo browsing experience

## Future Phases

- Phase 2: PhotoPrism integration for AI metadata (faces, objects, scenes)
- Phase 3: Photo-specific actions (slideshow, download album, etc.)

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for local oCIS development environment)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourname/ocis-photo-addon.git
cd ocis-photo-addon

# Install dependencies
pnpm install

# Build (with watch mode for development)
pnpm build:w

# Start local oCIS environment
docker compose up
```

### Project Structure

```
ocis-photo-addon/
├── src/
│   ├── index.ts           # Extension entry point
│   ├── App.vue            # Main app component
│   ├── components/
│   │   ├── PhotoView.vue  # The new photo view component
│   │   ├── PhotoGrid.vue  # Grid layout for photos
│   │   └── DateGroup.vue  # Group header by date
│   ├── composables/
│   │   └── usePhotos.ts   # Photo filtering and grouping logic
│   └── types/
│       └── index.ts       # TypeScript type definitions
├── public/
│   └── manifest.json      # oCIS app manifest
├── tests/
│   └── unit/              # Unit tests
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Deployment

```bash
# Build for production
pnpm build

# Copy dist/ contents to your oCIS web apps directory:
# $OCIS_BASE_DATA_PATH/web/assets/apps/photo-addon/
```

## Configuration

Add to your oCIS `apps.yaml`:

```yaml
photo-addon:
  config:
    supportedExtensions:
      - jpg
      - jpeg
      - png
      - gif
      - webp
      - heic
```

## License

Apache-2.0

## Contributing

Contributions welcome! This project was created to fill a gap in the oCIS ecosystem for photo browsing capabilities that the community has been requesting since 2022.

## Links

- [oCIS Documentation](https://owncloud.dev/ocis/)
- [oCIS Web Extension Development](https://owncloud.dev/clients/web/extension-system/)
- [ownCloud Community Forum](https://central.owncloud.org/)
