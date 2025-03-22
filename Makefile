.PHONY: build run test clean lint migrate-up migrate-down docker-build docker-run docker-compose help security-test security-gosec security-deps security-secrets security-api-scan performance-test performance-benchmark performance-load performance-system

# Default target
all: help

# Build the application
build:
	@echo "Building service_layer..."
	@go build -o ./bin/server ./cmd/server

# Run the application
run:
	@echo "Running service_layer..."
	@go run ./cmd/server/main.go

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf ./bin

# Run linter
lint:
	@echo "Running linter..."
	@golangci-lint run

# Run database migrations up
migrate-up:
	@echo "Running database migrations up..."
	@migrate -path internal/database/migrations -database "$(shell grep DB_CONNECTION_STRING .env | cut -d '=' -f2)" up

# Run database migrations down
migrate-down:
	@echo "Running database migrations down..."
	@migrate -path internal/database/migrations -database "$(shell grep DB_CONNECTION_STRING .env | cut -d '=' -f2)" down

# Build Docker image
docker-build:
	@echo "Building Docker image..."
	@docker build -t service_layer:latest .

# Run in Docker
docker-run:
	@echo "Running in Docker..."
	@docker run -p 8080:8080 --env-file .env service_layer:latest

# Run with Docker Compose
docker-compose:
	@echo "Running with Docker Compose..."
	@docker-compose up -d

# Generate API documentation with Swag
swagger:
	@echo "Generating API documentation..."
	@swag init -g internal/api/server.go -o docs/swagger

# Run the development environment
dev: migrate-up run

# Security testing commands
security-test:
	@echo "Running all security tests..."
	@mkdir -p ./security-reports
	@scripts/security/run_all_security_tests.sh

security-gosec:
	@echo "Running Gosec security scanner..."
	@mkdir -p ./security-reports
	@scripts/security/run_gosec.sh

security-deps:
	@echo "Scanning dependencies for vulnerabilities..."
	@mkdir -p ./security-reports
	@scripts/security/scan_dependencies.sh

security-secrets:
	@echo "Detecting secrets and credentials in codebase..."
	@mkdir -p ./security-reports
	@scripts/security/detect_secrets.sh

security-api-scan:
	@echo "Running API security scan with OWASP ZAP..."
	@mkdir -p ./security-reports
	@scripts/security/run_zap_scan.sh

# Performance testing commands
performance-test:
	@echo "Running all performance tests..."
	@mkdir -p ./performance-reports
	@chmod +x scripts/performance/run_performance_tests.sh
	@scripts/performance/run_performance_tests.sh

performance-benchmark:
	@echo "Running Go benchmark tests..."
	@mkdir -p ./performance-reports
	@go test -bench=BenchmarkFunction -run=^$ -benchmem -benchtime=5s ./test/performance/

performance-load:
	@echo "Running k6 load tests..."
	@mkdir -p ./performance-reports
	@if command -v k6 &> /dev/null; then \
		k6 run ./test/performance/api_load_test.js; \
	else \
		echo "k6 is not installed. Please install k6 to run load tests."; \
	fi

performance-system:
	@echo "Running full system performance test..."
	@mkdir -p ./performance-reports
	@chmod +x scripts/performance/run_full_system_test.sh
	@scripts/performance/run_full_system_test.sh

# Help command
help:
	@echo "service_layer make commands:"
	@echo "  build          - Build the application"
	@echo "  run            - Run the application"
	@echo "  test           - Run tests"
	@echo "  clean          - Clean build artifacts"
	@echo "  lint           - Run linter"
	@echo "  migrate-up     - Run database migrations up"
	@echo "  migrate-down   - Run database migrations down"
	@echo "  docker-build   - Build Docker image"
	@echo "  docker-run     - Run in Docker"
	@echo "  docker-compose - Run with Docker Compose"
	@echo "  swagger        - Generate API documentation"
	@echo "  dev            - Run development environment"
	@echo "  security-test  - Run all security tests"
	@echo "  security-gosec - Run Gosec security scanner"
	@echo "  security-deps  - Scan dependencies for vulnerabilities"
	@echo "  security-secrets - Detect secrets in codebase"
	@echo "  security-api-scan - Run API security scan"
	@echo "  performance-test - Run all performance tests"
	@echo "  performance-benchmark - Run Go benchmark tests"
	@echo "  performance-load - Run k6 load tests"
	@echo "  performance-system - Run full system performance test"