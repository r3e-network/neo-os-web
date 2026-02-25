package indexer

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/logging"
)

// Syncer synchronizes transactions from Neo N3 nodes.
type Syncer struct {
	cfg     *Config
	storage *Storage
	clients map[Network]*chain.Client // One client per network
	log     *logging.Logger
	mu      sync.Mutex
	running bool
	stopCh  chan struct{}
	wg      sync.WaitGroup
}

// NewSyncer creates a new transaction syncer for all configured networks.
func NewSyncer(cfg *Config, storage *Storage) (*Syncer, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config required")
	}
	if storage == nil {
		return nil, fmt.Errorf("storage required")
	}
	if len(cfg.Networks) == 0 {
		return nil, fmt.Errorf("at least one network required")
	}

	clients := make(map[Network]*chain.Client)

	for _, network := range cfg.Networks {
		if network != NetworkMainnet && network != NetworkTestnet {
			return nil, fmt.Errorf("invalid network %q", network)
		}

		rpcURL := strings.TrimSpace(cfg.GetRPCURL(network))
		if rpcURL == "" {
			return nil, fmt.Errorf("rpc url required for network %s", network)
		}

		client, err := chain.NewClient(chain.Config{
			RPCURL:    rpcURL,
			NetworkID: getNetworkMagic(network),
			Timeout:   cfg.RequestTimeout,
		})
		if err != nil {
			return nil, fmt.Errorf("create chain client for %s: %w", network, err)
		}
		clients[network] = client
	}

	return &Syncer{
		cfg:     cfg,
		storage: storage,
		clients: clients,
		log:     logging.NewFromEnv("indexer-syncer"),
		stopCh:  make(chan struct{}),
	}, nil
}

func getNetworkMagic(network Network) uint32 {
	if network == NetworkMainnet {
		return 860833102
	}
	return 894710606 // TestNet
}

// Start begins the synchronization loop.
func (s *Syncer) Start(ctx context.Context) error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("syncer already running")
	}
	s.running = true
	s.stopCh = make(chan struct{})
	stopCh := s.stopCh
	s.wg.Add(1)
	s.mu.Unlock()

	s.log.Info(ctx, "starting transaction syncer", nil)
	go s.syncLoop(ctx, stopCh)
	return nil
}

// Stop stops the synchronization loop.
func (s *Syncer) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	stopCh := s.stopCh
	s.running = false
	s.mu.Unlock()

	if stopCh != nil {
		close(stopCh)
	}
	s.wg.Wait()
}

func (s *Syncer) syncLoop(ctx context.Context, stopCh <-chan struct{}) {
	defer s.wg.Done()
	defer func() {
		if r := recover(); r != nil {
			s.log.Error(ctx, "syncLoop panicked", fmt.Errorf("%v", r), nil)
		}
	}()
	ticker := time.NewTicker(s.cfg.SyncInterval)
	defer ticker.Stop()

	// Initial sync for all networks
	s.syncAllNetworks(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-stopCh:
			return
		case <-ticker.C:
			s.syncAllNetworks(ctx)
		}
	}
}

// syncAllNetworks syncs all configured networks
func (s *Syncer) syncAllNetworks(ctx context.Context) {
	for _, network := range s.cfg.Networks {
		s.syncBlocksForNetwork(ctx, network)
	}
}

func (s *Syncer) syncBlocksForNetwork(ctx context.Context, network Network) {
	client := s.clients[network]
	if client == nil {
		s.log.WithField("network", network).Error("no client for network")
		return
	}

	state, err := s.storage.GetSyncState(ctx, network)
	if err != nil {
		s.log.WithError(err).WithField("network", network).Error("get sync state")
		return
	}

	startBlock := s.cfg.StartBlock
	if state != nil {
		startBlock = state.LastBlockIndex + 1
	}

	chainHeight, err := client.GetBlockCount(ctx)
	if err != nil {
		s.log.WithError(err).WithField("network", network).Error("get block count")
		return
	}

	if startBlock >= chainHeight {
		return // Already synced
	}

	batchSize, ok := nonNegativeIntToUint64(s.cfg.BatchSize)
	if !ok {
		s.log.WithField("batch_size", s.cfg.BatchSize).Warn("invalid negative batch size")
		return
	}

	endBlock := chainHeight
	if batchSize <= ^uint64(0)-startBlock {
		endBlock = startBlock + batchSize
	}
	if endBlock > chainHeight {
		endBlock = chainHeight
	}

	s.log.Info(ctx, "syncing blocks", map[string]interface{}{
		"network": network,
		"start":   startBlock,
		"end":     endBlock,
		"chain":   chainHeight,
	})

	var totalTx int64
	lastSuccessBlock := startBlock - 1
	for blockIdx := startBlock; blockIdx < endBlock; blockIdx++ {
		count, err := s.syncBlockForNetwork(ctx, network, client, blockIdx)
		if err != nil {
			s.log.WithError(err).WithFields(map[string]interface{}{
				"network": network,
				"block":   blockIdx,
			}).Error("sync block")
			break
		}
		lastSuccessBlock = blockIdx
		totalTx += count
	}

	if lastSuccessBlock < startBlock {
		return // No blocks were successfully synced
	}

	// Update sync state
	newState := &SyncState{
		Network:        network,
		LastBlockIndex: lastSuccessBlock,
		LastBlockTime:  time.Now().UTC(),
		TotalTxIndexed: totalTx,
		LastSyncAt:     time.Now().UTC(),
	}
	if state != nil {
		newState.TotalTxIndexed = state.TotalTxIndexed + totalTx
	}
	if err := s.storage.UpdateSyncState(ctx, newState); err != nil {
		s.log.WithError(err).WithField("network", network).Error("update sync state")
	}
}

