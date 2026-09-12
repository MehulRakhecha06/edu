-- ============================================================
-- Migration: image & scanned-PDF question banks (AI vision)
-- Run ONCE in Supabase -> SQL Editor if your database was set up
-- BEFORE this feature. Fresh installs using schema.sql already
-- have these columns.
-- ============================================================

ALTER TABLE public.pdf_documents
  ADD COLUMN IF NOT EXISTS file_kind TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS file_mime TEXT,
  ADD COLUMN IF NOT EXISTS file_data TEXT;

-- Old rows keep working: they are text-based documents.
UPDATE public.pdf_documents
SET file_kind = 'pdf'
WHERE file_kind = 'text' AND raw_text <> '';
