# =============================================================================
# Yiwu MiniApps - Makefile
# Frontend/admin apps + contracts + deployment helpers
# =============================================================================

.PHONY: all build test test-race clean docker frontend deploy help contracts-build test-contracts test-fairy test-fairy-full export-miniapps export-supabase-functions check-git docker-smoke docker-smoke-nitro test-testnet-direct
.PHONY: export-supabase-migrations supabase-start supabase-stop supabase-status supabase-cli-install
.PHONY: edge-check edge-dev

# Variables
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

build: ## Build current shipped applications
	@echo "Building host app and admin console..."
	npm --prefix platform/host-app run build
	npm --prefix platform/admin-console run build
	@echo "Build complete"

# =============================================================================
# Test
# =============================================================================

test: ## Run current workspace tests (host app + admin console)
	@echo "Running current workspace tests..."
	npm test

test-unit: ## Run current workspace tests only
	@echo "Running current workspace unit tests..."
	npm test

test-coverage: ## Run current JS/TS test coverage where available
	@echo "Running frontend coverage suites..."
	npm --prefix platform/host-app run test:coverage
	npm --prefix platform/admin-console run test:coverage

test-integration: ## Legacy Go service layer tests were moved to external repos
	@echo "Legacy Go service layer moved to external repos; integration tests no longer run from this repo."

test-e2e: ## Legacy Go service layer tests were moved to external repos
	@echo "Legacy Go service layer moved to external repos; e2e Go tests no longer run from this repo."

test-testnet-direct: ## Run the preferred cross-repo direct Oracle / direct AA testnet validation
	@echo "Running direct Oracle / direct AA cross-repo validation..."
	bash ./deploy/scripts/verify_cross_repo_testnet.sh

test-fairy: ## Legacy Go/Fairy tests were moved out with the service layer
	@echo "Legacy Go/Fairy tests moved to the extracted service-layer repos."

test-fairy-full: ## Legacy Go/Fairy tests were moved out with the service layer
	@echo "Legacy Go/Fairy tests moved to the extracted service-layer repos."

test-race: ## Root Go race suite removed with extracted service layer
	@echo "Go race tests moved with the extracted service-layer repos."

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
	./deploy/scripts/up_nitro.sh

docker-smoke: ## Smoke-check Nitro stack health end-to-end
	./deploy/scripts/docker_smoke.sh

docker-smoke-nitro: ## Smoke-check Nitro stack health end-to-end
	./deploy/scripts/docker_smoke.sh

docker-up-nitro: ## Start all services with Nitro backend
	./deploy/scripts/up_nitro.sh

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

nitrorun-install: ## Install optional NitroRun-compatible CLI (arm64 uses local mesh)
	@arch="$$(uname -m)"; \
	if command -v nitrorun >/dev/null 2>&1; then \
	  echo "nitrorun already installed"; \
	elif [ "$$arch" = "x86_64" ] || [ "$$arch" = "amd64" ]; then \
	  asset_url="https://github.com/edgelesssys/marblerun/releases/latest/download/marblerun-x86_64.AppImage"; \
	  curl -fsSL "$$asset_url" -o /tmp/nitrorun && sudo install -m 0755 /tmp/nitrorun /usr/local/bin/nitrorun && rm -f /tmp/nitrorun; \
	else \
	  echo "NitroRun-compatible CLI is unavailable on $$arch."; \
	  echo "Use the Kubernetes-native local mesh instead (for example: make dev-stack-up)."; \
	fi

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

export-miniapps: ## Build and stage standalone MiniApp dApps for host / OneGate loading
	npm run -s export:miniapp-dapps

export-supabase-functions: ## Export Edge functions into supabase/functions/
	./deploy/scripts/export_supabase_functions.sh

export-supabase-migrations: ## Export SQL migrations into supabase/migrations/
	./deploy/scripts/export_supabase_migrations.sh

supabase-start: ## Start Supabase locally (dockerized CLI)
	$(MAKE) export-supabase-functions
	$(MAKE) export-supabase-migrations
	./deploy/scripts/supabase.sh start

supabase-stop: ## Stop local Supabase (dockerized CLI)
	./deploy/scripts/supabase.sh stop || true

supabase-status: ## Show local Supabase status (dockerized CLI)
	./deploy/scripts/supabase.sh status

supabase-cli-install: ## Install Supabase CLI into ./bin/supabase
	@chmod +x ./deploy/scripts/install_supabase_cli.sh
	./deploy/scripts/install_supabase_cli.sh

check-git: ## Report untracked canonical source/exports
	./deploy/scripts/git_completeness_check.sh

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
	@./deploy/scripts/k3s-local-setup.sh install

dev-stack-down: ## Tear down local k3s dev stack
	@echo "Tearing down local k3s dev stack..."
	@./deploy/scripts/k3s-local-setup.sh cleanup

dev-stack-status: ## Check status of all dev stack components
	@./deploy/scripts/k3s-local-setup.sh status

dev-stack-bootstrap: ## Bootstrap full k3s dev stack (Supabase + services + Edge)
	@./deploy/scripts/bootstrap_k3s_dev.sh

# =============================================================================
# Development
# =============================================================================

dev: ## Start development environment
	@echo "Starting development environment..."
	@./deploy/scripts/install_dev_env.sh --skip-k8s || echo "Dependencies already installed"
	@$(MAKE) docker-up

dev-full: ## Start full development environment with all services
	@echo "Starting full development environment..."
	@./deploy/scripts/deploy_k8s.sh --env dev

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
	@./deploy/scripts/deploy_k8s.sh --env staging

deploy-production: ## Deploy to production
	@echo "Deploying to production (Kubernetes prod overlay)..."
	@./deploy/scripts/deploy_k8s.sh --env prod

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
	@./deploy/scripts/install_dev_env.sh --all
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
