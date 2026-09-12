-- ============================================================
-- EduMock AI — migration: subjects, multi-bank tests & passing criteria
-- Run this ONLY if your database was set up BEFORE these features
-- were added (uploading multiple subject files, balanced multi-subject
-- tests, teacher-set passing criteria).
-- Fresh installs don't need this — schema.sql already includes it.
-- ============================================================

-- Documents can be tagged with a subject (Math, Science, …)
ALTER TABLE public.pdf_documents
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'General';

-- Tests can combine several question banks (multi-subject) …
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS document_ids JSONB NOT NULL DEFAULT '[]';

-- … and carry the teacher's passing criteria (percentage)
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS passing_percentage INTEGER NOT NULL DEFAULT 40;

ALTER TABLE public.tests
  DROP CONSTRAINT IF EXISTS tests_passing_percentage_check;
ALTER TABLE public.tests
  ADD CONSTRAINT tests_passing_percentage_check
  CHECK (passing_percentage BETWEEN 1 AND 100);
