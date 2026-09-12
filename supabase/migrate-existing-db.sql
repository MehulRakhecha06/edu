-- ============================================================
-- EduMock AI — bring an EXISTING Supabase database up to date
-- ============================================================
-- Run this ONCE in Supabase -> SQL Editor if your database was
-- created from an older version of schema.sql and you see errors
-- like: "column pdf_documents.file_kind does not exist".
--
-- It combines ALL migrations (add-subjects-passing, add-chapters-
-- attempts-notices, add-review-scheduling, add-image-files,
-- add-ai-settings) and every statement is guarded with IF NOT
-- EXISTS, so it is safe to run on a database of ANY age — even
-- one that already has some of these columns. Nothing is deleted;
-- all changes are additive. Fresh installs using the current
-- schema.sql do NOT need this file.
-- ============================================================

-- ---------- 1. Subjects, multi-bank tests & passing criteria ----------
ALTER TABLE public.pdf_documents
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'General';

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS document_ids JSONB NOT NULL DEFAULT '[]';

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS passing_percentage INTEGER NOT NULL DEFAULT 40;

ALTER TABLE public.tests
  DROP CONSTRAINT IF EXISTS tests_passing_percentage_check;
ALTER TABLE public.tests
  ADD CONSTRAINT tests_passing_percentage_check
  CHECK (passing_percentage BETWEEN 1 AND 100);

-- ---------- 2. Chapters, retakes, practice mode, notices ----------
ALTER TABLE public.pdf_documents
  ADD COLUMN IF NOT EXISTS chapter TEXT NOT NULL DEFAULT '';

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1
    CHECK (max_attempts BETWEEN 0 AND 10),   -- 0 = unlimited
  ADD COLUMN IF NOT EXISTS is_practice BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.notices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notices FROM anon, authenticated;

-- ---------- 3. Question review queue & test scheduling ----------
ALTER TABLE public.questions
  ALTER COLUMN correct_answer SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved'));

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_to   TIMESTAMPTZ;

-- ---------- 4. Image & scanned-PDF question banks (AI vision) ----------
ALTER TABLE public.pdf_documents
  ADD COLUMN IF NOT EXISTS file_kind TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS file_mime TEXT,
  ADD COLUMN IF NOT EXISTS file_data TEXT;

-- Old rows keep working: they are text-based documents.
UPDATE public.pdf_documents
SET file_kind = 'pdf'
WHERE file_kind = 'text' AND raw_text <> '';

-- ---------- 5. Admin AI provider settings (/admin/ai) ----------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;
