//go:build !linux

package nitro

import "fmt"

func attestNitroWithNSM(userData []byte) (*AttestationReport, error) {
	_ = userData
	return nil, fmt.Errorf("nsm attestation is only available on linux")
}
