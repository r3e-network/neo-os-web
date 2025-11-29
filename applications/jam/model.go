package jam

import "time"

// Service represents a deployable unit (code + state + balance) with quotas.
type Service struct {
	ID        string        `json:"id"`
	Owner     string        `json:"owner"`
	CodeHash  string        `json:"code_hash"`
	Version   int           `json:"version"`
	StateMeta ServiceState  `json:"state_meta"`
	Balance   int64         `json:"balance"`
	Quotas    Quotas        `json:"quotas"`
	Status    ServiceStatus `json:"status"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

// ServiceState captures state metadata; actual state lives in a keyed store.
type ServiceState struct {
	Namespace string `json:"namespace"`
	Bytes     int64  `json:"bytes"`
}

type ServiceStatus string

const (
	ServiceStatusActive    ServiceStatus = "active"
	ServiceStatusSuspended ServiceStatus = "suspended"
	ServiceStatusClosed    ServiceStatus = "closed"
)

// ServiceVersion tracks immutable code artifacts and optional migrate hook.
type ServiceVersion struct {
	ServiceID   string    `json:"service_id"`
	Version     int       `json:"version"`
	CodeHash    string    `json:"code_hash"`
	MigrateHook string    `json:"migrate_hook,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// Quotas constrain how much compute/storage/bandwidth a service can consume.
type Quotas struct {
	MaxStateBytes    int64     `json:"max_state_bytes"`
	MaxComputeMillis int64     `json:"max_compute_millis"`
	MaxPackageItems  int       `json:"max_package_items"`
	ValidUntil       time.Time `json:"valid_until"`
}

// WorkPackage groups work items for a single service.
type WorkPackage struct {
	ID             string        `json:"id"`
	ServiceID      string        `json:"service_id"`
	Items          []WorkItem    `json:"items"`
	CreatedBy      string        `json:"created_by"`
	Nonce          string        `json:"nonce"`
	Expiry         time.Time     `json:"expiry"`
	Signature      []byte        `json:"signature,omitempty"`
	PreimageHashes []string      `json:"preimage_hashes,omitempty"`
	Status         PackageStatus `json:"status,omitempty"`
	CreatedAt      time.Time     `json:"created_at"`
}

// WorkItem represents the smallest unit of input to a service.
type WorkItem struct {
	ID             string   `json:"id"`
	PackageID      string   `json:"package_id"`
	Kind           string   `json:"kind"`
	ParamsHash     string   `json:"params_hash"`
	PreimageHashes []string `json:"preimage_hashes,omitempty"`
	MaxFee         int64    `json:"max_fee,omitempty"`
	Memo           string   `json:"memo,omitempty"`
}

type PackageStatus string

const (
	PackageStatusPending  PackageStatus = "pending"
	PackageStatusRefined  PackageStatus = "refined"
	PackageStatusDisputed PackageStatus = "disputed"
	PackageStatusApplied  PackageStatus = "applied"
)

// WorkReport is the refined output of a work package.
type WorkReport struct {
	ID                  string    `json:"id"`
	PackageID           string    `json:"package_id"`
	ServiceID           string    `json:"service_id"`
	RefineOutputHash    string    `json:"refine_output_hash"`
	RefineOutputCompact []byte    `json:"refine_output_compact"`
	Traces              []byte    `json:"traces,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
}

// Attestation records that a worker observed/validated a work report.
type Attestation struct {
	ReportID      string    `json:"report_id"`
	WorkerID      string    `json:"worker_id"`
	Signature     []byte    `json:"signature"`
	Weight        int64     `json:"weight"`
	CreatedAt     time.Time `json:"created_at"`
	Engine        string    `json:"engine,omitempty"`
	EngineVersion string    `json:"engine_version,omitempty"`
}

// Message represents an async notification between services.
type Message struct {
	ID          string        `json:"id"`
	FromService string        `json:"from_service"`
	ToService   string        `json:"to_service"`
	PayloadHash string        `json:"payload_hash"`
	TokenAmount int64         `json:"token_amount,omitempty"`
	Status      MessageStatus `json:"status"`
	CreatedAt   time.Time     `json:"created_at"`
	AvailableAt time.Time     `json:"available_at"`
}

type MessageStatus string

const (
	MessageStatusPending   MessageStatus = "pending"
	MessageStatusDelivered MessageStatus = "delivered"
	MessageStatusDLQ       MessageStatus = "dead_letter"
)

// Preimage tracks content-addressed blobs (code or data).
type Preimage struct {
	Hash         string    `json:"hash"`
	Size         int64     `json:"size"`
	MediaType    string    `json:"media_type"`
	CreatedAt    time.Time `json:"created_at"`
	Uploader     string    `json:"uploader"`
	StorageClass string    `json:"storage_class,omitempty"`
	RefCount     int64     `json:"refcount"`
}
