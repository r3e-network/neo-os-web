-- =============================================================================
-- Remove NeoVault / Mixer legacy schema
--
-- The NeoVault (privacy mixing) service is out of scope for the current Service
-- Layer. This migration drops the associated tables and enum types introduced
-- by earlier migrations so fresh deployments do not carry unused schema.
-- =============================================================================

DROP TABLE IF EXISTS public.neovault_audit_log CASCADE;
DROP TABLE IF EXISTS public.neovault_registrations CASCADE;
DROP TABLE IF EXISTS public.neovault_requests CASCADE;
DROP TABLE IF EXISTS public.mixer_requests CASCADE;

DROP TYPE IF EXISTS public.neovault_registration_status;
