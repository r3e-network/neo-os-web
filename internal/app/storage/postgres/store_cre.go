package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/internal/domain/account"
	"github.com/R3E-Network/service_layer/internal/domain/cre"
	"github.com/R3E-Network/service_layer/internal/domain/function"
	"github.com/R3E-Network/service_layer/internal/domain/gasbank"
	"github.com/R3E-Network/service_layer/internal/domain/secret"
)

// --- CREStore ---------------------------------------------------------------

func (s *Store) CreatePlaybook(ctx context.Context, pb cre.Playbook) (cre.Playbook, error) {
	if pb.ID == "" {
		pb.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	pb.CreatedAt = now
	pb.UpdatedAt = now
	tenant := s.accountTenant(ctx, pb.AccountID)

	stepsJSON, err := json.Marshal(pb.Steps)
	if err != nil {
		return cre.Playbook{}, err
	}
	tagsJSON, err := json.Marshal(pb.Tags)
	if err != nil {
		return cre.Playbook{}, err
	}
	metaJSON, err := json.Marshal(pb.Metadata)
	if err != nil {
		return cre.Playbook{}, err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO app_cre_playbooks (id, account_id, name, description, steps, tags, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, pb.ID, pb.AccountID, pb.Name, pb.Description, stepsJSON, tagsJSON, metaJSON, tenant, pb.CreatedAt, pb.UpdatedAt)
	if err != nil {
		return cre.Playbook{}, err
	}
	return pb, nil
}

func (s *Store) UpdatePlaybook(ctx context.Context, pb cre.Playbook) (cre.Playbook, error) {
	existing, err := s.GetPlaybook(ctx, pb.ID)
	if err != nil {
		return cre.Playbook{}, err
	}
	pb.CreatedAt = existing.CreatedAt
	pb.UpdatedAt = time.Now().UTC()
	tenant := s.accountTenant(ctx, pb.AccountID)

	stepsJSON, err := json.Marshal(pb.Steps)
	if err != nil {
		return cre.Playbook{}, err
	}
	tagsJSON, err := json.Marshal(pb.Tags)
	if err != nil {
		return cre.Playbook{}, err
	}
	metaJSON, err := json.Marshal(pb.Metadata)
	if err != nil {
		return cre.Playbook{}, err
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE app_cre_playbooks
		SET name = $2, description = $3, steps = $4, tags = $5, metadata = $6, tenant = $7, updated_at = $8
		WHERE id = $1
	`, pb.ID, pb.Name, pb.Description, stepsJSON, tagsJSON, metaJSON, tenant, pb.UpdatedAt)
	if err != nil {
		return cre.Playbook{}, err
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		return cre.Playbook{}, sql.ErrNoRows
	}
	return pb, nil
}

func (s *Store) GetPlaybook(ctx context.Context, id string) (cre.Playbook, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, name, description, steps, tags, metadata, created_at, updated_at
		FROM app_cre_playbooks
		WHERE id = $1
	`, id)

	return scanPlaybook(row)
}

func (s *Store) ListPlaybooks(ctx context.Context, accountID string) ([]cre.Playbook, error) {
	tenant := s.accountTenant(ctx, accountID)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, name, description, steps, tags, metadata, created_at, updated_at
		FROM app_cre_playbooks
		WHERE account_id = $1 AND ($2 = '' OR tenant = $2)
		ORDER BY created_at DESC
	`, accountID, tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []cre.Playbook
	for rows.Next() {
		pb, err := scanPlaybook(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, pb)
	}
	return result, rows.Err()
}

func (s *Store) CreateRun(ctx context.Context, run cre.Run) (cre.Run, error) {
	if run.ID == "" {
		run.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	run.CreatedAt = now
	run.UpdatedAt = now
	tenant := s.accountTenant(ctx, run.AccountID)

	paramsJSON, err := json.Marshal(run.Parameters)
	if err != nil {
		return cre.Run{}, err
	}
	tagsJSON, err := json.Marshal(run.Tags)
	if err != nil {
		return cre.Run{}, err
	}
	resultsJSON, err := json.Marshal(run.Results)
	if err != nil {
		return cre.Run{}, err
	}
	metaJSON, err := json.Marshal(run.Metadata)
	if err != nil {
		return cre.Run{}, err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO app_cre_runs (id, account_id, playbook_id, executor_id, status, parameters, tags, results, metadata, created_at, updated_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, run.ID, run.AccountID, run.PlaybookID, toNullString(run.ExecutorID), run.Status, paramsJSON, tagsJSON, resultsJSON, metaJSON, tenant, run.CreatedAt, run.UpdatedAt, toNullTime(ptrTime(run.CompletedAt)))
	if err != nil {
		return cre.Run{}, err
	}
	return run, nil
}

func (s *Store) UpdateRun(ctx context.Context, run cre.Run) (cre.Run, error) {
	existing, err := s.GetRun(ctx, run.ID)
	if err != nil {
		return cre.Run{}, err
	}
	run.CreatedAt = existing.CreatedAt
	run.UpdatedAt = time.Now().UTC()
	tenant := s.accountTenant(ctx, run.AccountID)

	paramsJSON, err := json.Marshal(run.Parameters)
	if err != nil {
		return cre.Run{}, err
	}
	tagsJSON, err := json.Marshal(run.Tags)
	if err != nil {
		return cre.Run{}, err
	}
	resultsJSON, err := json.Marshal(run.Results)
	if err != nil {
		return cre.Run{}, err
	}
	metaJSON, err := json.Marshal(run.Metadata)
	if err != nil {
		return cre.Run{}, err
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE app_cre_runs
		SET status = $2, executor_id = $3, parameters = $4, tags = $5, results = $6, metadata = $7, tenant = $8, updated_at = $9, completed_at = $10
		WHERE id = $1
	`, run.ID, run.Status, toNullString(run.ExecutorID), paramsJSON, tagsJSON, resultsJSON, metaJSON, tenant, run.UpdatedAt, toNullTime(ptrTime(run.CompletedAt)))
	if err != nil {
		return cre.Run{}, err
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		return cre.Run{}, sql.ErrNoRows
	}
	return run, nil
}

func (s *Store) GetRun(ctx context.Context, id string) (cre.Run, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, playbook_id, executor_id, status, parameters, tags, results, metadata, created_at, updated_at, completed_at
		FROM app_cre_runs
		WHERE id = $1
	`, id)
	return scanRun(row)
}

func (s *Store) ListRuns(ctx context.Context, accountID string, limit int) ([]cre.Run, error) {
	tenant := s.accountTenant(ctx, accountID)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, playbook_id, executor_id, status, parameters, tags, results, metadata, created_at, updated_at, completed_at
		FROM app_cre_runs
		WHERE account_id = $1 AND ($2 = '' OR tenant = $2)
		ORDER BY created_at DESC
		LIMIT $3
	`, accountID, tenant, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []cre.Run
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, run)
	}
	return result, rows.Err()
}

