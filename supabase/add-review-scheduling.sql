-- ============================================================
-- Migration: question review queue, test scheduling, edits
-- Run ONCE in Supabase -> SQL Editor if your database was set
-- up BEFORE this feature. Fresh installs using schema.sql
-- already have everything.
-- ============================================================

-- Questions: review workflow + answer-less drafts
ALTER TABLE public.questions
  ALTER COLUMN correct_answer SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved'));

-- Tests: optional availability window (scheduling)
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_to   TIMESTAMPTZ;
