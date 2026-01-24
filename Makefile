# =============================================================================
# Neo Service Layer - Makefile
# MarbleRun + EGo + Supabase + Vercel Architecture
# =============================================================================

.PHONY: all build test clean docker frontend deploy help contracts-build test-contracts export-miniapps export-supabase-functions check-git
.PHONY: export-supabase-migrations supabase-start supabase-stop supabase-status supabase-cli-install
.PHONY: edge-check edge-dev
.PHONY: miniapps-build miniapps-dev miniapps-test miniapps-clean
.PHONY: sdk-build sdk-typecheck
.PHONY: run stop install install-all test-all clean-all-deep
.PHONY: host-app-dev host-app-build host-app-test host-app-clean

# Variables
CMD_BINARIES := marble create-wallet deploy-fairy deploy-testnet master-bundle verify-bundle
ENCLAVE_BINARIES := marble
DOCKER_COMPOSE_SIM := docker compose -f docker/docker-compose.simulation.yaml
DOCKER_COMPOSE_SGX := docker compose -f docker/docker-compose.yaml
# Default to simulation mode for local development.
DOCKER_COMPOSE := $(DOCKER_COMPOSE_SIM)

GOBIN ?= $(shell go env GOPATH)/bin
GOLANGCI_LINT_VERSION ?= v1.64.8
GOLANGCI_LINT ?= $(GOBIN)/golangci-lint

COORDINATOR_CLIENT_ADDR ?= localhost:4433
INSECURE ?= 1
MARBLERUN_FLAGS :=
ifneq ($(filter 1 true yes,$(INSECURE)),)
  MARBLERUN_FLAGS += --insecure
endif

# =============================================================================
# Build
# =============================================================================

all: build

build: ## Build all services
	@echo "Building all services..."
	@for bin in $(CMD_BINARIES); do \
		echo "Building $$bin..."; \
		go build -o bin/$$bin ./cmd/$$bin; \
	done
	@echo "Build complete"

build-ego: ## Build with EGo for SGX
	@echo "Building with EGo..."
	@for bin in $(ENCLAVE_BINARIES); do \
		echo "Building $$bin with EGo..."; \
		ego-go build -o bin/$$bin ./cmd/$$bin; \
	done

sign-enclaves: ## Sign all enclave binaries
	@echo "Signing enclaves..."
	@for bin in $(ENCLAVE_BINARIES); do \
		if [ -f bin/$$bin ]; then \
			ego sign bin/$$bin; \
		fi; \
	done

# =============================================================================
# Test
# =============================================================================

test: ## Run all tests
	@echo "Running tests..."
	go test -v ./...

test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	go test -v -short ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	go test -v -tags=integration ./test/integration/...

test-e2e: ## Run end-to-end tests
	@echo "Running e2e tests..."
	go test -v -tags=e2e ./test/e2e/...

test-watch: ## Run tests in watch mode
	@echo "Running tests in watch mode..."
	@which gotestsum > /dev/null || go install gotest.tools/gotestsum@latest
	gotestsum --watch

# =============================================================================
# Contracts (Neo N3)
# =============================================================================

contracts-build: ## Build Neo N3 contracts (nccs)
	@echo "Building Neo N3 contracts..."
	@./contracts/build.sh

test-contracts: contracts-build ## Run neo-express contract tests (builds contracts first)
	@echo "Running neo-express contract tests..."
	go test -v ./test/contract -count=1

# =============================================================================
# Docker
# =============================================================================

docker-build: ## Build all Docker images
	$(DOCKER_COMPOSE) build

docker-up: ## Start all services in simulation mode
	./scripts/up.sh --insecure

docker-up-sgx: ## Start all services with SGX hardware
	./scripts/up.sh

docker-up-tee: docker-up-sgx ## Alias for docker-up-sgx

docker-down: ## Stop all services
	$(DOCKER_COMPOSE) down

docker-logs: ## View logs
	$(DOCKER_COMPOSE) logs -f

