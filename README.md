# oCIS PhotoPrism Integration Add-on

An integration layer that connects ownCloud Infinite Scale (oCIS) with PhotoPrism for automated photo processing and metadata enrichment.

## Project Goals

1. **Automatic Processing**: When photos are uploaded to oCIS (via mobile app auto-upload), they should be automatically processed by PhotoPrism
2. **Metadata Sync**: AI-generated metadata from PhotoPrism (faces, objects, scenes, labels) should be written back to oCIS and visible to users browsing photos
3. **Shareable Solution**: Build something that can be open-sourced for the community (this integration has been requested since 2022)

## Architecture Options

### Option A: Full oCIS Extension (Go)
- Native integration using oCIS microservices architecture
- TypeScript web extension for UI
- Estimated effort: 6-10 weeks
- Pros: Deep integration, best UX
- Cons: Complex, maintenance burden as both platforms evolve

### Option B: Middleware Bridge (Recommended Start)
- Standalone service that watches oCIS for changes
- Uses WebDAV/CS3 API to access files
- Calls PhotoPrism API for processing
- Writes metadata back via oCIS Graph API
- Estimated effort: 2-4 weeks
- Pros: Simpler, decoupled, easier to maintain

### Option C: Shared Storage + Webhooks
- Mount oCIS storage via WebDAV for PhotoPrism
- Use filesystem watchers or oCIS webhooks
- Estimated effort: Days to configure
- Pros: Minimal code
- Cons: Limited metadata sync capabilities

## Technical Constraints

- **oCIS Server**: core-faure.ca (GCP e2-small, 2GB RAM) - resource constrained
- **PhotoPrism**: Needs separate host due to resource requirements (AI server TBD)
- **Users**: 7 family members using oCIS

## Current Status

- [ ] Research phase - understanding APIs and extension mechanisms
- [ ] Proof of concept
- [ ] MVP implementation
- [ ] Testing with real data
- [ ] Documentation and release

## Resources

- [oCIS Documentation](https://owncloud.dev/ocis/)
- [PhotoPrism API](https://docs.photoprism.app/developer-guide/)
- [oCIS Extension Boilerplate](https://github.com/owncloud/boilr-extension)
