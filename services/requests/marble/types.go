package neorequests

import "time"

type rngPayload struct {
	RequestID string `json:"request_id,omitempty"`
}

type rngResponse struct {
	RequestID       string `json:"request_id"`
	Randomness      string `json:"randomness"`
	Signature       string `json:"signature,omitempty"`
	PublicKey       string `json:"public_key,omitempty"`
	AttestationHash string `json:"attestation_hash,omitempty"`
	Timestamp       int64  `json:"timestamp"`
}

type oraclePayload struct {
	URL         string            `json:"url"`
	Method      string            `json:"method,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Body        string            `json:"body,omitempty"`
	JSONPath    string            `json:"json_path,omitempty"`
	SecretName  string            `json:"secret_name,omitempty"`
	SecretAsKey string            `json:"secret_as_key,omitempty"`
}

type oracleResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       string            `json:"body,omitempty"`
}

type computePayload struct {
	Script     string                 `json:"script"`
	EntryPoint string                 `json:"entry_point,omitempty"`
	Input      map[string]interface{} `json:"input,omitempty"`
	SecretRefs []string               `json:"secret_refs,omitempty"`
	Timeout    int                    `json:"timeout,omitempty"`
}

type computeResponse struct {
	JobID     string                 `json:"job_id"`
	Status    string                 `json:"status"`
	Output    map[string]interface{} `json:"output,omitempty"`
	Logs      []string               `json:"logs,omitempty"`
	Error     string                 `json:"error,omitempty"`
	GasUsed   int64                  `json:"gas_used"`
	StartedAt time.Time              `json:"started_at"`
	Duration  string                 `json:"duration,omitempty"`

	EncryptedOutput string `json:"encrypted_output,omitempty"`
	OutputHash      string `json:"output_hash,omitempty"`
	Signature       string `json:"signature,omitempty"`
}
