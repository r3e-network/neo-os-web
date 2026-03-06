-- =============================================================================
-- Neo Service Layer - OAuth User Support
-- Allows users created via OAuth to exist before a Neo N3 wallet is bound.
-- =============================================================================

-- Users can be created with email-only (OAuth) and later bind a wallet.
ALTER TABLE public.users
    ALTER COLUMN address DROP NOT NULL;

-- Wallet addresses must be globally unique so wallet-based login is unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_address_unique
    ON public.user_wallets (address);

