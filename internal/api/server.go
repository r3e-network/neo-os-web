package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/willtech-services/service_layer/internal/api/gasbank"
	"github.com/willtech-services/service_layer/internal/api/oracle"
	"github.com/willtech-services/service_layer/internal/api/pricefeed"
	"github.com/willtech-services/service_layer/internal/api/random"
	"github.com/willtech-services/service_layer/internal/blockchain"
	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/internal/core/auth"
	"github.com/willtech-services/service_layer/internal/core/automation"
	"github.com/willtech-services/service_layer/internal/core/functions"
	"github.com/willtech-services/service_layer/internal/core/gasbank" 
	coreGasbank "github.com/willtech-services/service_layer/internal/core/gasbank"
	"github.com/willtech-services/service_layer/internal/core/oracle"
	coreOracle "github.com/willtech-services/service_layer/internal/core/oracle"
	corePricefeed "github.com/willtech-services/service_layer/internal/core/pricefeed"
	coreRandom "github.com/willtech-services/service_layer/internal/core/random"
	"github.com/willtech-services/service_layer/internal/core/secrets"
	"github.com/willtech-services/service_layer/internal/database"
	"github.com/willtech-services/service_layer/internal/database/repositories"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/internal/tee"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Server represents the HTTP server
type Server struct {
	router             *gin.Engine
	httpServer         *http.Server
	config             *config.Config
	logger             *logger.Logger
	db                 *database.Database
	teeManager         *tee.Manager
	blockchainClient   *blockchain.Client
	
	// Repositories
	userRepository     models.UserRepository
	functionRepository models.FunctionRepository
	executionRepository models.ExecutionRepository
	secretRepository   models.SecretRepository
	triggerRepository  models.TriggerRepository
	priceFeedRepository models.PriceFeedRepository
	randomRepository   models.RandomRepository
	oracleRepository   models.OracleRepository
	gasBankRepository  models.GasBankRepository
	transactionRepository database.TransactionRepository
	
	// Services
	authService        *auth.Service
	functionService    *functions.Service
	secretService      *secrets.Service
	automationService  *automation.Service
	priceFeedService   *corePricefeed.PriceFeedService
	randomService      *coreRandom.Service
	oracleService      *coreOracle.Service
	gasBankService     *coreGasbank.Service
	transactionService *blockchain.TransactionService
	walletStore        *blockchain.WalletStore

	// API handlers
	transactionHandlers *TransactionHandlers
	contractHandlers    *ContractHandlers
	eventHandlers       *EventHandlers
}

