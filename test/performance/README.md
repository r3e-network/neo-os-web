# Performance Testing

This directory contains performance tests for the Neo N3 Service Layer, including:

1. Go benchmark tests for function execution
2. Go benchmark tests for database operations
3. k6 load test scripts for API endpoints

## Prerequisites

- Go 1.20 or higher for Go benchmark tests
- [k6](https://k6.io/) for API load testing
- Running service_layer API server for API tests
- PostgreSQL database for database tests

## Running Performance Tests

You can run all performance tests using the provided script:

```bash
# Make the script executable
chmod +x ./scripts/performance/run_performance_tests.sh

# Run all performance tests
./scripts/performance/run_performance_tests.sh
```

This will:
1. Run Go benchmark tests
2. Run k6 load tests against the running API server
3. Generate an HTML report with the results

## Test Results

Test results are saved to the `./performance-reports/{timestamp}/` directory, including:
- `function_benchmark.txt`: Go benchmark test results
- `api_stress.txt`, `background_load.txt`, etc.: k6 load test results
- `performance_test.log`: Test execution log
- `performance_report.html`: HTML summary report

## Running Individual Tests

### Go Benchmark Tests

Run function execution benchmark tests:

```bash
go test -bench=BenchmarkFunction -run=^$ -benchmem ./test/performance/
```

Run database operation benchmark tests (requires database connection):

```bash
go test -bench=BenchmarkDatabase -run=^$ -benchmem ./test/performance/
```

### k6 Load Tests

Run API load tests with k6:

```bash
k6 run ./test/performance/api_load_test.js
```

Run specific test scenario:

```bash
k6 run ./test/performance/api_load_test.js --scenario api_stress
```

## Benchmark Test Descriptions

### Function Execution Benchmarks

- `BenchmarkFunctionExecution`: Tests function execution with different complexity levels
- `BenchmarkConcurrentFunctionExecutions`: Tests function execution with different concurrency levels
- `BenchmarkFunctionMemoryUsage`: Tests function execution with different memory allocation patterns
- `BenchmarkFunctionResilience`: Tests function execution with different failure rates

### Database Benchmarks

- `BenchmarkFunctionCRUD`: Tests CRUD operations for functions
- `BenchmarkTransactionCRUD`: Tests CRUD operations for transactions
- `BenchmarkComplexQueries`: Tests complex database queries
- `BenchmarkConcurrentOperations`: Tests database operations under concurrent load

### API Load Tests

- `Background Load`: Tests API performance under constant background load
- `API Stress`: Tests API performance under increasing load
- `Function Execution`: Tests function execution performance
- `Transaction Test`: Tests transaction management performance

## Interpreting Results

### Go Benchmark Results

Go benchmark results are presented in the following format:

```
BenchmarkFunctionExecution/Simple_Function-8         1000           1234567 ns/op           1234 B/op          12 allocs/op
```

- `1000`: Number of iterations
- `1234567 ns/op`: Average time per operation in nanoseconds
- `1234 B/op`: Average memory allocated per operation in bytes
- `12 allocs/op`: Average number of allocations per operation

### k6 Load Test Results

k6 results include:

- **http_req_duration**: HTTP request duration statistics
- **http_reqs**: Number of HTTP requests made
- **checks**: Results of check() assertions in the test
- **iterations**: Number of complete iterations executed

## Adding New Performance Tests

### Adding Go Benchmark Tests

1. Create a new benchmark function in an existing or new Go file in the `test/performance` directory
2. Follow the Go benchmark naming convention: `BenchmarkXxx`
3. Implement the benchmark using the `*testing.B` parameter
4. Add custom metrics using `b.ReportMetric()`

### Adding k6 Load Tests

1. Add new scenarios to the `api_load_test.js` file
2. Define functions that implement the test scenarios
3. Add the scenarios to the `options.scenarios` section
4. Implement any necessary helper functions

## Analyzing Performance Over Time

To analyze performance over time:

1. Run performance tests regularly (e.g., nightly builds)
2. Store test results with timestamps
3. Compare results between runs to detect regressions
4. Plot metrics over time to identify trends

## Performance Requirements

Refer to the [Performance Testing Plan](../../docs/performance_testing.md) for detailed performance requirements and targets.