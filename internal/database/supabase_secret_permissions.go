package database

import (
	"context"
	"encoding/json"
)

// GetSecretPolicies returns the list of service IDs allowed to access a user's secret.
func (r *Repository) GetSecretPolicies(ctx context.Context, userID, secretName string) ([]string, error) {
	query := "user_id=eq." + userID + "&secret_name=eq." + secretName
	data, err := r.client.request(ctx, "GET", "secret_policies", nil, query)
	if err != nil {
		return nil, err
	}

	var rows []SecretPolicy
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	services := make([]string, 0, len(rows))
	for _, p := range rows {
		services = append(services, p.ServiceID)
	}
	return services, nil
}

// SetSecretPolicies replaces the allowed service list for a user's secret.
func (r *Repository) SetSecretPolicies(ctx context.Context, userID, secretName string, services []string) error {
	// Remove existing policies
	_, err := r.client.request(ctx, "DELETE", "secret_policies", nil, "user_id=eq."+userID+"&secret_name=eq."+secretName)
	if err != nil {
		return err
	}
	// Insert new policies
	if len(services) == 0 {
		return nil
	}
	rows := make([]SecretPolicy, 0, len(services))
	for _, svc := range services {
		rows = append(rows, SecretPolicy{UserID: userID, SecretName: secretName, ServiceID: svc})
	}
	_, err = r.client.request(ctx, "POST", "secret_policies", rows, "")
	return err
}
