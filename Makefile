# =============================================================================
# Neo Service Layer - Makefile
# NitroRun + AWS Nitro + Supabase + Vercel Architecture
# =============================================================================

.PHONY: all build test test-race clean docker frontend deploy help contracts-build test-contracts test-fairy test-fairy-full fairy-start fairy-stop export-miniapps export-supabase-functions check-git docker-smoke docker-smoke-nitro
.PHONY: export-supabase-migrations supabase-start supabase-stop supabase-status supabase-cli-install
.PHONY: edge-check edge-dev

# Variables
CMD_BINARIES := nitro create-wallet deploy-fairy deploy-testnet master-bundle verify-bundle
# Compose resolves relative .env files from the compose file directory (`docker/`).
# Prefer the repository root `.env` when present to keep runtime vars consistent.
DOCKER_COMPOSE_ENV_FILE ?= $(if $(wildcard .env),--env-file .env,)
DOCKER_COMPOSE_NITRO := docker compose $(DOCKER_COMPOSE_ENV_FILE) -f docker/docker-compose.simulation.yaml -f docker/docker-compose.nitro.yaml
# Default to Nitro mode for local development.
DOCKER_COMPOSE := $(DOCKER_COMPOSE_NITRO)

GOBIN ?= $(shell go env GOPATH)/bin
GOLANGCI_LINT_VERSION ?= v1.64.8
GOLANGCI_LINT ?= $(GOBIN)/golangci-lint

COORDINATOR_CLIENT_ADDR ?= localhost:4433
INSECURE ?= 1
NITRORUN_FLAGS :=
ifneq ($(filter 1 true yes,$(INSECURE)),)
  NITRORUN_FLAGS += --insecure
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

# =============================================================================
# Test
# =============================================================================

test: ## Run all tests
	@echo "Running tests..."
	NITRO_ENV=testing TEE_BACKEND=nitro go test -v ./...

test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	NITRO_ENV=testing TEE_BACKEND=nitro go test -v -short ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	NITRO_ENV=testing TEE_BACKEND=nitro go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	go test -v -tags=integration ./test/integration/...

test-e2e: ## Run end-to-end tests
	@echo "Running e2e tests..."
	go test -v -tags=e2e ./test/e2e/...

fairy-start: ## Start Neo Fairy (requires NEOROOT)
	@if [ -z "$$NEOROOT" ]; then \
		echo "NEOROOT is required (path to neo-node checkout)"; \
		exit 1; \
	fi
	NEOROOT="$$NEOROOT" ./test/fairy/start-fairy.sh

fairy-stop: ## Stop Neo Fairy
	./test/fairy/stop-fairy.sh

test-fairy: ## Run Neo Fairy connectivity/session tests
	@echo "Running Neo Fairy tests..."
	go test -count=1 -v ./test/fairy/...

test-fairy-full: ## Run full Neo Fairy tests (requires NEO_TESTNET_WIF)
	@if [ -z "$$NEO_TESTNET_WIF" ]; then \
		echo "NEO_TESTNET_WIF is required for full Fairy tests"; \
		exit 1; \
	fi
	@echo "Running full Neo Fairy tests..."
	NEO_TESTNET_WIF="$$NEO_TESTNET_WIF" go test -count=1 -v ./test/fairy/...

test-race: ## Run tests with race detector
	go test -race ./...

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

docker-up: ## Start all services in Nitro mode
	./scripts/up_nitro.sh

docker-smoke: ## Smoke-check Nitro stack health end-to-end
	./scripts/docker_smoke.sh

docker-smoke-nitro: ## Smoke-check Nitro stack health end-to-end
	./scripts/docker_smoke.sh

docker-up-nitro: ## Start all services with Nitro backend
	./scripts/up_nitro.sh

docker-up-tee: docker-up-nitro ## Alias for docker-up-nitro

docker-down: ## Stop all services
	$(DOCKER_COMPOSE) down

docker-logs: ## View logs
	$(DOCKER_COMPOSE) logs -f

docker-ps: ## List running containers
	$(DOCKER_COMPOSE) ps

docker-clean: ## Remove all containers and volumes
	$(DOCKER_COMPOSE) down -v --rmi local

# =============================================================================
# NitroRun
# =============================================================================

nitrorun-install: ## Install NitroRun-compatible CLI (x86_64 only)
	@arch="$$(uname -m)"; \
	case "$$arch" in \
	  x86_64|amd64) asset_url="https://github.com/edgelesssys/marblerun/releases/latest/download/marblerun-x86_64.AppImage" ;; \
	  *) echo "Automatic NitroRun-compatible install is only supported on x86_64 hosts (detected: $$arch)."; exit 1 ;; \
	esac; \
	curl -fsSL "$$asset_url" -o /tmp/nitrorun && sudo install -m 0755 /tmp/nitrorun /usr/local/bin/nitrorun && rm -f /tmp/nitrorun

nitrorun-manifest: ## Set NitroRun manifest
	nitrorun manifest set manifests/manifest.json $(COORDINATOR_CLIENT_ADDR) $(NITRORUN_FLAGS)

nitrorun-status: ## Check NitroRun status
	nitrorun status $(COORDINATOR_CLIENT_ADDR) $(NITRORUN_FLAGS)

nitrorun-recover: ## Recover NitroRun coordinator
	nitrorun recover manifests/recovery-key.json $(COORDINATOR_CLIENT_ADDR) $(NITRORUN_FLAGS)

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
	@echo "Deploying to staging (Kubernetes staging overlay)..."
	@./scripts/deploy_k8s.sh --env staging

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
	@echo "NitroRun + AWS Nitro + Supabase + Vercel"

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
