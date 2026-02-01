--
-- PostgreSQL database dump
--

\restrict tryHTdcUzO3Lgpbyz0YshBA2D57d8NlAQNB6rEcXHl4eeU92GDPyDCHGbXNwLUH

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: aal_level; Type: TYPE; Schema: public; Owner: supabase_admin
--

CREATE TYPE public.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE public.aal_level OWNER TO supabase_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: public; Owner: supabase_admin
--

CREATE TYPE public.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE public.code_challenge_method OWNER TO supabase_admin;

--
-- Name: factor_status; Type: TYPE; Schema: public; Owner: supabase_admin
--

CREATE TYPE public.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE public.factor_status OWNER TO supabase_admin;

--
-- Name: factor_type; Type: TYPE; Schema: public; Owner: supabase_admin
--

CREATE TYPE public.factor_type AS ENUM (
    'totp',
    'webauthn'
);


ALTER TYPE public.factor_type OWNER TO supabase_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: public; Owner: supabase_admin
--

CREATE TYPE public.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE public.one_time_token_type OWNER TO supabase_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attestation_artifacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attestation_artifacts (
    id bigint NOT NULL,
    service_name text NOT NULL,
    artifact_type text NOT NULL,
    artifact_hash text NOT NULL,
    artifact_data bytea NOT NULL,
    public_key text,
    key_id text,
    measurement_hash text,
    policy_hash text,
    metadata jsonb,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attestation_artifacts_type_check CHECK ((artifact_type = ANY (ARRAY['quote'::text, 'report'::text, 'certificate'::text, 'manifest'::text])))
);


ALTER TABLE public.attestation_artifacts OWNER TO postgres;

--
-- Name: attestation_artifacts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attestation_artifacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.attestation_artifacts_id_seq OWNER TO postgres;

--
-- Name: attestation_artifacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attestation_artifacts_id_seq OWNED BY public.attestation_artifacts.id;


--
-- Name: chain_txs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chain_txs (
    id bigint NOT NULL,
    request_id text NOT NULL,
    service text NOT NULL,
    tx_hash text,
    status text DEFAULT 'pending'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chain_txs OWNER TO postgres;

--
-- Name: chain_txs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chain_txs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chain_txs_id_seq OWNER TO postgres;

--
-- Name: chain_txs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chain_txs_id_seq OWNED BY public.chain_txs.id;


--
-- Name: contract_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contract_events (
    id bigint NOT NULL,
    app_id text NOT NULL,
    event_name text NOT NULL,
    tx_hash text,
    block_number bigint,
    data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contract_events OWNER TO postgres;

--
-- Name: contract_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.contract_events_id_seq OWNER TO postgres;

--
-- Name: contract_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_events_id_seq OWNED BY public.contract_events.id;


--
-- Name: datafeed_prices; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.datafeed_prices (
    id integer NOT NULL,
    symbol text NOT NULL,
    price numeric NOT NULL,
    sources text[],
    confidence numeric,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.datafeed_prices OWNER TO supabase_admin;

--
-- Name: datafeed_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.datafeed_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.datafeed_prices_id_seq OWNER TO supabase_admin;

--
-- Name: datafeed_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: supabase_admin
--

ALTER SEQUENCE public.datafeed_prices_id_seq OWNED BY public.datafeed_prices.id;


--
-- Name: oracle_prices; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.oracle_prices (
    id integer NOT NULL,
    symbol text NOT NULL,
    price numeric NOT NULL,
    volume numeric,
    source text,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.oracle_prices OWNER TO supabase_admin;

--
-- Name: oracle_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.oracle_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.oracle_prices_id_seq OWNER TO supabase_admin;

--
-- Name: oracle_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: supabase_admin
--

ALTER SEQUENCE public.oracle_prices_id_seq OWNED BY public.oracle_prices.id;


--
-- Name: pool_account_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pool_account_balances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    account_id uuid NOT NULL,
    token text,
    balance bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    token_type text,
    script_hash text,
    amount bigint DEFAULT 0,
    decimals integer DEFAULT 8
);


ALTER TABLE public.pool_account_balances OWNER TO postgres;

--
-- Name: pool_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pool_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    address text NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    tx_count bigint DEFAULT 0 NOT NULL,
    is_retiring boolean DEFAULT false NOT NULL,
    locked_by text,
    locked_at timestamp with time zone
);


ALTER TABLE public.pool_accounts OWNER TO postgres;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.schema_migrations (
    version character varying(14) NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO supabase_admin;

--
-- Name: signer_key_rotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.signer_key_rotations (
    id bigint NOT NULL,
    key_id text NOT NULL,
    public_key text NOT NULL,
    attestation_hash text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    registry_tx_hash text,
    activated_at timestamp with time zone,
    overlap_ends_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT signer_key_rotations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'overlapping'::text, 'revoked'::text])))
);


