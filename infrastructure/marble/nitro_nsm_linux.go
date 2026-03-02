//go:build linux

package marble

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"github.com/hf/nsm"
	"github.com/hf/nsm/request"
)

const maxNitroPCRs = 32

func attestNitroWithNSM(userData []byte) (*AttestationReport, error) {
	sess, err := nsm.OpenDefaultSession()
	if err != nil {
		return nil, fmt.Errorf("open nsm session: %w", err)
	}
	defer sess.Close()

	attRes, err := sess.Send(&request.Attestation{
		UserData: userData,
	})
	if err != nil {
		return nil, fmt.Errorf("request nsm attestation: %w", err)
	}
	if attRes.Error != "" {
		return nil, fmt.Errorf("nsm attestation error: %s", attRes.Error)
	}
	if attRes.Attestation == nil || len(attRes.Attestation.Document) == 0 {
		return nil, fmt.Errorf("nsm attestation document is empty")
	}

	report := &AttestationReport{
		Provider:  string(TEEProviderNitro),
		Format:    "aws_nitro_attestation_document",
		Document:  base64.StdEncoding.EncodeToString(attRes.Attestation.Document),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	descRes, err := sess.Send(&request.DescribeNSM{})
	if err == nil && descRes.Error == "" && descRes.DescribeNSM != nil {
		report.ModuleID = descRes.DescribeNSM.ModuleID
		report.PCRs = describeNitroPCRs(sess, int(descRes.DescribeNSM.MaxPCRs))
	}

	return report, nil
}

func describeNitroPCRs(sess *nsm.Session, maxPCRs int) map[string]string {
	if maxPCRs <= 0 {
		maxPCRs = maxNitroPCRs
	}
	if maxPCRs > maxNitroPCRs {
		maxPCRs = maxNitroPCRs
	}

	out := make(map[string]string)
	for i := 0; i < maxPCRs; i++ {
		// #nosec G115 -- maxPCRs is clamped to 32
		resp, err := sess.Send(&request.DescribePCR{Index: uint16(i)})
		if err != nil || resp.Error != "" || resp.DescribePCR == nil || len(resp.DescribePCR.Data) == 0 {
			continue
		}
		out[strconv.Itoa(i)] = hex.EncodeToString(resp.DescribePCR.Data)
	}

	if len(out) == 0 {
		return nil
	}

	return out
}