func (s *Store) CreateExecutor(ctx context.Context, exec cre.Executor) (cre.Executor, error) {
	if exec.ID == "" {
		exec.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	exec.CreatedAt = now
	exec.UpdatedAt = now

	metaJSON, err := json.Marshal(exec.Metadata)
	if err != nil {
		return cre.Executor{}, err
	}
	tagsJSON, err := json.Marshal(exec.Tags)
	if err != nil {
		return cre.Executor{}, err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO app_cre_executors (id, account_id, name, type, endpoint, metadata, tags, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, exec.ID, exec.AccountID, exec.Name, exec.Type, exec.Endpoint, metaJSON, tagsJSON, exec.CreatedAt, exec.UpdatedAt)
	if err != nil {
		return cre.Executor{}, err
	}
	return exec, nil
}

func (s *Store) UpdateExecutor(ctx context.Context, exec cre.Executor) (cre.Executor, error) {
	existing, err := s.GetExecutor(ctx, exec.ID)
	if err != nil {
		return cre.Executor{}, err
	}
	exec.CreatedAt = existing.CreatedAt
	exec.UpdatedAt = time.Now().UTC()

	metaJSON, err := json.Marshal(exec.Metadata)
	if err != nil {
		return cre.Executor{}, err
	}
	tagsJSON, err := json.Marshal(exec.Tags)
	if err != nil {
		return cre.Executor{}, err
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE app_cre_executors
		SET name = $2, type = $3, endpoint = $4, metadata = $5, tags = $6, updated_at = $7
		WHERE id = $1
	`, exec.ID, exec.Name, exec.Type, exec.Endpoint, metaJSON, tagsJSON, exec.UpdatedAt)
	if err != nil {
		return cre.Executor{}, err
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		return cre.Executor{}, sql.ErrNoRows
	}
	return exec, nil
}

func (s *Store) GetExecutor(ctx context.Context, id string) (cre.Executor, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, name, type, endpoint, metadata, tags, created_at, updated_at
		FROM app_cre_executors
		WHERE id = $1
	`, id)
	return scanExecutor(row)
}

func (s *Store) ListExecutors(ctx context.Context, accountID string) ([]cre.Executor, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, name, type, endpoint, metadata, tags, created_at, updated_at
		FROM app_cre_executors
		WHERE account_id = $1
		ORDER BY created_at DESC
	`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []cre.Executor
	for rows.Next() {
		exec, err := scanExecutor(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, exec)
	}
	return result, rows.Err()
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanFunctionExecution(scanner rowScanner) (function.Execution, error) {
	var (
		exec        function.Execution
		inputJSON   []byte
		outputJSON  []byte
		logsJSON    []byte
		actionsJSON []byte
		errorText   sql.NullString
		startedAt   time.Time
		completedAt sql.NullTime
		durationNS  sql.NullInt64
	)
	if err := scanner.Scan(&exec.ID, &exec.AccountID, &exec.FunctionID, &inputJSON, &outputJSON, &logsJSON, &actionsJSON, &errorText, &exec.Status, &startedAt, &completedAt, &durationNS); err != nil {
		return function.Execution{}, err
	}
	if len(inputJSON) > 0 {
		_ = json.Unmarshal(inputJSON, &exec.Input)
	}
	if len(outputJSON) > 0 {
		_ = json.Unmarshal(outputJSON, &exec.Output)
	}
	if len(logsJSON) > 0 {
		_ = json.Unmarshal(logsJSON, &exec.Logs)
	}
	if len(actionsJSON) > 0 {
		_ = json.Unmarshal(actionsJSON, &exec.Actions)
	}
	if errorText.Valid {
		exec.Error = errorText.String
	}
	exec.StartedAt = startedAt.UTC()
	if completedAt.Valid {
		exec.CompletedAt = completedAt.Time.UTC()
	}
	if durationNS.Valid {
		exec.Duration = time.Duration(durationNS.Int64)
	}
	return exec, nil
}

func scanGasAccount(scanner rowScanner) (gasbank.Account, error) {
	var (
		acct         gasbank.Account
		wallet       sql.NullString
		lastWithdraw sql.NullTime
		flagsJSON    []byte
		metaJSON     []byte
		createdAt    time.Time
		updatedAt    time.Time
	)
	if err := scanner.Scan(
		&acct.ID,
		&acct.AccountID,
		&wallet,
		&acct.Balance,
		&acct.Available,
		&acct.Pending,
		&acct.Locked,
		&acct.MinBalance,
		&acct.DailyLimit,
		&acct.DailyWithdrawal,
		&acct.NotificationThreshold,
		&acct.RequiredApprovals,
		&flagsJSON,
		&metaJSON,
		&lastWithdraw,
		&createdAt,
		&updatedAt,
	); err != nil {
		return gasbank.Account{}, err
	}
	if wallet.Valid {
		acct.WalletAddress = normalizeWallet(wallet.String)
	}
	if lastWithdraw.Valid {
		acct.LastWithdrawal = lastWithdraw.Time.UTC()
	}
	if len(flagsJSON) > 0 {
		var flags map[string]bool
		if err := json.Unmarshal(flagsJSON, &flags); err == nil {
			acct.Flags = flags
		}
	}
	if len(metaJSON) > 0 {
		var metadata map[string]string
		if err := json.Unmarshal(metaJSON, &metadata); err == nil {
			acct.Metadata = metadata
		}
	}
	acct.CreatedAt = createdAt.UTC()
	acct.UpdatedAt = updatedAt.UTC()
	return acct, nil
}

func scanGasTransaction(scanner rowScanner) (gasbank.Transaction, error) {
	var (
		tx           gasbank.Transaction
		userAccount  sql.NullString
		blockchainID sql.NullString
		fromAddr     sql.NullString
		toAddr       sql.NullString
		notes        sql.NullString
		errMsg       sql.NullString
		scheduleAt   sql.NullTime
		cronExpr     sql.NullString
		approvalJSON []byte
		resolverErr  sql.NullString
		lastAttempt  sql.NullTime
		nextAttempt  sql.NullTime
		deadLetter   sql.NullString
		metadataJSON []byte
		dispatchedAt sql.NullTime
		resolvedAt   sql.NullTime
		completedAt  sql.NullTime
		createdAt    time.Time
		updatedAt    time.Time
	)
	if err := scanner.Scan(
		&tx.ID,
		&tx.AccountID,
		&userAccount,
		&tx.Type,
		&tx.Amount,
		&tx.NetAmount,
		&tx.Status,
		&blockchainID,
		&fromAddr,
		&toAddr,
		&notes,
		&errMsg,
		&scheduleAt,
		&cronExpr,
		&approvalJSON,
		&tx.ResolverAttempt,
		&resolverErr,
		&lastAttempt,
		&nextAttempt,
		&deadLetter,
		&metadataJSON,
		&dispatchedAt,
		&resolvedAt,
		&completedAt,
		&createdAt,
		&updatedAt,
	); err != nil {
		return gasbank.Transaction{}, err
	}
	if userAccount.Valid {
		tx.UserAccountID = userAccount.String
	}
	if blockchainID.Valid {
		tx.BlockchainTxID = blockchainID.String
	}
	if fromAddr.Valid {
		tx.FromAddress = fromAddr.String
	}
	if toAddr.Valid {
		tx.ToAddress = toAddr.String
	}
	if notes.Valid {
		tx.Notes = notes.String
	}
	if errMsg.Valid {
		tx.Error = errMsg.String
	}
	if scheduleAt.Valid {
		tx.ScheduleAt = scheduleAt.Time.UTC()
	}
	if cronExpr.Valid {
		tx.CronExpression = cronExpr.String
	}
	if len(approvalJSON) > 0 {
		var policy gasbank.ApprovalPolicy
		if err := json.Unmarshal(approvalJSON, &policy); err == nil {
			tx.ApprovalPolicy = policy
		}
	}
	if resolverErr.Valid {
		tx.ResolverError = resolverErr.String
	}
	if lastAttempt.Valid {
		tx.LastAttemptAt = lastAttempt.Time.UTC()
	}
	if nextAttempt.Valid {
		tx.NextAttemptAt = nextAttempt.Time.UTC()
	}
	if deadLetter.Valid {
		tx.DeadLetterReason = deadLetter.String
	}
	if len(metadataJSON) > 0 {
		var metadata map[string]string
		if err := json.Unmarshal(metadataJSON, &metadata); err == nil {
			tx.Metadata = metadata
		}
	}
	if dispatchedAt.Valid {
		tx.DispatchedAt = dispatchedAt.Time.UTC()
	}
	if resolvedAt.Valid {
		tx.ResolvedAt = resolvedAt.Time.UTC()
	}
	if completedAt.Valid {
		tx.CompletedAt = completedAt.Time.UTC()
	}
	tx.CreatedAt = createdAt.UTC()
	tx.UpdatedAt = updatedAt.UTC()
	return tx, nil
}

func scanSecret(scanner rowScanner) (secret.Secret, error) {
	var (
		sec       secret.Secret
		createdAt time.Time
		updatedAt time.Time
	)
	if err := scanner.Scan(&sec.ID, &sec.AccountID, &sec.Name, &sec.Value, &sec.Version, &createdAt, &updatedAt); err != nil {
		return secret.Secret{}, err
	}
	sec.CreatedAt = createdAt.UTC()
	sec.UpdatedAt = updatedAt.UTC()
	return sec, nil
}

func toNullString(value string) sql.NullString {
	if strings.TrimSpace(value) == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func normalizeWallet(addr string) string {
	return account.NormalizeWalletAddress(addr)
}

func toNullTime(t time.Time) sql.NullTime {
	if t.IsZero() {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: t.UTC(), Valid: true}
}

func scanPlaybook(scanner rowScanner) (cre.Playbook, error) {
	var (
		pb          cre.Playbook
		stepsJSON   []byte
		tagsJSON    []byte
		metaJSON    []byte
		createdAt   time.Time
		updatedAt   time.Time
		description sql.NullString
	)
	if err := scanner.Scan(&pb.ID, &pb.AccountID, &pb.Name, &description, &stepsJSON, &tagsJSON, &metaJSON, &createdAt, &updatedAt); err != nil {
		return cre.Playbook{}, err
	}
	if description.Valid {
		pb.Description = description.String
	}
	if len(stepsJSON) > 0 {
		if err := json.Unmarshal(stepsJSON, &pb.Steps); err != nil {
			return cre.Playbook{}, err
		}
	}
	if len(tagsJSON) > 0 {
		_ = json.Unmarshal(tagsJSON, &pb.Tags)
	}
	if len(metaJSON) > 0 {
		_ = json.Unmarshal(metaJSON, &pb.Metadata)
	}
	pb.CreatedAt = createdAt.UTC()
	pb.UpdatedAt = updatedAt.UTC()
	return pb, nil
}

func scanRun(scanner rowScanner) (cre.Run, error) {
	var (
		run         cre.Run
		executorID  sql.NullString
		paramsJSON  []byte
		tagsJSON    []byte
		resultsJSON []byte
		metaJSON    []byte
		createdAt   time.Time
		updatedAt   time.Time
		completedAt sql.NullTime
	)
	if err := scanner.Scan(&run.ID, &run.AccountID, &run.PlaybookID, &executorID, &run.Status, &paramsJSON, &tagsJSON, &resultsJSON, &metaJSON, &createdAt, &updatedAt, &completedAt); err != nil {
		return cre.Run{}, err
	}
	if executorID.Valid {
		run.ExecutorID = executorID.String
	}
	if len(paramsJSON) > 0 {
		_ = json.Unmarshal(paramsJSON, &run.Parameters)
	}
	if len(tagsJSON) > 0 {
		_ = json.Unmarshal(tagsJSON, &run.Tags)
	}
	if len(resultsJSON) > 0 {
		_ = json.Unmarshal(resultsJSON, &run.Results)
	}
	if len(metaJSON) > 0 {
		_ = json.Unmarshal(metaJSON, &run.Metadata)
	}
	run.CreatedAt = createdAt.UTC()
	run.UpdatedAt = updatedAt.UTC()
	if completedAt.Valid {
		c := completedAt.Time.UTC()
		run.CompletedAt = &c
	}
	return run, nil
}

func scanExecutor(scanner rowScanner) (cre.Executor, error) {
	var (
		exec      cre.Executor
		metaJSON  []byte
		tagsJSON  []byte
		createdAt time.Time
		updatedAt time.Time
	)
	if err := scanner.Scan(&exec.ID, &exec.AccountID, &exec.Name, &exec.Type, &exec.Endpoint, &metaJSON, &tagsJSON, &createdAt, &updatedAt); err != nil {
		return cre.Executor{}, err
	}
	if len(metaJSON) > 0 {
		_ = json.Unmarshal(metaJSON, &exec.Metadata)
	}
	if len(tagsJSON) > 0 {
		_ = json.Unmarshal(tagsJSON, &exec.Tags)
	}
	exec.CreatedAt = createdAt.UTC()
	exec.UpdatedAt = updatedAt.UTC()
	return exec, nil
}

func ptrTime(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}
