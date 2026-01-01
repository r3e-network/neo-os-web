# API Documentation

## Overview

Neo MiniApp Platform API provides endpoints for managing MiniApps, user data, and platform features.

## Base URL

```
/api
```

## Authentication

Most endpoints require a wallet address for user identification.

---

## Endpoints

### Collections

- `GET /api/collections?wallet={address}` - Get user collections
- `POST /api/collections` - Add to collection
- `DELETE /api/collections/[appId]` - Remove from collection

### Preferences

- `GET /api/preferences?wallet={address}` - Get user preferences
- `PUT /api/preferences?wallet={address}` - Update preferences

### Versions

- `GET /api/versions/[appId]` - Get app versions
- `POST /api/versions/[appId]` - Create new version

### Reports

- `GET /api/reports?wallet={address}` - Get usage reports
- `POST /api/reports?wallet={address}` - Generate report

### Rankings

- `GET /api/rankings?type={hot|new|trending}` - Get app rankings
