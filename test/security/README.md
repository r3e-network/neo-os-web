# Security Testing Suite

This directory contains comprehensive security tests for the Service Layer components.

## JWT Validation Tests

The JWT validation tests (`jwt_validation_test.go`) ensure that the authentication system is secure and robust. These tests cover:

1. **Token Structure and Format Validation**
   - Verifies correct JWT format with three parts
   - Validates proper base64url encoding 
   - Checks header content for algorithm and token type
   - Ensures payload contains required claims

2. **Signature Verification**
   - Validates tokens with valid signatures
   - Rejects tokens with invalid signatures
   - Tests different signing methods

3. **Claims Validation**
   - Verifies required claims are present
   - Validates issuer claim
   - Checks custom claims
   - Verifies correct data types for claims

4. **Token Expiration**
   - Rejects expired tokens
   - Rejects tokens that are not yet valid
   - Verifies reasonable expiration times
   - Tests refresh token system

5. **Attack Prevention**
   - Tests against algorithm confusion attacks
   - Tests for token tampering detection
   - Verifies protection against various attack vectors

### Running the Tests

To run the JWT validation tests:

```bash
go test -v ./test/security/jwt_validation_test.go
```

To run all security tests:

```bash
go test -v ./test/security/...
```

## Integration Tests

The integration tests (`auth_integration_test.go` in the `test/integration` directory) verify that authentication works consistently across different services, ensuring:

1. Valid tokens are accepted by all protected endpoints
2. Invalid, expired, or missing tokens are properly rejected
3. Authentication state is preserved across different service calls
4. Authorization headers are correctly processed

### Running the Integration Tests

```bash
go test -v ./test/integration/auth_integration_test.go
```

## Adding New Tests

When adding new security tests:

1. Follow the existing patterns for test organization
2. Use the setup helpers to create consistent test environments
3. Cover both positive and negative test cases
4. Document the security aspects being tested
5. Ensure tests are independent and can run in any order

## Security Best Practices Verified

These tests verify adherence to security best practices:

- Strong, unique secret keys for JWT signing
- Short token lifetimes
- Proper validation of all token components
- Rejection of expired or malformed tokens
- Protection against common attack vectors