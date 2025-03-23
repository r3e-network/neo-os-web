FROM golang:1.20-alpine AS builder

# Install required packages
RUN apk add --no-cache git build-base

# Set working directory
WORKDIR /app

# Copy go mod and sum files to download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build with version information
ARG VERSION=0.1.0
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown

# Build the application
RUN CGO_ENABLED=0 GOOS=linux \
    go build -ldflags="-w -s \
    -X github.com/R3E-Network/service_layer/internal/version.Version=${VERSION} \
    -X github.com/R3E-Network/service_layer/internal/version.GitCommit=${GIT_COMMIT} \
    -X github.com/R3E-Network/service_layer/internal/version.BuildTime=${BUILD_TIME}" \
    -o service_layer ./cmd/service

# Use a minimal alpine image for the final container
FROM alpine:3.16

# Install CA certificates and other dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1001 app && \
    adduser -u 1001 -G app -s /bin/sh -D app

# Create app directories
RUN mkdir -p /app/config /app/data /app/logs && \
    chown -R app:app /app

# Set working directory
WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/service_layer .

# Copy configuration files
COPY --from=builder /app/config/config.yaml ./config/

# Set environment variables
ENV CONFIG_FILE=/app/config/config.yaml
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Use non-root user
USER app

# Set the entrypoint
ENTRYPOINT ["/app/service_layer"]