// NewServer creates a new HTTP server
func NewServer(cfg *config.Config, log *logger.Logger) (*Server, error) {
	// Set Gin mode
	if cfg.Server.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.New()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(corsMiddleware(cfg.Server.CORS))
	router.Use(loggerMiddleware(log))
	router.Use(prometheusMiddleware())

	// Create database connection
	db, err := database.New(&cfg.Database, log)
	if err != nil {
		return nil, err
	}

	// Create blockchain client
	blockchainClient, err := blockchain.NewClient(&cfg.Neo, log)
	if err != nil {
		log.Warnf("Failed to initialize blockchain client: %v", err)
		// Continue without blockchain client for now
	}

	// Create TEE manager
	teeManager, err := tee.New(&cfg.TEE, log)
	if err != nil {
		log.Warnf("Failed to initialize TEE manager: %v", err)
		// Continue without TEE manager for now
	}

	// Create repositories
	userRepository := repositories.NewUserRepository(db.DB())
	functionRepository := repositories.NewFunctionRepository(db.DB())
	executionRepository := repositories.NewExecutionRepository(db.DB())
	secretRepository := repositories.NewSecretRepository(db.DB())
	triggerRepository := repositories.NewTriggerRepository(db.DB())
	priceFeedRepository := database.NewPriceFeedRepository(db.DB())
	randomRepository := repositories.NewRandomRepository(db.DB())
	oracleRepository := repositories.NewOracleRepository(db.DB())
	gasBankRepository := repositories.NewGasBankRepository(db.DB())

	// Create transaction repository
	transactionRepository := database.NewSQLTransactionRepository(db.DB())

	// Create wallet store and transaction service
	walletStore := blockchain.NewWalletStore(cfg, log, db.DB())
	transactionService := blockchain.NewTransactionService(
		transactionRepository,
		blockchainClient,
		walletStore,
		cfg.Neo.Confirmations,
	)

	// Create Gas Bank service
	gasBankService := coreGasbank.NewService(cfg, log, gasBankRepository, blockchainClient)

	// Create services
	authService := auth.NewService(cfg, log, userRepository)
	functionService := functions.NewService(cfg, log, functionRepository, executionRepository, teeManager)
	secretService := secrets.NewService(cfg, log, secretRepository, teeManager)
	automationService := automation.NewService(cfg, log, triggerRepository, functionService, blockchainClient)
	priceFeedService := corePricefeed.NewService(
		cfg,
		log,
		priceFeedRepository,
		blockchainClient,
		gasBankService, // Now we can use the Gas Bank service
		teeManager,
	)
	randomService := coreRandom.NewService(
		cfg,
		log,
		randomRepository,
		blockchainClient,
		teeManager,
	)
	oracleService := coreOracle.NewService(
		cfg,
		log,
		oracleRepository,
		blockchainClient,
		gasBankService,
		teeManager,
	)

	// Create API handlers
	transactionHandlers := NewTransactionHandlers(transactionService)
	contractHandlers := NewContractHandlers(blockchainClient, walletStore, log)
	eventHandlers := NewEventHandlers(blockchainClient, log)

	// Create server
	server := &Server{
		router:             router,
		config:             cfg,
		logger:             log,
		db:                 db,
		teeManager:         teeManager,
		blockchainClient:   blockchainClient,
		userRepository:     userRepository,
		functionRepository: functionRepository,
		executionRepository: executionRepository,
		secretRepository:   secretRepository,
		triggerRepository:  triggerRepository,
		priceFeedRepository: priceFeedRepository,
		randomRepository:   randomRepository,
		oracleRepository:   oracleRepository,
		gasBankRepository:  gasBankRepository,
		transactionRepository: transactionRepository,
		authService:        authService,
		functionService:    functionService,
		secretService:      secretService,
		automationService:  automationService,
		priceFeedService:   priceFeedService,
		randomService:      randomService,
		oracleService:      oracleService,
		gasBankService:     gasBankService,
		transactionService: transactionService,
		walletStore:        walletStore,
		transactionHandlers: transactionHandlers,
		contractHandlers:    contractHandlers,
		eventHandlers:       eventHandlers,
	}

	// Register routes
	server.registerRoutes()

	// Start automation service if enabled
	if cfg.Features.Automation {
		if err := automationService.Start(); err != nil {
			log.Errorf("Failed to start automation service: %v", err)
		}
	}

	// Start price feed service if enabled
	if cfg.Features.PriceFeed {
		if err := priceFeedService.Start(); err != nil {
			log.Errorf("Failed to start price feed service: %v", err)
		}
	}

	// Start oracle service if enabled
	if cfg.Features.Oracle {
		if err := oracleService.Start(); err != nil {
			log.Errorf("Failed to start oracle service: %v", err)
		}
	}

	return server, nil
}

