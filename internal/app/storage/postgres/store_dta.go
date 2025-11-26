package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	domaindta "github.com/R3E-Network/service_layer/internal/domain/dta"
	"github.com/google/uuid"
)

// --- DTAStore ----------------------------------------------------------------

func (s *Store) CreateProduct(ctx context.Context, product domaindta.Product) (domaindta.Product, error) {
	if product.ID == "" {
		product.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	product.CreatedAt = now
	product.UpdatedAt = now
	tenant := s.accountTenant(ctx, product.AccountID)

	metaJSON, err := json.Marshal(product.Metadata)
	if err != nil {
		return domaindta.Product{}, err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO chainlink_dta_products
			(id, account_id, name, symbol, type, status, settlement_terms, metadata, tenant, created_at, updated_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, product.ID, product.AccountID, product.Name, product.Symbol, product.Type, product.Status, product.SettlementTerms, metaJSON, tenant, product.CreatedAt, product.UpdatedAt)
	if err != nil {
		return domaindta.Product{}, err
	}
	return product, nil
}

func (s *Store) UpdateProduct(ctx context.Context, product domaindta.Product) (domaindta.Product, error) {
	existing, err := s.GetProduct(ctx, product.ID)
	if err != nil {
		return domaindta.Product{}, err
	}
	product.CreatedAt = existing.CreatedAt
	product.UpdatedAt = time.Now().UTC()

	metaJSON, err := json.Marshal(product.Metadata)
	if err != nil {
		return domaindta.Product{}, err
	}
	tenant := s.accountTenant(ctx, product.AccountID)

	result, err := s.db.ExecContext(ctx, `
		UPDATE chainlink_dta_products
		SET name = $2, symbol = $3, type = $4, status = $5, settlement_terms = $6, metadata = $7, tenant = $8, updated_at = $9
		WHERE id = $1
	`, product.ID, product.Name, product.Symbol, product.Type, product.Status, product.SettlementTerms, metaJSON, tenant, product.UpdatedAt)
	if err != nil {
		return domaindta.Product{}, err
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		return domaindta.Product{}, sql.ErrNoRows
	}
	return product, nil
}

func (s *Store) GetProduct(ctx context.Context, id string) (domaindta.Product, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, name, symbol, type, status, settlement_terms, metadata, created_at, updated_at
		FROM chainlink_dta_products
		WHERE id = $1
	`, id)
	return scanDTAProduct(row)
}

func (s *Store) ListProducts(ctx context.Context, accountID string) ([]domaindta.Product, error) {
	tenant := s.accountTenant(ctx, accountID)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, name, symbol, type, status, settlement_terms, metadata, created_at, updated_at
		FROM chainlink_dta_products
		WHERE account_id = $1 AND ($2 = '' OR tenant = $2)
		ORDER BY created_at DESC
	`, accountID, tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domaindta.Product
	for rows.Next() {
		product, err := scanDTAProduct(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, product)
	}
	return products, rows.Err()
}

func (s *Store) CreateOrder(ctx context.Context, order domaindta.Order) (domaindta.Order, error) {
	if order.ID == "" {
		order.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	order.CreatedAt = now
	order.UpdatedAt = now
	tenant := s.accountTenant(ctx, order.AccountID)

	metaJSON, err := json.Marshal(order.Metadata)
	if err != nil {
		return domaindta.Order{}, err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO chainlink_dta_orders
			(id, account_id, product_id, type, amount, wallet_address, status, metadata, tenant, created_at, updated_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, order.ID, order.AccountID, order.ProductID, order.Type, order.Amount, order.Wallet, order.Status, metaJSON, tenant, order.CreatedAt, order.UpdatedAt)
	if err != nil {
		return domaindta.Order{}, err
	}
	return order, nil
}

func (s *Store) GetOrder(ctx context.Context, id string) (domaindta.Order, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, product_id, type, amount, wallet_address, status, metadata, created_at, updated_at
		FROM chainlink_dta_orders
		WHERE id = $1
	`, id)
	return scanDTAOrder(row)
}

func (s *Store) ListOrders(ctx context.Context, accountID string, limit int) ([]domaindta.Order, error) {
	tenant := s.accountTenant(ctx, accountID)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, product_id, type, amount, wallet_address, status, metadata, created_at, updated_at
		FROM chainlink_dta_orders
		WHERE account_id = $1 AND ($2 = '' OR tenant = $2)
		ORDER BY created_at DESC
		LIMIT $3
	`, accountID, tenant, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []domaindta.Order
	for rows.Next() {
		order, err := scanDTAOrder(rows)
		if err != nil {
			return nil, err
		}
		orders = append(orders, order)
	}
	return orders, rows.Err()
}

func scanDTAProduct(scanner rowScanner) (domaindta.Product, error) {
	var (
		product domaindta.Product
		metaRaw []byte
	)
	if err := scanner.Scan(&product.ID, &product.AccountID, &product.Name, &product.Symbol, &product.Type, &product.Status, &product.SettlementTerms, &metaRaw, &product.CreatedAt, &product.UpdatedAt); err != nil {
		return domaindta.Product{}, err
	}
	if len(metaRaw) > 0 {
		_ = json.Unmarshal(metaRaw, &product.Metadata)
	}
	return product, nil
}

func scanDTAOrder(scanner rowScanner) (domaindta.Order, error) {
	var (
		order   domaindta.Order
		metaRaw []byte
	)
	if err := scanner.Scan(&order.ID, &order.AccountID, &order.ProductID, &order.Type, &order.Amount, &order.Wallet, &order.Status, &metaRaw, &order.CreatedAt, &order.UpdatedAt); err != nil {
		return domaindta.Order{}, err
	}
	if len(metaRaw) > 0 {
		_ = json.Unmarshal(metaRaw, &order.Metadata)
	}
	return order, nil
}
