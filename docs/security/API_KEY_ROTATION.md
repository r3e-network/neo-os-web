# API Key Rotation Implementation

This document describes the API key rotation implementation for the Service Layer API.

## Overview

API key rotation is a security best practice that reduces the risk of unauthorized access due to compromised API keys. By automatically rotating keys after a certain period or when security events occur, we minimize the window of opportunity for attackers.

## Configuration

API key rotation is configured in the `config.yaml` file under the `security.api_keys` section:

```yaml
security:
  api_keys:
    rotation_enabled: true
    rotation_period_days: 90    # Automatic rotation every 90 days
    warning_days: 15            # Warn users 15 days before rotation
    grace_period_hours: 48      # Old key remains valid for 48 hours after rotation
    max_keys_per_user: 5        # Maximum number of active keys per user
```

## Key Rotation Process

The API key rotation process follows these steps:

1. **Scheduled Rotation**: Keys are automatically scheduled for rotation based on the configured rotation period.
2. **User Notification**: Users are notified of pending rotations via email and API response headers.
3. **New Key Generation**: A new API key is generated using a secure random generator.
4. **Grace Period**: Both the old and new keys are valid during the grace period to ensure smooth transitions.
5. **Old Key Revocation**: After the grace period, the old key is automatically revoked.

## Implementation Details

### Key Generation

API keys are generated using a cryptographically secure random number generator and follow this format:

```
sk_{environment}_{randomString}_{timestamp}
```

Where:
- `environment` is the current environment (dev, test, prod)
- `randomString` is a secure random string with 32 bytes of entropy
- `timestamp` is the creation time in Unix format

### API Key Database Schema

```
Table: api_keys
- id: UUID (primary key)
- user_id: UUID (foreign key to users table)
- key_hash: String (hashed API key)
- created_at: Timestamp
- expires_at: Timestamp
- last_used_at: Timestamp
- revoked: Boolean
- revoked_at: Timestamp
- rotation_notified_at: Timestamp
- name: String (user-defined name for the key)
- permissions: String[] (specific permissions for this key)
```

### Rotation Notification

Users are notified of pending rotations through:

1. **Email Notifications**: Sent 15 days, 7 days, and 1 day before rotation
2. **API Response Headers**: When using a key scheduled for rotation, these headers are included:
   - `X-API-Key-Rotation`: `true`
   - `X-API-Key-Rotation-Date`: Unix timestamp of planned rotation
   - `X-API-Key-Replacement`: New API key (only shown once when generated)

## Security Considerations

1. **Key Storage**: API keys are never stored in plaintext; only hashed values are stored.
2. **Rate Limiting**: Failed API key attempts are subject to increased rate limiting to prevent brute force attacks.
3. **Audit Logging**: All API key operations (creation, rotation, revocation) are logged for security auditing.
4. **Emergency Revocation**: In case of a security incident, administrators can immediately revoke keys without a grace period.

## User Experience

### API Key Management UI

Users can manage their API keys through a dedicated interface that allows:

1. Creating new API keys with specific permissions
2. Viewing active and upcoming rotations
3. Manually triggering key rotation
4. Revoking keys that are no longer needed

### API Integration

The API provides endpoints for:

```
GET /api/v1/api-keys               # List all API keys for the user
POST /api/v1/api-keys              # Create a new API key
POST /api/v1/api-keys/{id}/rotate  # Trigger rotation for a specific key
DELETE /api/v1/api-keys/{id}       # Revoke a specific API key
```

## Future Improvements

Planned improvements to the API key rotation system:

1. **Risk-Based Rotation**: Automatically trigger rotation based on unusual usage patterns
2. **Fine-Grained Permissions**: Allow more specific permissions to be associated with API keys
3. **Multiple Key Types**: Support different key types for different use cases (e.g., read-only, admin)
4. **Integration with Secret Management**: Support storing API keys in external secret managers