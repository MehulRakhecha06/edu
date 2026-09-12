-- ============================================================
-- EduMock AI — migration: admin AI settings
-- Run this ONLY if your database was set up BEFORE the
-- "admin chooses the AI provider" feature was added
-- (i.e. you ran supabase/schema.sql from an earlier version).
-- Fresh installs don't need this — schema.sql already includes it.
--
-- Creates the table that stores the admin's AI provider choice
-- made on the /admin/ai page.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Same security model as every other table: RLS on, no policies,
-- anon/authenticated can do nothing — only the server's service-role key.
REVOKE ALL ON public.app_settings FROM anon, authenticated;