docker-ps: ## List running containers
	$(DOCKER_COMPOSE) ps

docker-clean: ## Remove all containers and volumes
	$(DOCKER_COMPOSE) down -v --rmi local

# =============================================================================
# MarbleRun
# =============================================================================

marblerun-install: ## Install MarbleRun CLI
	curl -fsSL https://github.com/edgelesssys/marblerun/releases/latest/download/marblerun-linux-amd64 -o /usr/local/bin/marblerun
	chmod +x /usr/local/bin/marblerun

marblerun-manifest: ## Set MarbleRun manifest
	marblerun manifest set manifests/manifest.json $(COORDINATOR_CLIENT_ADDR) $(MARBLERUN_FLAGS)

marblerun-status: ## Check MarbleRun status
	marblerun status $(COORDINATOR_CLIENT_ADDR) $(MARBLERUN_FLAGS)

marblerun-recover: ## Recover MarbleRun coordinator
	marblerun recover manifests/recovery-key.json $(COORDINATOR_CLIENT_ADDR) $(MARBLERUN_FLAGS)

# =============================================================================
# Database
# =============================================================================

db-migrate: ## Run database migrations
	@echo "Running migrations..."
	@for f in migrations/[0-9][0-9][0-9]_*.sql; do \
		echo "Applying $$f"; \
		psql "$(DATABASE_URL)" -f "$$f"; \
	done

db-seed: ## Seed database with test data
	@echo "No db seed script is shipped (use Supabase SQL editor or manual inserts)."

# =============================================================================
# Frontend
# =============================================================================

export-miniapps: ## Export built-in MiniApps into host public/
	./scripts/export_host_miniapps.sh

export-supabase-functions: ## Export Edge functions into supabase/functions/
	./scripts/export_supabase_functions.sh

export-supabase-migrations: ## Export SQL migrations into supabase/migrations/
	./scripts/export_supabase_migrations.sh

supabase-start: ## Start Supabase locally (dockerized CLI)
	$(MAKE) export-supabase-functions
	$(MAKE) export-supabase-migrations
	./scripts/supabase.sh start

supabase-stop: ## Stop local Supabase (dockerized CLI)
	./scripts/supabase.sh stop || true

supabase-status: ## Show local Supabase status (dockerized CLI)
	./scripts/supabase.sh status

supabase-cli-install: ## Install Supabase CLI into ./bin/supabase
	@chmod +x ./scripts/install_supabase_cli.sh
	./scripts/install_supabase_cli.sh

check-git: ## Report untracked canonical source/exports
	./scripts/git_completeness_check.sh

frontend-install: ## Install frontend dependencies
	cd platform/host-app && npm install

frontend-dev: ## Start frontend development server
	cd platform/host-app && npm run dev

frontend-build: ## Build frontend for production
	cd platform/host-app && npm run build

frontend-deploy: ## Deploy frontend to Vercel
	cd platform/host-app && npm ci && npm run build
	vercel deploy --prod

# =============================================================================
# Supabase Edge (Deno)
# =============================================================================

edge-check: ## Typecheck Edge functions (requires deno)
	cd platform/edge && deno task check

edge-dev: ## Run local Edge dev server (requires deno)
	cd platform/edge && deno task dev

# =============================================================================
# MiniApps (uni-app)
# =============================================================================

miniapps-build: ## Build all MiniApps
	@echo "MiniApps now live in git@github.com:r3e-network/miniapps.git"
	@echo "Run builds from the miniapps repo."

miniapps-dev: ## Start MiniApps development server
	@echo "MiniApps now live in git@github.com:r3e-network/miniapps.git"
	@echo "Run dev server from the miniapps repo."

miniapps-test: ## Run MiniApps tests
	@echo "MiniApps now live in git@github.com:r3e-network/miniapps.git"
	@echo "Run tests from the miniapps repo."

miniapps-test-watch: ## Run MiniApps tests in watch mode
	@echo "MiniApps now live in git@github.com:r3e-network/miniapps.git"
	@echo "Run tests from the miniapps repo."

