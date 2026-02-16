-- Migration 041: Atomic operations for GasBank service
--
-- Replaces the read-check-write-rollback pattern in the Go service with
-- database-level atomicity using SELECT ... FOR UPDATE row locking.
-- This eliminates race conditions that the Go mutex could not prevent
-- across multiple service instances.
--
-- Functions:
--   gasbank_atomic_deduct  - atomic fee deduction
--   gasbank_atomic_credit  - atomic deposit credit (with idempotency)
--   gasbank_atomic_reserve - atomic fund reservation
--   gasbank_atomic_release - atomic release/commit of reserved funds

-- Atomic fee deduction for GasBank service
-- Prevents race conditions by using row-level locking
CREATE OR REPLACE FUNCTION gasbank_atomic_deduct(
    p_user_id UUID,
    p_amount BIGINT,
    p_service_id TEXT,
    p_reference_id TEXT DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance BIGINT, transaction_id UUID, error_message TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_account_id UUID;
    v_balance BIGINT;
    v_reserved BIGINT;
    v_available BIGINT;
    v_new_balance BIGINT;
    v_tx_id UUID;
BEGIN
    -- Lock the row
    SELECT id, balance, reserved INTO v_account_id, v_balance, v_reserved
    FROM gasbank_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::BIGINT, NULL::UUID, 'account not found'::TEXT;
        RETURN;
    END IF;

    v_available := v_balance - v_reserved;
    IF v_available < p_amount THEN
        RETURN QUERY SELECT false, v_balance, NULL::UUID,
            format('insufficient balance: available %s, required %s', v_available, p_amount)::TEXT;
        RETURN;
    END IF;

    v_new_balance := v_balance - p_amount;
    v_tx_id := gen_random_uuid();

    UPDATE gasbank_accounts
    SET balance = v_new_balance, updated_at = NOW()
    WHERE id = v_account_id;

    INSERT INTO gasbank_transactions (id, account_id, tx_type, amount, balance_after, reference_id, created_at)
    VALUES (v_tx_id, v_account_id, 'service_fee', -p_amount, v_new_balance, p_reference_id, NOW());

    RETURN QUERY SELECT true, v_new_balance, v_tx_id, NULL::TEXT;
END;
$$;

-- Atomic deposit credit
CREATE OR REPLACE FUNCTION gasbank_atomic_credit(
    p_user_id UUID,
    p_amount BIGINT,
    p_tx_hash TEXT,
    p_from_address TEXT,
    p_reference_id TEXT DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance BIGINT, transaction_id UUID, error_message TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_account_id UUID;
    v_balance BIGINT;
    v_reserved BIGINT;
    v_new_balance BIGINT;
    v_tx_id UUID;
    v_existing_count INT;
BEGIN
    SELECT id, balance, reserved INTO v_account_id, v_balance, v_reserved
    FROM gasbank_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::BIGINT, NULL::UUID, 'account not found'::TEXT;
        RETURN;
    END IF;

    -- Idempotency check: skip if deposit already credited
    SELECT COUNT(*) INTO v_existing_count
    FROM gasbank_transactions
    WHERE account_id = v_account_id AND reference_id = p_reference_id AND tx_type = 'deposit';

    IF v_existing_count > 0 THEN
        RETURN QUERY SELECT true, v_balance, NULL::UUID, 'already credited'::TEXT;
        RETURN;
    END IF;

    v_new_balance := v_balance + p_amount;
    v_tx_id := gen_random_uuid();

    UPDATE gasbank_accounts
    SET balance = v_new_balance, updated_at = NOW()
    WHERE id = v_account_id;

    INSERT INTO gasbank_transactions (id, account_id, tx_type, amount, balance_after, reference_id, created_at)
    VALUES (v_tx_id, v_account_id, 'deposit', p_amount, v_new_balance, p_reference_id, NOW());

    RETURN QUERY SELECT true, v_new_balance, v_tx_id, NULL::TEXT;
END;
$$;

-- Atomic reserve funds
CREATE OR REPLACE FUNCTION gasbank_atomic_reserve(
    p_user_id UUID,
    p_amount BIGINT
) RETURNS TABLE(success BOOLEAN, new_balance BIGINT, new_reserved BIGINT, error_message TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_balance BIGINT;
    v_reserved BIGINT;
    v_available BIGINT;
    v_new_reserved BIGINT;
BEGIN
    SELECT balance, reserved INTO v_balance, v_reserved
    FROM gasbank_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::BIGINT, 0::BIGINT, 'account not found'::TEXT;
        RETURN;
    END IF;

    v_available := v_balance - v_reserved;
    IF v_available < p_amount THEN
        RETURN QUERY SELECT false, v_balance, v_reserved, 'insufficient available balance'::TEXT;
        RETURN;
    END IF;

    v_new_reserved := v_reserved + p_amount;

    UPDATE gasbank_accounts
    SET reserved = v_new_reserved, updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT true, v_balance, v_new_reserved, NULL::TEXT;
END;
$$;

-- Atomic release (or commit) reserved funds
CREATE OR REPLACE FUNCTION gasbank_atomic_release(
    p_user_id UUID,
    p_amount BIGINT,
    p_commit BOOLEAN DEFAULT false
) RETURNS TABLE(success BOOLEAN, new_balance BIGINT, new_reserved BIGINT, error_message TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_balance BIGINT;
    v_reserved BIGINT;
    v_new_balance BIGINT;
    v_new_reserved BIGINT;
BEGIN
    SELECT balance, reserved INTO v_balance, v_reserved
    FROM gasbank_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::BIGINT, 0::BIGINT, 'account not found'::TEXT;
        RETURN;
    END IF;

    IF v_reserved < p_amount THEN
        RETURN QUERY SELECT false, v_balance, v_reserved, 'insufficient reserved funds'::TEXT;
        RETURN;
    END IF;

    v_new_reserved := v_reserved - p_amount;
    v_new_balance := v_balance;
    IF p_commit THEN
        v_new_balance := v_balance - p_amount;
    END IF;

    UPDATE gasbank_accounts
    SET balance = v_new_balance, reserved = v_new_reserved, updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT true, v_new_balance, v_new_reserved, NULL::TEXT;
END;
$$;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION gasbank_atomic_deduct(UUID, BIGINT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION gasbank_atomic_credit(UUID, BIGINT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION gasbank_atomic_reserve(UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION gasbank_atomic_release(UUID, BIGINT, BOOLEAN) TO service_role;
