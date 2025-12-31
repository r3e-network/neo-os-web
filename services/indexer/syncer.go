package indexer

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/sirupsen/logrus"
)

// Syncer synchronizes transactions from Neo N3 nodes.
type Syncer struct {
	cfg     *Config
	storage *Storage
	tracer  *Tracer
	clients map[Network]*chain.Client // One client per network
	log     *logrus.Entry
	mu      sync.Mutex
	running bool
	stopCh  chan struct{}
}

// NewSyncer creates a new transaction syncer for all configured networks.
func NewSyncer(cfg *Config, storage *Storage) (*Syncer, error) {
	clients := make(map[Network]*chain.Client)

	for _, network := range cfg.Networks {
		client, err := chain.NewClient(chain.Config{
			RPCURL:    cfg.GetRPCURL(network),
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
		tracer:  NewTracer(storage),
		clients: clients,
		log:     logrus.WithField("component", "indexer-syncer"),
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
	s.mu.Unlock()

	s.log.Info("starting transaction syncer")
	go s.syncLoop(ctx)
	return nil
}

// Stop stops the synchronization loop.
func (s *Syncer) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		close(s.stopCh)
		s.running = false
	}
}

func (s *Syncer) syncLoop(ctx context.Context) {
	ticker := time.NewTicker(s.cfg.SyncInterval)
	defer ticker.Stop()

	// Initial sync for all networks
	s.syncAllNetworks(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopCh:
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

	endBlock := startBlock + uint64(s.cfg.BatchSize)
	if endBlock > chainHeight {
		endBlock = chainHeight
	}

	s.log.WithFields(logrus.Fields{
		"network": network,
		"start":   startBlock,
		"end":     endBlock,
		"chain":   chainHeight,
	}).Info("syncing blocks")

	var totalTx int64
	for blockIdx := startBlock; blockIdx < endBlock; blockIdx++ {
		count, err := s.syncBlockForNetwork(ctx, network, client, blockIdx)
		if err != nil {
			s.log.WithError(err).WithFields(logrus.Fields{
				"network": network,
				"block":   blockIdx,
			}).Error("sync block")
			break
		}
		totalTx += count
	}

	// Update sync state
	newState := &SyncState{
		Network:        network,
		LastBlockIndex: endBlock - 1,
		LastBlockTime:  time.Now().UTC(),
		TotalTxIndexed: totalTx,
		LastSyncAt:     time.Now().UTC(),
	}
	if state != nil {
		newState.TotalTxIndexed = state.TotalTxIndexed + totalTx
	}
	s.storage.UpdateSyncState(ctx, newState)
}

func (s *Syncer) syncBlockForNetwork(ctx context.Context, network Network, client *chain.Client, blockIdx uint64) (int64, error) {
	block, err := client.GetBlock(ctx, blockIdx)
	if err != nil {
		return 0, fmt.Errorf("get block: %w", err)
	}

	blockTime := time.Unix(int64(block.Time/1000), 0)
	var count int64

	for _, chainTx := range block.Tx {
		if err := s.indexTransactionForNetwork(ctx, network, client, &chainTx, blockIdx, blockTime); err != nil {
			s.log.WithError(err).WithField("tx", chainTx.Hash).Warn("index tx")
			continue
		}
		count++
	}
	return count, nil
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

	signersJSON, _ := json.Marshal(chainTx.Signers)

	// Determine transaction type based on script complexity
	txType := TxTypeSimple
	if IsComplexTransaction(chainTx.Script) {
		txType = TxTypeComplex
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
		TxType:          txType,
		SignersJSON:     signersJSON,
	}

	if err := s.storage.SaveTransaction(ctx, tx); err != nil {
		return fmt.Errorf("save tx: %w", err)
	}

	// Only parse and store opcode traces for complex transactions
	if txType == TxTypeComplex {
		traces, err := s.tracer.ParseScript(chainTx.Hash, chainTx.Script)
		if err != nil {
			s.log.WithError(err).WithField("tx", chainTx.Hash).Warn("parse script opcodes")
		} else if len(traces) > 0 {
			if err := s.tracer.SaveTraces(ctx, traces); err != nil {
				s.log.WithError(err).WithField("tx", chainTx.Hash).Warn("save opcode traces")
			}
		}
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
