// Package neosimulation provides simulation service for automated transaction testing.
package neosimulation

const (
	ServiceID   = "neosimulation"
	ServiceName = "Neo Simulation Service"
	Version     = "1.0.0"

	// Default simulation interval range (15 seconds per miniapp)
	// Single worker per miniapp with fixed 15-second interval
	DefaultMinIntervalMS = 15000 // 15 seconds minimum per worker
	DefaultMaxIntervalMS = 15000 // 15 seconds maximum per worker

	// Default number of concurrent workers per miniapp
	// Single worker for consistent 15-second interval
	DefaultWorkersPerApp = 1

	// Default simulation transaction amounts (in GAS smallest unit, 8 decimals)
	DefaultMinAmount = 1000000   // 0.01 GAS
	DefaultMaxAmount = 100000000 // 1 GAS
)

// Config holds simulation service configuration.
type Config struct {
	Marble           interface{} // *marble.Marble
	DB               interface{} // database.RepositoryInterface
	ChainClient      interface{} // *chain.Client
	AccountPoolURL   string
	MiniApps         []string      // List of app IDs to simulate
	MinIntervalMS    int           // Minimum interval between transactions (milliseconds)
	MaxIntervalMS    int           // Maximum interval between transactions (milliseconds)
	MinAmount        int64         // Minimum transaction amount
	MaxAmount        int64         // Maximum transaction amount
	WorkersPerApp    int           // Number of concurrent workers per miniapp
	AutoStart        bool          // Start simulation automatically on service start
}
