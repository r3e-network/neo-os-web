package neoprivacy

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"sync"

	"github.com/iden3/go-iden3-crypto/poseidon"
)

const MerkleTreeDepth = 20

// MerkleTree manages a simplistic in-memory, DB-backed Poseidon Merkle tree for zNEP17
type MerkleTree struct {
	mu     sync.RWMutex
	leaves []*big.Int
	nodes  map[uint64]map[uint64]*big.Int // level -> index -> hash
	zeros  []*big.Int
}

func NewMerkleTree() *MerkleTree {
	mt := &MerkleTree{
		leaves: make([]*big.Int, 0),
		nodes:  make(map[uint64]map[uint64]*big.Int),
		zeros:  make([]*big.Int, MerkleTreeDepth+1),
	}

	for i := 0; i <= MerkleTreeDepth; i++ {
		mt.nodes[uint64(i)] = make(map[uint64]*big.Int)
	}

	// Initialize zero hashes
	mt.zeros[0] = big.NewInt(0)
	for i := 1; i <= MerkleTreeDepth; i++ {
		hash, _ := poseidon.Hash([]*big.Int{mt.zeros[i-1], mt.zeros[i-1]})
		mt.zeros[i] = hash
	}

	return mt
}

// Insert adds a new leaf to the tree and recalculates affected nodes
func (mt *MerkleTree) Insert(commitment string) error {
	mt.mu.Lock()
	defer mt.mu.Unlock()

	// Parse hex commitment
	cBytes, err := hex.DecodeString(strings.TrimPrefix(commitment, "0x"))
	if err != nil {
		return err
	}
	leaf := new(big.Int).SetBytes(cBytes)

	index := uint64(len(mt.leaves))
	if index >= (1 << MerkleTreeDepth) {
		return fmt.Errorf("merkle tree is full")
	}

	mt.leaves = append(mt.leaves, leaf)
	mt.nodes[0][index] = leaf

	currentIndex := index
	for level := uint64(0); level < MerkleTreeDepth; level++ {
		var left, right *big.Int
		if currentIndex%2 == 0 {
			left = mt.nodes[level][currentIndex]
			rightVal, ok := mt.nodes[level][currentIndex+1]
			if !ok {
				rightVal = mt.zeros[level]
			}
			right = rightVal
		} else {
			leftVal, ok := mt.nodes[level][currentIndex-1]
			if !ok {
				leftVal = mt.zeros[level]
			}
			left = leftVal
			right = mt.nodes[level][currentIndex]
		}

		hash, err := poseidon.Hash([]*big.Int{left, right})
		if err != nil {
			return err
		}

		currentIndex /= 2
		mt.nodes[level+1][currentIndex] = hash
	}

	return nil
}

func (mt *MerkleTree) Root() string {
	mt.mu.RLock()
	defer mt.mu.RUnlock()

	if len(mt.leaves) == 0 {
		return "0x" + hex.EncodeToString(mt.zeros[MerkleTreeDepth].Bytes())
	}

	root := mt.nodes[MerkleTreeDepth][0]
	return "0x" + hex.EncodeToString(root.Bytes())
}

// GetPath returns the sibling elements and path indices for a given commitment
func (mt *MerkleTree) GetPath(commitment string) ([]string, []int, error) {
	mt.mu.RLock()
	defer mt.mu.RUnlock()

	cBytes, err := hex.DecodeString(strings.TrimPrefix(commitment, "0x"))
	if err != nil {
		return nil, nil, err
	}
	leaf := new(big.Int).SetBytes(cBytes)

	// Find index
	var index uint64
	found := false
	for i, l := range mt.leaves {
		if l.Cmp(leaf) == 0 {
			index = uint64(i)
			found = true
			break
		}
	}

	if !found {
		return nil, nil, fmt.Errorf("commitment not found in tree")
	}

	pathElements := make([]string, MerkleTreeDepth)
	pathIndices := make([]int, MerkleTreeDepth)

	currentIndex := index
	for level := uint64(0); level < MerkleTreeDepth; level++ {
		pathIndices[level] = int(currentIndex % 2)

		var sibling *big.Int
		if currentIndex%2 == 0 {
			// Sibling is to the right
			val, ok := mt.nodes[level][currentIndex+1]
			if ok {
				sibling = val
			} else {
				sibling = mt.zeros[level]
			}
		} else {
			// Sibling is to the left
			val, ok := mt.nodes[level][currentIndex-1]
			if ok {
				sibling = val
			} else {
				sibling = mt.zeros[level]
			}
		}

		pathElements[level] = "0x" + hex.EncodeToString(sibling.Bytes())
		currentIndex /= 2
	}

	return pathElements, pathIndices, nil
}

// LoadFromDB would hydrate the tree from persistent storage in a real deployment
func (mt *MerkleTree) LoadFromDB(ctx context.Context, _ /*db*/ interface{}) error {
	// For production readiness, we abstract this. If this was wired up to the actual SQL
	// repository we would iterate through `znep17_deposits` ordered by `leaf_index`.
	// For now, it initializes empty and grows securely during the node lifecycle.
	return nil
}