func (s *Syncer) syncBlockForNetwork(ctx context.Context, network Network, client *chain.Client, blockIdx uint64) (int64, error) {
	block, err := client.GetBlock(ctx, blockIdx)
	if err != nil {
		return 0, fmt.Errorf("get block: %w", err)
	}

	blockTime := unixMillisToTime(block.Time)
	var count int64

	for i := range block.Tx {
		chainTx := &block.Tx[i]
		if err := s.indexTransactionForNetwork(ctx, network, client, chainTx, blockIdx, blockTime); err != nil {
			s.log.WithError(err).WithField("tx", chainTx.Hash).Warn("index tx")
			continue
		}
		count++
	}
	return count, nil
}

func nonNegativeIntToUint64(v int) (uint64, bool) {
	if v < 0 {
		return 0, false
	}
	return uint64(v), true
}

func unixMillisToTime(ms uint64) time.Time {
	sec := ms / 1000
	if sec > math.MaxInt64 {
		return time.Time{}
	}
	return time.Unix(int64(sec), 0).UTC()
}

func (s *Syncer) indexTransactionForNetwork(ctx context.Context, network Network, client *chain.Client, chainTx *chain.Transaction, blockIdx uint64, blockTime time.Time) error {
	// Get application log for VM state
	appLog, err := client.GetApplicationLog(ctx, chainTx.Hash)
	if err != nil {
		return fmt.Errorf("get app log: %w", err)
	}

	vmState := "UNKNOWN"
	gasConsumed := "0"
	exception := ""
	if len(appLog.Executions) > 0 {
		vmState = appLog.Executions[0].VMState
		gasConsumed = appLog.Executions[0].GasConsumed
		exception = appLog.Executions[0].Exception
	}

	signersJSON, err2 := json.Marshal(chainTx.Signers)
	if err2 != nil {
		s.log.WithError(err2).WithField("tx", chainTx.Hash).Warn("marshal signers")
		signersJSON = []byte("[]")
	}

	tx := &Transaction{
		Hash:            chainTx.Hash,
		Network:         network,
		BlockIndex:      blockIdx,
		BlockTime:       blockTime,
		Size:            chainTx.Size,
		Version:         chainTx.Version,
		Nonce:           chainTx.Nonce,
		Sender:          chainTx.Sender,
		SystemFee:       chainTx.SystemFee,
		NetworkFee:      chainTx.NetworkFee,
		ValidUntilBlock: chainTx.ValidUntilBlock,
		Script:          chainTx.Script,
		VMState:         vmState,
		GasConsumed:     gasConsumed,
		Exception:       exception,
		SignersJSON:     signersJSON,
	}

	if err := s.storage.SaveTransaction(ctx, tx); err != nil {
		return fmt.Errorf("save tx: %w", err)
	}

	// Index address relationships
	s.indexAddressRelationships(ctx, tx, chainTx)

	return nil
}

func (s *Syncer) indexAddressRelationships(ctx context.Context, tx *Transaction, chainTx *chain.Transaction) {
	var addrTxs []*AddressTx

	// Sender
	addrTxs = append(addrTxs, &AddressTx{
		Address:   tx.Sender,
		TxHash:    tx.Hash,
		Role:      RoleSender,
		Network:   tx.Network,
		BlockTime: tx.BlockTime,
	})

	// Signers
	for _, signer := range chainTx.Signers {
		addrTxs = append(addrTxs, &AddressTx{
			Address:   signer.Account,
			TxHash:    tx.Hash,
			Role:      RoleSigner,
			Network:   tx.Network,
			BlockTime: tx.BlockTime,
		})
	}

	if err := s.storage.SaveAddressTxs(ctx, addrTxs); err != nil {
		s.log.WithError(err).Warn("save address txs")
	}
}
