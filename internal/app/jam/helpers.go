package jam

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
)

// HashStruct produces a stable SHA-256 hash of the JSON encoding of v.
func HashStruct(v any) (string, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}

// Hash returns a hash of the work package including its items.
func (p WorkPackage) Hash() (string, error) {
	if err := p.ValidateBasic(); err != nil {
		return "", err
	}
	return HashStruct(p)
}

// Hash returns a hash of the work report payload.
func (r WorkReport) Hash() (string, error) {
	if err := r.ValidateBasic(); err != nil {
		return "", err
	}
	return HashStruct(r)
}

// ValidateBasic checks required fields on a work package.
func (p WorkPackage) ValidateBasic() error {
	if p.ID == "" {
		return errors.New("work package id is required")
	}
	if p.ServiceID == "" {
		return errors.New("service id is required")
	}
	if len(p.Items) == 0 {
		return errors.New("at least one work item is required")
	}
	for i, item := range p.Items {
		if item.ID == "" {
			return fmt.Errorf("work item %d missing id", i)
		}
		if item.PackageID == "" {
			return fmt.Errorf("work item %s missing package id", item.ID)
		}
		if item.Kind == "" {
			return fmt.Errorf("work item %s missing kind", item.ID)
		}
		if item.ParamsHash == "" {
			return fmt.Errorf("work item %s missing params hash", item.ID)
		}
	}
	return nil
}

// ValidateBasic checks required fields on a work report.
func (r WorkReport) ValidateBasic() error {
	if r.ID == "" {
		return errors.New("work report id is required")
	}
	if r.PackageID == "" {
		return errors.New("package id is required")
	}
	if r.ServiceID == "" {
		return errors.New("service id is required")
	}
	if r.RefineOutputHash == "" {
		return errors.New("refine output hash is required")
	}
	return nil
}
