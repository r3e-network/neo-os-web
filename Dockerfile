# Stage 1: Build the application
FROM golang:1.22-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go.mod and go.sum first to leverage Docker cache
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server ./cmd/server

# Stage 2: Create a minimal runtime image
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create a non-root user to run the application
RUN adduser -D -g '' appuser
USER appuser

# Set working directory
WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/server .

# Copy configuration files
COPY --from=builder /app/configs ./configs

# Create directories for migrations and logs
COPY --from=builder /app/internal/database/migrations ./internal/database/migrations
RUN mkdir -p logs

# Expose the port
EXPOSE 8080

# Set environment variables
ENV CONFIG_FILE=configs/config.yaml

# Run the application
CMD ["./server"]