ALTER TABLE public.signer_key_rotations OWNER TO postgres;

--
-- Name: signer_key_rotations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.signer_key_rotations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.signer_key_rotations_id_seq OWNER TO postgres;

--
-- Name: signer_key_rotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.signer_key_rotations_id_seq OWNED BY public.signer_key_rotations.id;


--
-- Name: simulation_txs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.simulation_txs (
    id bigint NOT NULL,
    app_id text NOT NULL,
    account_address text NOT NULL,
    tx_type text NOT NULL,
    amount bigint NOT NULL,
    status text DEFAULT 'simulated'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tx_hash text
);


ALTER TABLE public.simulation_txs OWNER TO postgres;

--
-- Name: simulation_txs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.simulation_txs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.simulation_txs_id_seq OWNER TO postgres;

--
-- Name: simulation_txs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.simulation_txs_id_seq OWNED BY public.simulation_txs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    address character varying(64),
    email character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: attestation_artifacts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attestation_artifacts ALTER COLUMN id SET DEFAULT nextval('public.attestation_artifacts_id_seq'::regclass);


--
-- Name: chain_txs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chain_txs ALTER COLUMN id SET DEFAULT nextval('public.chain_txs_id_seq'::regclass);


--
-- Name: contract_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_events ALTER COLUMN id SET DEFAULT nextval('public.contract_events_id_seq'::regclass);


--
-- Name: datafeed_prices id; Type: DEFAULT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.datafeed_prices ALTER COLUMN id SET DEFAULT nextval('public.datafeed_prices_id_seq'::regclass);


--
-- Name: oracle_prices id; Type: DEFAULT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.oracle_prices ALTER COLUMN id SET DEFAULT nextval('public.oracle_prices_id_seq'::regclass);


--
-- Name: signer_key_rotations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signer_key_rotations ALTER COLUMN id SET DEFAULT nextval('public.signer_key_rotations_id_seq'::regclass);


--
-- Name: simulation_txs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.simulation_txs ALTER COLUMN id SET DEFAULT nextval('public.simulation_txs_id_seq'::regclass);


--
-- Name: pool_account_balances account_balances_account_id_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pool_account_balances
    ADD CONSTRAINT account_balances_account_id_token_key UNIQUE (account_id, token);


--
-- Name: pool_account_balances account_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pool_account_balances
    ADD CONSTRAINT account_balances_pkey PRIMARY KEY (id);


--
-- Name: attestation_artifacts attestation_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attestation_artifacts
    ADD CONSTRAINT attestation_artifacts_pkey PRIMARY KEY (id);


--
-- Name: chain_txs chain_txs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chain_txs
    ADD CONSTRAINT chain_txs_pkey PRIMARY KEY (id);


--
-- Name: contract_events contract_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_events
    ADD CONSTRAINT contract_events_pkey PRIMARY KEY (id);


--
-- Name: datafeed_prices datafeed_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.datafeed_prices
    ADD CONSTRAINT datafeed_prices_pkey PRIMARY KEY (id);


--
-- Name: oracle_prices oracle_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.oracle_prices
    ADD CONSTRAINT oracle_prices_pkey PRIMARY KEY (id);


--
-- Name: pool_accounts pool_accounts_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pool_accounts
    ADD CONSTRAINT pool_accounts_address_key UNIQUE (address);


--
-- Name: pool_accounts pool_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pool_accounts
    ADD CONSTRAINT pool_accounts_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: signer_key_rotations signer_key_rotations_key_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signer_key_rotations
    ADD CONSTRAINT signer_key_rotations_key_id_key UNIQUE (key_id);


--
-- Name: signer_key_rotations signer_key_rotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signer_key_rotations
    ADD CONSTRAINT signer_key_rotations_pkey PRIMARY KEY (id);


--
-- Name: simulation_txs simulation_txs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.simulation_txs
    ADD CONSTRAINT simulation_txs_pkey PRIMARY KEY (id);


--
-- Name: users users_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_address_key UNIQUE (address);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: account_balances_account_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX account_balances_account_idx ON public.pool_account_balances USING btree (account_id);


--
-- Name: account_balances_token_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX account_balances_token_idx ON public.pool_account_balances USING btree (token);


--
-- Name: attestation_artifacts_key_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX attestation_artifacts_key_id_idx ON public.attestation_artifacts USING btree (key_id);


--
-- Name: attestation_artifacts_service_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX attestation_artifacts_service_idx ON public.attestation_artifacts USING btree (service_name);


--
-- Name: chain_txs_request_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chain_txs_request_idx ON public.chain_txs USING btree (request_id);


