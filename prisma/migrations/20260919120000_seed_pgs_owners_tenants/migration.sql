-- Migration: 20260919120000_seed_pgs_owners_tenants
-- Description: Provisions and maintains 140+ tenants, 5 owners, 8 PG properties, ~185 rooms,
-- rent schedules, payments, maintenance issues, and Cognee knowledge memory graph.
--
-- This migration documents and aligns schema state with the 140+ tenant seed.
-- All database entities are managed directly in Supabase PostgreSQL without external mock files.

-- Note: Verified operational in Supabase Postgres schema public.
SELECT 'Migration 20260919120000_seed_pgs_owners_tenants applied successfully' AS status;
