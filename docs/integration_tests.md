# Neo N3 Service Layer Integration Tests

## Overview

This document outlines the integration testing strategy for the Neo N3 Service Layer. While unit tests verify the functionality of individual components in isolation, integration tests ensure that different services work together correctly as a cohesive system. These tests focus on the boundaries between services and verify that data flows correctly across these boundaries.

## Integration Test Strategy

Our integration testing strategy follows these principles:

1. **Focus on Service Boundaries**: Test the interactions between services rather than internal implementations.
2. **End-to-End Flows**: Test complete workflows that span multiple services.
3. **Mock External Dependencies**: Use mock implementations for external services (blockchain, TEE) but test real service-to-service interactions.
4. **Test Database Integration**: Use a dedicated test database to verify persistence works correctly across services.
5. **Test Error Propagation**: Ensure errors are correctly propagated and handled between services.

## Key Integration Points

### Functions ↔ Secrets Service Integration

The Functions service needs to access secrets during function execution. Tests should verify:

1. **Secret Access During Execution**:
   - Functions can access authorized secrets during execution
   - Functions cannot access unauthorized secrets
   - Secret access is correctly audited

2. **Secret Rotation Impact**:
   - Functions continue to work when secrets are rotated
   - Functions fail gracefully when secrets are deleted

### Functions ↔ Automation Integration

The Automation service triggers function execution. Tests should verify:

1. **Trigger Execution**:
   - Cron-based triggers correctly execute functions at scheduled times
   - Price-based triggers execute functions when price conditions are met
   - Blockchain event triggers execute functions when relevant events occur

2. **Trigger Execution History**:
   - Execution results are correctly recorded in trigger history
   - Failed executions are properly handled and recorded

### Automation ↔ Price Feed Integration

The Automation service uses price data from the Price Feed service. Tests should verify:

1. **Price Condition Evaluation**:
   - Correct evaluation of price conditions (above, below, etc.)
   - Correct handling of price data availability and staleness
   - Proper triggering when price thresholds are crossed

### Functions ↔ Oracle Integration

Functions may request data through the Oracle service. Tests should verify:

1. **Data Request Flow**:
   - Functions can request external data through oracles
   - Data responses are correctly delivered to functions
   - Error handling for failed data requests

### Price Feed ↔ Blockchain Integration

The Price Feed service updates prices on the blockchain. Tests should verify:

1. **On-Chain Updates**:
   - Price updates are correctly propagated to on-chain contracts
   - Update optimizations like deviation-based updates work correctly
   - Error handling for failed blockchain transactions

### Random Number ↔ Blockchain Integration

The Random Number service provides verifiable random numbers on-chain. Tests should verify:

1. **Random Number Generation Flow**:
   - Random number requests are correctly processed
   - On-chain verification works correctly
   - Commit-reveal scheme functions as expected

### Gas Bank ↔ Transaction Management Integration

The Gas Bank service funds transactions managed by the Transaction Management System. Tests should verify:

1. **Transaction Funding**:
   - Gas Bank correctly funds transactions
   - Gas usage is properly tracked and billed
   - Insufficient gas balance handling

### Authentication ↔ All Services Integration

Authentication is used across all services. Tests should verify:

1. **Authentication Flow**:
   - Authentication tokens are correctly validated by all services
   - Authorization rules are properly enforced
   - Token expiration and refresh work correctly

## End-to-End Test Scenarios

### 1. Automated Oracle Data Function

**Scenario**: A function is triggered on a schedule, retrieves data through an oracle, and updates data on the blockchain.

**Services Involved**: Authentication, Functions, Automation, Oracle, Transaction Management, Gas Bank

**Test Steps**:
1. Set up a scheduled trigger in the Automation service
2. Create a function that requests data through the Oracle service
3. Configure the function to update data on the blockchain
4. Verify the trigger executes at the scheduled time
5. Verify the function successfully retrieves data through the Oracle
6. Verify the blockchain update is correctly processed and confirmed
7. Check proper gas deduction from the Gas Bank

### 2. Price-Triggered Contract Interaction

**Scenario**: A function is triggered when a price threshold is reached, executes logic based on the price, and interacts with a smart contract.

**Services Involved**: Authentication, Automation, Price Feed, Functions, Transaction Management, Gas Bank

**Test Steps**:
1. Set up a price-based trigger in the Automation service
2. Create a function that interacts with a smart contract
3. Simulate a price change that crosses the threshold
4. Verify the trigger executes the function
5. Verify the function correctly processes the price data
6. Verify the smart contract interaction is processed successfully
7. Check proper gas deduction from the Gas Bank

### 3. Secure Data Processing with Secrets

**Scenario**: A function uses secrets to access an external API, processes the data, and stores results using TEE.

**Services Involved**: Authentication, Functions, Secrets, TEE, Oracle

**Test Steps**:
1. Store API credentials as secrets
2. Create a function that accesses these secrets
3. Configure the function to call an external API
4. Verify the function can access and use the secrets
5. Verify the data processing in the TEE environment
6. Check that the results are correctly stored and protected

### 4. Random Number Generation and Verification

**Scenario**: A smart contract requests a random number, which is generated and verified on-chain.

**Services Involved**: Authentication, Random Number, Blockchain, Transaction Management, Gas Bank

**Test Steps**:
1. Submit a random number request
2. Verify the request is processed by the Random Number service
3. Check the commit transaction is submitted to the blockchain
4. Verify the reveal transaction is submitted after appropriate delay
5. Confirm the random number can be verified on-chain
6. Check proper gas deduction from the Gas Bank

### 5. Cross-Service Error Handling

**Scenario**: Test error propagation and handling across multiple services.

**Services Involved**: All services

**Test Steps**:
1. Trigger scenarios that cause errors in one service
2. Verify that errors are properly propagated to dependent services
3. Check that error handling mechanisms work correctly
4. Verify that error states are correctly recorded in the database
5. Test recovery mechanisms when services return to normal operation

## Test Environment Setup

1. **Dedicated Test Database**: All integration tests should use a dedicated test database that can be reset between test runs.
2. **Mock Blockchain**: Use a mock blockchain implementation to avoid dependency on external networks.
3. **Mock TEE Environment**: Use a simulated TEE environment for testing.
4. **Service Containers**: Run each service in its own container for proper isolation.
5. **Monitoring and Logging**: Enable detailed logging to help debug integration issues.

## Test Data Management

1. **Test Fixtures**: Create predefined test data that can be loaded into the database.
2. **Database Reset**: Ensure the database can be reset to a known state between test runs.
3. **Data Isolation**: Each test should use isolated data to avoid interference.

## Test Execution

1. **CI/CD Integration**: Integration tests should be run automatically as part of the CI/CD pipeline.
2. **Test Reporting**: Generate detailed reports showing pass/fail status and any errors.
3. **Test Retries**: Implement automatic retries for tests that fail due to timing issues.

## Next Steps

1. Implement the infrastructure for integration testing, including:
   - Test database setup and reset mechanisms
   - Mock blockchain and TEE implementations
   - Test data fixtures

2. Implement the end-to-end test scenarios in order of priority:
   - Automated Oracle Data Function
   - Price-Triggered Contract Interaction
   - Secure Data Processing with Secrets
   - Random Number Generation and Verification
   - Cross-Service Error Handling

3. Integrate tests into the CI/CD pipeline for automated testing. 