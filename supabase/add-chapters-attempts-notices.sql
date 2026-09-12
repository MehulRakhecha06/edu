-- ============================================================
-- Migration: chapter tags, retake limits, practice mode, notices
-- Run ONCE in Supabase -> SQL Editor if your database was set up
-- BEFORE this feature. Fresh installs using schema.sql already
-- have everything.
-- ============================================================

-- Documents get an optional chapter tag ("Chapter 2", "Unit 3"…)
ALTER TABLE public.pdf_documents
  ADD COLUMN IF NOT EXISTS chapter TEXT NOT NULL DEFAULT '';

-- Tests get a retake policy and a practice flag
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1
    CHECK (max_attempts BETWEEN 0 AND 10),   -- 0 = unlimited
  ADD COLUMN IF NOT EXISTS is_practice BOOLEAN NOT NULL DEFAULT FALSE;

-- Teacher notices shown on the student dashboard
CREATE TABLE IF NOT EXISTS public.notices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notices FROM anon, authenticated;