miniapps-test-coverage: ## Run MiniApps tests with coverage
	@echo "MiniApps now live in git@github.com:r3e-network/miniapps.git"
	@echo "Run tests from the miniapps repo."

miniapps-clean: ## Clean MiniApps build artifacts
	@echo "MiniApps now live in git@github.com:r3e-network/miniapps.git"
	@echo "Clean artifacts from the miniapps repo."

miniapps-generate: ## Generate MiniApp templates
	@echo "MiniApps now live in git@github.com:r3e-network/miniapps.git"
	@echo "Generate templates from the miniapps repo."

# =============================================================================
# Platform SDK
# =============================================================================

sdk-build: ## Build Platform SDK
	@echo "Building Platform SDK..."
	cd platform/sdk && npm run build

sdk-typecheck: ## Typecheck Platform SDK
	cd platform/sdk && npm run typecheck

# =============================================================================
# Host App (Next.js)
# =============================================================================

host-app-dev: frontend-dev ## Alias for frontend-dev

host-app-build: frontend-build ## Alias for frontend-build

host-app-test: ## Run Host App tests
	@echo "Running Host App tests..."
	cd platform/host-app && npm run test

host-app-test-watch: ## Run Host App tests in watch mode
	cd platform/host-app && npm run test:watch

host-app-test-coverage: ## Run Host App tests with coverage
	cd platform/host-app && npm run test:coverage

host-app-clean: ## Clean Host App build artifacts
	rm -rf platform/host-app/.next
	rm -rf platform/host-app/node_modules/.cache

# =============================================================================
# Local Dev Stack (k3s)
# =============================================================================

dev-stack-up: ## Bring up entire local k3s dev stack
	@echo "Setting up local k3s dev stack..."
	@./scripts/k3s-local-setup.sh install

dev-stack-down: ## Tear down local k3s dev stack
	@echo "Tearing down local k3s dev stack..."
	@./scripts/k3s-local-setup.sh cleanup

dev-stack-status: ## Check status of all dev stack components
	@./scripts/k3s-local-setup.sh status

dev-stack-bootstrap: ## Bootstrap full k3s dev stack (Supabase + services + Edge)
	@./scripts/bootstrap_k3s_dev.sh

# =============================================================================
# Development
# =============================================================================

dev: ## Start development environment
	@echo "Starting development environment..."
	@./scripts/install_dev_env.sh --skip-k8s || echo "Dependencies already installed"
	@$(MAKE) docker-up

dev-full: ## Start full development environment with all services
	@echo "Starting full development environment..."
	@./scripts/deploy_k8s.sh --env dev

dev-stop: ## Stop development environment
	@echo "Stopping development environment..."
	$(DOCKER_COMPOSE) down

lint: ## Run linter
	@test -x $(GOLANGCI_LINT) || (echo "Installing golangci-lint..." && GOBIN=$(GOBIN) go install github.com/golangci/golangci-lint/cmd/golangci-lint@$(GOLANGCI_LINT_VERSION))
	$(GOLANGCI_LINT) run ./...

fmt: ## Format code
	go fmt ./...
	gofmt -s -w .

tidy: ## Tidy go modules
	go mod tidy

# =============================================================================
# Deployment
# =============================================================================

deploy-staging: ## Deploy to staging
	@echo "Deploying to staging (Kubernetes test overlay)..."
	@./scripts/deploy_k8s.sh --env test

deploy-production: ## Deploy to production
	@echo "Deploying to production (Kubernetes prod overlay)..."
	@./scripts/deploy_k8s.sh --env prod

# =============================================================================
# Utilities
# =============================================================================

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	rm -rf coverage.out coverage.html
	rm -rf platform/host-app/.next
	rm -rf tmp/
	@echo "Clean complete"