--
-- Name: chain_txs_service_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chain_txs_service_idx ON public.chain_txs USING btree (service);


--
-- Name: chain_txs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chain_txs_status_idx ON public.chain_txs USING btree (status);


--
-- Name: contract_events_app_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contract_events_app_idx ON public.contract_events USING btree (app_id);


--
-- Name: contract_events_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contract_events_event_idx ON public.contract_events USING btree (event_name);


--
-- Name: idx_datafeed_prices_symbol; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE INDEX idx_datafeed_prices_symbol ON public.datafeed_prices USING btree (symbol);


--
-- Name: idx_oracle_prices_symbol; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE INDEX idx_oracle_prices_symbol ON public.oracle_prices USING btree (symbol);


--
-- Name: idx_users_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_address ON public.users USING btree (address);


--
-- Name: pool_accounts_is_retiring_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pool_accounts_is_retiring_idx ON public.pool_accounts USING btree (is_retiring);


--
-- Name: pool_accounts_locked_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pool_accounts_locked_by_idx ON public.pool_accounts USING btree (locked_by);


--
-- Name: schema_migrations_version_idx; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE UNIQUE INDEX schema_migrations_version_idx ON public.schema_migrations USING btree (version);


--
-- Name: signer_key_rotations_activated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX signer_key_rotations_activated_at_idx ON public.signer_key_rotations USING btree (activated_at DESC);


--
-- Name: signer_key_rotations_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX signer_key_rotations_status_idx ON public.signer_key_rotations USING btree (status);


--
-- Name: simulation_txs_app_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX simulation_txs_app_idx ON public.simulation_txs USING btree (app_id);


--
-- Name: simulation_txs_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX simulation_txs_created_idx ON public.simulation_txs USING btree (created_at DESC);


--
-- Name: pool_account_balances account_balances_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pool_account_balances
    ADD CONSTRAINT account_balances_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.pool_accounts(id) ON DELETE CASCADE;


--
-- Name: chain_txs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chain_txs ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

--
-- Name: chain_txs service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY service_all ON public.chain_txs TO service_role USING (true);


--
-- Name: contract_events service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY service_all ON public.contract_events TO service_role USING (true);


--
-- Name: pool_account_balances service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY service_all ON public.pool_account_balances TO service_role USING (true);


--
-- Name: pool_accounts service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY service_all ON public.pool_accounts TO service_role USING (true);


--
-- Name: simulation_txs service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY service_all ON public.simulation_txs TO service_role USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;


--
-- Name: TABLE chain_txs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.chain_txs TO authenticated;
GRANT SELECT ON TABLE public.chain_txs TO anon;
GRANT ALL ON TABLE public.chain_txs TO service_role;


--
-- Name: SEQUENCE chain_txs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.chain_txs_id_seq TO service_role;


--
-- Name: TABLE contract_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.contract_events TO authenticated;
GRANT SELECT ON TABLE public.contract_events TO anon;
GRANT ALL ON TABLE public.contract_events TO service_role;


--
-- Name: SEQUENCE contract_events_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.contract_events_id_seq TO service_role;


--
-- Name: TABLE datafeed_prices; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.datafeed_prices TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.datafeed_prices TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.datafeed_prices TO authenticated;


--
-- Name: SEQUENCE datafeed_prices_id_seq; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT SELECT,USAGE ON SEQUENCE public.datafeed_prices_id_seq TO service_role;


--
-- Name: TABLE oracle_prices; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.oracle_prices TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.oracle_prices TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.oracle_prices TO authenticated;


--
-- Name: SEQUENCE oracle_prices_id_seq; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT SELECT,USAGE ON SEQUENCE public.oracle_prices_id_seq TO service_role;


--
-- Name: TABLE pool_account_balances; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.pool_account_balances TO authenticated;
GRANT SELECT ON TABLE public.pool_account_balances TO anon;
GRANT ALL ON TABLE public.pool_account_balances TO service_role;


--
-- Name: TABLE pool_accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.pool_accounts TO authenticated;
GRANT SELECT ON TABLE public.pool_accounts TO anon;
GRANT ALL ON TABLE public.pool_accounts TO service_role;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.schema_migrations TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.schema_migrations TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.schema_migrations TO authenticated;


--
-- Name: TABLE simulation_txs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.simulation_txs TO authenticated;
GRANT SELECT ON TABLE public.simulation_txs TO anon;
GRANT ALL ON TABLE public.simulation_txs TO service_role;


--
-- Name: SEQUENCE simulation_txs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.simulation_txs_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO authenticated;


--
-- PostgreSQL database dump complete
--

\unrestrict tryHTdcUzO3Lgpbyz0YshBA2D57d8NlAQNB6rEcXHl4eeU92GDPyDCHGbXNwLUH

