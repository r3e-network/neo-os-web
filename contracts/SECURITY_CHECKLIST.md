# Neo MiniApp Smart Contract Security Checklist

This checklist provides security guidelines for developing Neo N3 smart contracts in the MiniApp platform.

## 1. Access Control

### Admin Functions
- [ ] All admin-only functions use `ValidateAdmin()` at the entry point
- [ ] Admin address is properly initialized during deployment
- [ ] Admin can be changed only by the current admin
- [ ] Emergency pause functionality is implemented and testable

### Gateway Validation
- [ ] Business methods use `ValidateGateway()` to ensure only TEE-attested gateway can call them
- [ ] Gateway address is properly initialized
- [ ] Gateway can be changed only by admin

### User Authorization
- [ ] Users cannot directly call MiniApp contracts (enforced by gateway pattern)
- [ ] Any user-facing operations go through PaymentHub
- [ ] Role-based access control is properly implemented

## 2. Input Validation

### Address Validation
- [ ] All address parameters are validated with `ValidateAddress()`
- [ ] Null address checks are performed before storage operations
- [ ] Address validity is checked before cryptographic operations

### Value Validation
- [ ] All numeric inputs are validated for bounds (minimum/maximum)
- [ ] Overflow and underflow are prevented using `ExecutionEngine.Assert()`
- [ ] Negative values are rejected where inappropriate

### Data Size Validation
- [ ] Array lengths are validated before iteration
- [ ] String/data sizes are bounded
- [ ] Storage operations check for reasonable sizes

## 3. Storage Security

### Data Integrity
- [ ] Critical data uses appropriate storage prefixes to avoid collisions
- [ ] Storage layout is documented and consistent
- [ ] Storage access patterns prevent read/write conflicts

### Initialization
- [ ] All storage keys are initialized before use
- [ ] Null checks are performed on retrieved values
- [ ] Default values are properly handled

## 4. Economic Security

### Value Handling
- [ ] All token/asset transfers use safe transfer patterns
- [ ] Balance checks are performed before transfers
- [ ] Transfers are atomic (use require-before-transfer pattern)

### Fee Management
- [ ] Fees are clearly defined and validated
- [ ] Fee calculations cannot result in unexpected values
- [ ] Front-running is considered in fee mechanisms

### Bet/Lottery Security
- [ ] Bet limits are enforced (see `MiniAppBase.BetLimits.cs`)
- [ ] Random number generation uses `RandomnessLog`
- [ ] Bet resolution cannot be manipulated
- [ ] Payout calculations are verified

## 5. Common Vulnerability Prevention

### Reentrancy
- [ ] No external calls before state updates
- [ ] State changes happen before transfers
- [ ] Use Checks-Effects-Interactions pattern

### Access Control
- [ ] Missing authorization checks are identified
- [ ] Function modifiers are properly used
- [ ] Initialization functions are callable only once

### Integer Overflow/Underflow
- [ ] Use SafeMath or explicit overflow checks
- [ ] Verify all arithmetic operations
- [ ] Pay special attention to loop counters

### Front-Running
- [ ] Consider using commit-reveal schemes for sensitive operations
- [ ] Batch operations to reduce surface area
- [ ] Use timestamp carefully (can be manipulated by miners)

### Denial of Service
- [ ] Array operations have bounded gas costs
- [ ] Loops cannot be infinite
- [ ] External call failures are handled gracefully

## 6. Testing Requirements

### Unit Tests
- [ ] Each public method has test coverage
- [ ] Edge cases are tested (zero, max values, boundary conditions)
- [ ] Authorization checks are verified

### Integration Tests
- [ ] Gateway integration is tested
- [ ] PaymentHub integration is verified
- [ ] Multi-user scenarios are tested

### Security Tests
- [ ] Access control bypass attempts fail
- [ ] Invalid inputs are rejected
- [ ] Edge cases for arithmetic operations

## 7. Deployment Security

### Admin Responsibilities
- [ ] Admin keys are stored securely
- [ ] Multi-sig is considered for critical operations
- [ ] Upgrade process is documented

### Configuration
- [ ] All configuration values are validated
- [ ] Network-specific values are documented
- [ ] Emergency procedures are documented

## 8. Monitoring and Incident Response

### Logging
- [ ] Important events are logged
- [ ] Log data is sufficient for debugging
- [ ] Sensitive data is not logged

### Circuit Breakers
- [ ] Pause functionality is implemented
- [ ] Pause registry integration works
- [ ] Unpause procedure is tested

## 9. Code Quality

### Documentation
- [ ] All public methods have documentation
- [ ] Security assumptions are documented
- [ ] Storage layout is documented

### Code Style
- [ ] Consistent naming conventions
- [ ] Meaningful variable names
- [ ] Complex logic is broken into helper functions

## 10. Review Checklist

### Pre-deployment Review
- [ ] Security audit completed
- [ ] All checklist items verified
- [ ] Test coverage is adequate
- [ ] Documentation is complete

### Deployment Verification
- [ ] Contract hash verified
- [ ] Manifest permissions are minimal
- [ ] Admin address is correct

---

## Quick Reference: Security Functions

```csharp
// Access Control
ValidateAdmin()           // Verify admin signature
ValidateGateway()         // Verify TEE gateway call
ValidateAddress(UInt160) // Verify address is valid

// Pausing
IsPaused()               // Check pause status
ValidateNotPaused()      // Assert not paused

// Safe Operations
SafeMath.Add(a, b)       // Overflow-safe addition
SafeMath.Sub(a, b)       // Underflow-safe subtraction
```

## Related Documentation

- [MiniAppBase.Core.cs](../contracts/MiniAppBase/MiniAppBase.Core.cs)
- [MiniAppBase.BetLimits.cs](../contracts/MiniAppBase/MiniAppBase.BetLimits.cs)
- [Security Scanner](./security/vulnerability-scanner.ts)