clean-all: ## Clean everything including Docker images
	@echo "Cleaning everything..."
	$(MAKE) clean
	$(DOCKER_COMPOSE) down -v --rmi local
	docker system prune -f
	@echo "Deep clean complete"

generate: ## Generate code
	go generate ./...

docs: ## Generate documentation
	godoc -http=:6060

version: ## Show version
	@echo "Neo Service Layer v1.0.0"
	@echo "MarbleRun + EGo + Supabase + Vercel"

install-tools: ## Install development tools
	@echo "Installing development tools..."
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install gotest.tools/gotestsum@latest
	go install github.com/swaggo/swag/cmd/swag@latest
	@echo "Tools installed"

setup: ## Setup development environment
	@echo "Setting up development environment..."
	@./scripts/install_dev_env.sh --all
	$(MAKE) install-tools
	@echo "Setup complete"

check: ## Run all checks (lint, test, build)
	@echo "Running all checks..."
	$(MAKE) lint
	$(MAKE) test
	$(MAKE) build
	@echo "All checks passed"

metrics: ## Show code metrics
	@echo "Code metrics:"
	@echo "Lines of code:"
	@find . -name '*.go' -not -path './vendor/*' | xargs wc -l | tail -1
	@echo ""
	@echo "Test coverage:"
	@go test -cover ./... | grep coverage || echo "Run 'make test-coverage' first"

# =============================================================================
# Help
# =============================================================================

help: ## Show this help
	@echo "Neo Service Layer - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# Unified Commands (Whole Project)
# =============================================================================

run: ## Run the full development stack (host-app + docker services)
	@echo "Starting full development stack..."
	@$(MAKE) docker-up &
	@sleep 3
	@$(MAKE) frontend-dev

stop: ## Stop all running services and processes
	@echo "Stopping all services..."
	@pkill -f "next dev" 2>/dev/null || true
	@pkill -f "next-server" 2>/dev/null || true
	@pkill -f "vitest" 2>/dev/null || true
	@pkill -f "esbuild" 2>/dev/null || true
	@$(DOCKER_COMPOSE) down 2>/dev/null || true
	@echo "All services stopped"

install: ## Install all dependencies
	@echo "Installing all dependencies..."
	@echo "→ Go modules..."
	go mod download
	@echo "→ Host App (npm)..."
	cd platform/host-app && npm install
	@echo "→ SDK (npm)..."
	cd platform/sdk && npm install
	@echo "All dependencies installed"

install-all: install ## Alias for install

test-all: ## Run all tests (Go + Host App + MiniApps)
	@echo "Running all tests..."
	@echo "→ Go tests..."
	go test -v ./...
	@echo "→ Host App tests..."
	cd platform/host-app && npm run test
	@echo "All tests complete"

build-all: ## Build all components
	@echo "Building all components..."
	@$(MAKE) build
	@$(MAKE) sdk-build
	@$(MAKE) frontend-build
	@$(MAKE) miniapps-build
	@echo "All components built"

clean-all-deep: ## Deep clean everything (build artifacts, node_modules, Docker)
	@echo "Deep cleaning everything..."
	@$(MAKE) clean
	@$(MAKE) miniapps-clean
	@$(MAKE) host-app-clean
	rm -rf platform/sdk/dist
	rm -rf node_modules
	rm -rf platform/host-app/node_modules
	rm -rf platform/sdk/node_modules
	$(DOCKER_COMPOSE) down -v --rmi local 2>/dev/null || true
	docker system prune -f 2>/dev/null || true
	@echo "Deep clean complete"

status: ## Show status of all services
	@echo "=== Service Status ==="
	@echo ""
	@echo "Docker containers:"
	@$(DOCKER_COMPOSE) ps 2>/dev/null || echo "  (Docker not running)"
	@echo ""
	@echo "Node processes:"
	@pgrep -af "next" 2>/dev/null | head -5 || echo "  (No Next.js processes)"
	@echo ""
	@echo "Go binaries:"
	@ls -la bin/ 2>/dev/null || echo "  (No binaries built)"
