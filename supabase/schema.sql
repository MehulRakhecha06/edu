-- ============================================================
-- EduMock AI — Supabase schema (fresh install)
-- Run this in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================
-- SECURITY MODEL
--   * Row Level Security is ENABLED on every table with NO public
--     policies. Anonymous/authenticated clients can do NOTHING.
--   * The app talks to Supabase only from the SERVER using the
--     service-role key (bypasses RLS). The key never reaches the
--     browser, so this is safe — and it means you never have to
--     write RLS policies for this app.
-- ============================================================

-- ⚠️ OPTIONAL CLEAN SLATE: uncomment to wipe ALL EduMock tables first
-- (destroys every user, document, question, test and attempt)
-- DROP TABLE IF EXISTS attempt_answers, test_attempts, tests, questions,
--   pdf_documents, users, profiles CASCADE;

-- ---------- users ------------------------------------------------
-- Note: this is the app's own users table (passwords hashed with
-- bcrypt by the app). We do NOT use Supabase Auth.
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'STUDENT'
                CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- question bank documents ------------------------------
-- file_kind: 'pdf' (text PDF) | 'pdf-scan' (scanned, image pages) |
--            'image' (photo of a paper) | 'docx' | 'text'
-- file_data: base64 bytes for images & scans (AI vision reads them);
--            NULL for text-based documents.
CREATE TABLE IF NOT EXISTS public.pdf_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT 'General',
  chapter     TEXT NOT NULL DEFAULT '',          -- e.g. "Chapter 2" (optional tag)
  raw_text    TEXT NOT NULL DEFAULT '',
  file_kind   TEXT NOT NULL DEFAULT 'text',
  file_mime   TEXT,
  file_data   TEXT,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- questions (exact text from the PDF) ------------------
CREATE TABLE IF NOT EXISTS public.questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES public.pdf_documents(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  options        JSONB NOT NULL,          -- ["Option A", "Option B", ...]
  correct_answer TEXT NOT NULL DEFAULT '',-- "A" | "B" | ... ("" = draft, key missing)
  status         TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS questions_document_idx ON public.questions(document_id);

-- ---------- tests -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  document_id         UUID REFERENCES public.pdf_documents(id) ON DELETE SET NULL,
  document_ids        JSONB NOT NULL DEFAULT '[]',  -- multi-bank (multi-subject) tests
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  time_limit_minutes  INTEGER NOT NULL DEFAULT 30 CHECK (time_limit_minutes BETWEEN 1 AND 180),
  passing_percentage  INTEGER NOT NULL DEFAULT 40 CHECK (passing_percentage BETWEEN 1 AND 100),
  max_attempts        INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 0 AND 10), -- 0 = unlimited
  is_practice         BOOLEAN NOT NULL DEFAULT FALSE,   -- practice = unlimited retakes
  available_from      TIMESTAMPTZ,                       -- optional schedule window
  available_to        TIMESTAMPTZ,
  question_ids        JSONB NOT NULL DEFAULT '[]',  -- ordered list of question ids
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- attempts & answers ------------------------------------
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id     UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS attempts_test_idx ON public.test_attempts(test_id);
CREATE INDEX IF NOT EXISTS attempts_student_idx ON public.test_attempts(student_id);

CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id     UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  selected_option TEXT,
  is_correct      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS answers_attempt_idx ON public.attempt_answers(attempt_id);

-- ---------- notices (teacher announcements on the student dashboard) --
CREATE TABLE IF NOT EXISTS public.notices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- app settings (e.g. which AI provider the admin chose) --
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- lock everything down -----------------------------------
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices         ENABLE ROW LEVEL SECURITY;

-- No policies are created on purpose: with RLS enabled and zero
-- policies, the public anon/authenticated keys have no access at all.
-- Only the service-role key (server-side only) can read/write.

-- Belt & suspenders: also revoke direct grants from anon/authenticated.
REVOKE ALL ON public.users, public.pdf_documents, public.questions,
  public.tests, public.test_attempts, public.attempt_answers, public.app_settings,
  public.notices
FROM anon, authenticated;

-- ============================================================
-- DONE. Next steps:
--   1. Copy .env.example to .env.local and fill in your Supabase
--      URL + service-role key + a random AUTH_SECRET.
--   2. Create the first admin:  npm run seed
-- ============================================================
