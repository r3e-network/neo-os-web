.PHONY: build run test clean lint migrate-up migrate-down docker-build docker-run docker-compose help

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