# CLAUDE.md - Project Instructions for Claude Code

## Project Overview

This project creates an integration between ownCloud Infinite Scale (oCIS) and PhotoPrism for automated photo processing.

## Environment

- **Development Server**: core-faure.ca (GCP)
- **User**: AIScripts
- **oCIS Instance**: https://cloud.faure.ca (running locally on core-faure)
- **PhotoPrism**: TBD (will need separate server due to resource constraints)

## Key APIs

### oCIS APIs
- **WebDAV**: `https://cloud.faure.ca/dav/files/{username}/`
- **Graph API**: `https://cloud.faure.ca/graph/v1.0/`
- **CS3 API**: Internal gRPC-based API (for deep integration)

### PhotoPrism APIs
- **REST API**: `http://{photoprism-host}/api/v1/`
- Note: Face data only available per-photo, not bulk listings

## Development Approach

1. **Start with Option B** (Middleware Bridge) - simpler to implement and maintain
2. Use Python or Go for the bridge service
3. Test with rclone WebDAV mounts first as proof of concept

## File Structure (Planned)

```
ocis-photoprism-addon/
├── README.md
├── CLAUDE.md (this file)
├── bridge/                 # Middleware service
│   ├── main.py            # Entry point
│   ├── ocis_client.py     # oCIS WebDAV/Graph API client
│   ├── photoprism_client.py # PhotoPrism API client
│   └── config.yaml        # Configuration
├── docs/                   # Documentation
└── tests/                  # Test suite
```

## oCIS Configuration Notes

- oCIS uses decomposed storage (not traditional filesystem)
- Files must be accessed via WebDAV or CS3 API, not direct filesystem
- Admin credentials in `/etc/ocis/ocis.yaml`
- Impersonation available via auth-app tokens

## Commands to Remember

```bash
# Test oCIS WebDAV access
curl -u 'user:password' -X PROPFIND 'https://cloud.faure.ca/dav/files/username/'

# List oCIS users via Graph API
curl -u 'admin:password' 'https://cloud.faure.ca/graph/v1.0/users'

# Generate impersonation token (30 days)
curl -u 'admin:password' -X POST 'https://cloud.faure.ca/auth-app/tokens?expiry=720h&userName=username'
```

## Coding Standards

- Use type hints in Python
- Document all API interactions
- Handle errors gracefully with retries
- Log operations for debugging
- Keep credentials in config files, not code

## Testing

- Test with a small subset of photos first
- Verify metadata appears correctly in oCIS web UI
- Test with multiple users to ensure proper isolation