// Start starts the HTTP server
func (s *Server) Start(address string) error {
	s.httpServer = &http.Server{
		Addr:         address,
		Handler:      s.router,
		ReadTimeout:  time.Duration(s.config.Server.Timeout) * time.Second,
		WriteTimeout: time.Duration(s.config.Server.Timeout) * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully shuts down the HTTP server
func (s *Server) Shutdown(ctx context.Context) error {
	// Shut down HTTP server
	if s.httpServer != nil {
		if err := s.httpServer.Shutdown(ctx); err != nil {
			return err
		}
	}

	// Stop automation service if initialized
	if s.automationService != nil {
		s.automationService.Stop()
	}

	// Stop random service if initialized
	if s.randomService != nil {
		s.randomService.Stop()
	}

	// Close database connection
	if s.db != nil {
		if err := s.db.Close(); err != nil {
			s.logger.Errorf("Failed to close database connection: %v", err)
		}
	}

	// Close TEE manager
	if s.teeManager != nil {
		if err := s.teeManager.Close(); err != nil {
			s.logger.Errorf("Failed to close TEE manager: %v", err)
		}
	}

	// Close blockchain client
	if s.blockchainClient != nil {
		if err := s.blockchainClient.Close(); err != nil {
			s.logger.Errorf("Failed to close blockchain client: %v", err)
		}
	}

	return nil
}

// registerRoutes registers all API routes
func (s *Server) registerRoutes() {
	// API version group
	v1 := s.router.Group("/v1")

	// Health check
	s.router.GET("/health", s.healthHandler)

	// Metrics
	if s.config.Monitoring.Prometheus.Enabled {
		s.router.GET("/metrics", gin.WrapH(promhttp.Handler()))
	}

	// Auth routes
	authRoutes := v1.Group("/auth")
	{
		authRoutes.POST("/login", s.loginHandler)
		authRoutes.POST("/register", s.registerHandler)
		authRoutes.POST("/refresh", s.refreshTokenHandler)
	}

	// Protected routes
	// Apply authentication middleware
	protected := v1.Group("/")
	protected.Use(s.authMiddleware())

	// Function routes
	if s.config.Features.Functions {
		functionRoutes := protected.Group("/functions")
		{
			functionRoutes.GET("", s.listFunctionsHandler)
			functionRoutes.GET("/:id", s.getFunctionHandler)
			functionRoutes.POST("", s.createFunctionHandler)
			functionRoutes.PUT("/:id", s.updateFunctionHandler)
			functionRoutes.DELETE("/:id", s.deleteFunctionHandler)
			functionRoutes.POST("/:id/execute", s.executeFunctionHandler)
			functionRoutes.GET("/:id/logs", s.getFunctionLogsHandler)
			functionRoutes.GET("/executions/:execution_id", s.getFunctionExecutionHandler)
			functionRoutes.GET("/:id/executions", s.getFunctionExecutionsHandler)
		}
	}

	// Secret routes
	if s.config.Features.Secrets {
		secretRoutes := protected.Group("/secrets")
		{
			secretRoutes.GET("", s.listSecretsHandler)
			secretRoutes.GET("/:name", s.getSecretHandler)
			secretRoutes.POST("", s.createSecretHandler)
			secretRoutes.PUT("/:name", s.updateSecretHandler)
			secretRoutes.DELETE("/:name", s.deleteSecretHandler)
		}
	}

	// Trigger routes
	if s.config.Features.Automation {
		triggerRoutes := protected.Group("/triggers")
		{
			triggerRoutes.GET("", s.listTriggersHandler)
			triggerRoutes.GET("/:id", s.getTriggerHandler)
			triggerRoutes.POST("", s.createTriggerHandler)
			triggerRoutes.PUT("/:id", s.updateTriggerHandler)
			triggerRoutes.DELETE("/:id", s.deleteTriggerHandler)
			triggerRoutes.GET("/:id/history", s.getTriggerHistoryHandler)
			triggerRoutes.POST("/:id/execute", s.executeTriggerHandler)
		}
	}

	// Gas Bank routes
	if s.config.Features.GasBank {
		gasBankHandler := gasbank.NewHandler(s.gasBankService, s.logger)
		gasBankHandler.Register(protected)
	}

	// Price Feed routes
	if s.config.Features.PriceFeed {
		priceFeedHandler := pricefeed.NewHandler(s.priceFeedService, s.logger)
		priceFeedHandler.Register(protected)
	}

	// Random Number routes
	if s.config.Features.RandomGenerator {
		randomHandler := random.NewHandler(s.randomService, s.logger)
		randomHandler.Register(protected)
	}

	// Oracle routes
	if s.config.Features.Oracle {
		oracleHandler := oracle.NewHandler(s.oracleService, s.logger)
		oracleHandler.Register(protected)
	}

	// Register transaction routes
	s.transactionHandlers.RegisterRoutes(s.router)
	
	// Register contract routes
	s.contractHandlers.RegisterRoutes(s.router)
	
	// Register event routes
	s.eventHandlers.RegisterRoutes(s.router)
}

// healthHandler handles health check requests
func (s *Server) healthHandler(c *gin.Context) {
	// Check database connection
	dbStatus := "ok"
	if err := s.db.DB().Ping(); err != nil {
		dbStatus = "error: " + err.Error()
	}

	// Check blockchain connection
	blockchainStatus := "ok"
	if s.blockchainClient != nil {
		_, err := s.blockchainClient.GetBlockHeight()
		if err != nil {
			blockchainStatus = "error: " + err.Error()
		}
	} else {
		blockchainStatus = "not initialized"
	}

	// Check TEE connection
	teeStatus := "ok"
	if s.teeManager == nil {
		teeStatus = "not initialized"
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
		"services": gin.H{
			"database":   dbStatus,
			"blockchain": blockchainStatus,
			"tee":        teeStatus,
		},
	})
}

// Handler placeholders for services not yet implemented

func (s *Server) listTriggersHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) getTriggerHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) createTriggerHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) updateTriggerHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) deleteTriggerHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) getTriggerHistoryHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

// Gas Bank handlers
func (s *Server) getGasBalanceHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) depositGasHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) withdrawGasHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) getGasTransactionsHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

// Price Feed handlers
func (s *Server) listPriceFeedsHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) getPriceFeedHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) createPriceFeedHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) updatePriceFeedHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) deletePriceFeedHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) getPriceFeedHistoryHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

// Random Number handlers
func (s *Server) generateRandomNumberHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) getRandomNumberHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) verifyRandomNumberHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

// Oracle handlers
func (s *Server) listOraclesHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) getOracleHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) createOracleHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) updateOracleHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) deleteOracleHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}

func (s *Server) getOracleDataHandler(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented yet"})
}