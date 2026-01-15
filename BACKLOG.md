# oCIS Photo Add-on - Backlog

**Last Updated:** January 14, 2026

---

## Priority Legend
- 🔴 High - Core functionality or UX issues
- 🟡 Medium - Nice to have improvements
- 🟢 Low - Future considerations

---

## 🚨 Critical Bugs

### 🔴 BUG: Frontend Not Using Search API
- [x] **Replace folder traversal with WebDAV Search API**
- Currently makes 82 sequential `/children` API calls (~4 seconds)
- Should make 1 REPORT request to `/dav/spaces/{spaceId}` (~0.5 seconds)
- Backend search index is ready (Phase 1 complete), frontend never integrated
- **Impact:** Initial load takes ~6 seconds instead of ~2 seconds
- **Prompt:** `prompt-use-search-api.md`

### 🔴 BUG: Search Returns ALL Photos (No Date Filter)
- [x] **Add KQL date filter to search query**
- Currently pattern=`*` returns all 5251 photos (5.5MB, 4s wait)
- Should use `photo.takenDateTime:[3-months-ago TO today]`
- Initial load should fetch 3 months (2 visible + 1 buffer)
- Progressive loading for older photos on scroll
- **Impact:** 4s wait → 0.5s wait
- **Prompt:** `prompt-date-filtered-search.md`

---

## Phase 2: UI/UX Improvements

### 🔴 Stack View Fixes
- [x] Fix left/right arrow positioning (currently too low)
- [x] Enable swipe gestures for navigation
- [x] Improve touch responsiveness

### 🔴 Remove Icon Clutter
- [x] Remove "EXIF" indicator icon
- [x] Remove "MDATE" indicator icon
- [🟡] Cleaner, more minimal interface

### 🟡 Calendar View (Pinch-to-Zoom Groupings)
- [🔴] Implement pinch gesture recognition
- [ ] Day view (current default)
- [ ] Week view (pinch out)
- [ ] Month view (pinch out further)
- [ ] Year view (maximum zoom out)
- [🟢] Smooth transitions between zoom levels

### 🟡 File Navigation
- [🔴] Display the path to the photo in lightbox/details
- [🟡] Add "Open in Files" link to navigate to file location in standard oCIS view
- [🔴] Breadcrumb navigation in photo view

---

## Phase 2: Stack & Grouping Logic

### 🟡 Improved Stack Merging
- [🟡] Use GPS coordinates (lat/lon) for smarter grouping
- [ ] Group photos taken at same location within time window
- [ ] Configurable distance threshold for location-based grouping

### 🟡 Stack Cover Selection
- [🟢] Integrate with PhotoPrism image quality scoring
- [ ] Use highest quality image as stack "face"
- [ ] Fallback to most recent if no quality data

---

## Phase 3: Photo Actions & Context Menu

### 🔴 Context Menu ("⋮" Three Dots)
- [🟢] Rename photo
- [ ] Move to folder
- [ ] Copy to folder
- [ ] Share (generate link)
- [ ] Delete (with confirmation)
- [ ] Download original

### 🟡 Share Button
- [🟢] Quick share button in lightbox view
- [ ] Copy link to clipboard
- [ ] Share via oCIS sharing dialog

### 🟡 Tagging in Lightbox
- [🟢] View existing tags in popup
- [ ] Add new tags directly
- [ ] Remove tags
- [ ] Tag autocomplete from existing tags

---

## Phase 4: Map View

### 🟡 Map Integration
- [🟢] Map view showing photo locations (GPS)
- [ ] Search for all files within visible map bounds
- [ ] Cluster markers for photos within X km of each other
- [ ] Dynamic clustering based on zoom level
- [ ] Click cluster to expand or show photo grid
- [ ] "View on Map" from individual photo (exists in lightbox)

### Map Library Options
- Leaflet.js (open source, no API key)
- OpenStreetMap tiles
- Optional: Google Maps / Mapbox for premium features

---

## Phase 5: PhotoPrism Integration

### 🟡 Face Recognition
- [ ] Connect to PhotoPrism API for face detection
- [ ] Inject person tags into oCIS metadata
- [ ] Face-based photo grouping/filtering
- [ ] "People" view showing faces with photo counts

### 🟡 AI Quality Scoring
- [ ] Retrieve image quality scores from PhotoPrism
- [ ] Use for stack cover selection
- [ ] Filter/sort by quality

### Implementation Notes
- Requires PhotoPrism instance running alongside oCIS
- Need to map PhotoPrism library to oCIS file paths
- Consider webhook for automatic processing of new uploads

---

## Phase 6: Additional Features

### 🟢 Albums & Collections
- [ ] Create named albums
- [ ] Add photos to albums (without moving files)
- [ ] Album sharing
- [ ] Smart albums (auto-populated by criteria)

### 🟢 Slideshow Mode
- [ ] Full-screen slideshow
- [ ] Configurable timing
- [ ] Transition effects
- [ ] Background music support (?)

---

## Phase 7: Mobile Development

### 🟢 Mobile App Investigation
- [ ] Research Flutter vs React Native vs PWA
- [ ] Evaluate oCIS mobile SDK availability
- [ ] Consider PWA approach first (lower effort)
- [ ] Native app for iOS/Android if PWA insufficient

### Mobile-Specific Features
- [ ] Offline photo viewing (cached)
- [ ] Auto-upload from camera roll
- [ ] Background sync

---

## Community & Upstream

### 🟢 Contribution Goals
- [ ] Submit backend PR to upstream oCIS (photo metadata search)
- [ ] Submit photo-addon to awesome-ocis directory
- [ ] Write blog post / documentation for community
- [ ] Gather community feedback on priorities

### PR Status
- **Backend PR:** https://github.com/owncloud/ocis/compare/master...paul43210:ocis:feature/photo-metadata-search
- **Status:** Ready for review (not yet submitted)

---

## Technical Debt

- [ ] Add unit tests for new components
- [ ] Add e2e tests for critical flows
- [ ] Performance optimization for large libraries (10k+ photos)
- [ ] Accessibility audit (keyboard navigation, screen readers)
- [ ] i18n/localization support

---

## Completed ✅

- [x] Basic photo grid view
- [x] Date grouping by EXIF capture date
- [x] Infinite scroll (backwards in time)
- [x] Lightbox viewer with EXIF panel
- [x] Camera info display (make, model, aperture, ISO, etc.)
- [x] GPS coordinates with "View on Map" link
- [x] Backend: Photo metadata in Bleve search index
- [x] Backend: KQL photo field queries
- [x] Backend: WebDAV oc:photo-* properties
- [x] Frontend: WebDAV Search API integration
- [x] Frontend: Date-filtered search queries
- [x] Stack view: Arrow positioning fixed
- [x] Stack view: Swipe gesture navigation
- [x] Stack view: Touch responsiveness improvements
- [x] UI cleanup: Removed EXIF indicator icon
- [x] UI cleanup: Removed MDATE indicator icon
