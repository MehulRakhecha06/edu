/**
 * Supabase store — used when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * are configured. Every call runs SERVER-SIDE with the service role key,
 * which bypasses Row Level Security. That is safe here because this module is
 * only ever imported by API routes / server components — the key never reaches
 * the browser. RLS can therefore stay ENABLED on every table with zero public
 * policies: anonymous clients can read nothing.
 *
 * Column names match supabase/schema.sql exactly.
 */

import { createClient } from '@supabase/supabase-js';

let client = null;

function sb() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// snake_case row -> camelCase object
const mapUser = (r) =>
  r && {
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.password_hash,
    role: r.role,
    createdAt: r.created_at,
  };

const mapDoc = (r) =>
  r && {
    id: r.id,
    filename: r.filename,
    subject: r.subject || 'General',
    chapter: r.chapter || '',
    rawText: r.raw_text,
    fileKind: r.file_kind || 'text',
    fileMime: r.file_mime || null,
    fileData: r.file_data || null,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
  };

const mapQuestion = (r) =>
  r && {
    id: r.id,
    documentId: r.document_id,
    questionText: r.question_text,
    options: r.options || [],
    correctAnswer: r.correct_answer,
    status: r.status || 'approved',
    createdAt: r.created_at,
  };

const mapTest = (r) =>
  r && {
    id: r.id,
    title: r.title,
    documentId: r.document_id,
    documentIds: r.document_ids || (r.document_id ? [r.document_id] : []),
    createdBy: r.created_by,
    timeLimitMinutes: r.time_limit_minutes,
    passingPercentage: r.passing_percentage ?? 40,
    maxAttempts: r.max_attempts ?? 1,
    isPractice: Boolean(r.is_practice),
    availableFrom: r.available_from || null,
    availableTo: r.available_to || null,
    questionIds: r.question_ids || [],
    createdAt: r.created_at,
  };

const mapAttempt = (r) =>
  r && {
    id: r.id,
    testId: r.test_id,
    studentId: r.student_id,
    score: r.score,
    total: r.total,
    finishedAt: r.finished_at,
  };

export const supabaseStore = {
  mode: 'supabase',

  async findUserByEmail(email) {
    const { data, error } = await sb()
      .from('users')
      .select('*')
      .eq('email', String(email).toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return mapUser(data);
  },

  async findUserById(id) {
    const { data, error } = await sb().from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return mapUser(data);
  },

  async listUsers() {
    const { data, error } = await sb()
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapUser);
  },

  async createUser({ email, name, passwordHash, role }) {
    const { data, error } = await sb()
      .from('users')
      .insert({ email: String(email).toLowerCase(), name, password_hash: passwordHash, role })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        const err = new Error('An account with this email already exists.');
        err.code = 'EMAIL_TAKEN';
        throw err;
      }
      throw new Error(error.message);
    }
    return mapUser(data);
  },

  async deleteUser(id) {
    const { error } = await sb().from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async updateUserRole(id, role) {
    const { data, error } = await sb()
      .from('users')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // no matching row
      throw new Error(error.message);
    }
    return mapUser(data);
  },

  async createDocument({ filename, subject, rawText, fileKind = 'text', fileMime = null, fileData = null, uploadedBy }) {
    const { data, error } = await sb()
      .from('pdf_documents')
      .insert({
        filename,
        subject: subject || 'General',
        raw_text: rawText,
        file_kind: fileKind,
        file_mime: fileMime,
        file_data: fileData,
        uploaded_by: uploadedBy,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapDoc(data);
  },

  async listDocuments() {
    const { data, error } = await sb()
      .from('pdf_documents')
      .select('id, filename, subject, file_kind, uploaded_by, uploaded_at')
      .order('uploaded_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapDoc);
  },

  async getDocument(id) {
    const { data, error } = await sb()
      .from('pdf_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return mapDoc(data);
  },

  async listDocumentsForRetrieval() {
    // id/filename/subject + the raw text — everything retrieval needs, nothing more
    const { data, error } = await sb()
      .from('pdf_documents')
      .select('id, filename, subject, raw_text')
      .order('uploaded_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || [])
      .filter((r) => r.raw_text)
      .map((r) => ({
        id: r.id,
        filename: r.filename,
        subject: r.subject || 'General',
        rawText: r.raw_text,
      }));
  },

  async deleteDocument(id) {
    const { error } = await sb().from('pdf_documents').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async saveQuestions(documentId, questions, { status = 'approved' } = {}) {
    // Keep IDs stable for unchanged questions so re-extracting a document
    // never breaks already-published tests (or saved answers) that
    // reference those IDs.
    const { data: existing, error: fetchErr } = await sb()
      .from('questions')
      .select('id, question_text, status')
      .eq('document_id', documentId);
    if (fetchErr) throw new Error(fetchErr.message);

    const byText = new Map(
      (existing || []).map((r) => [String(r.question_text).trim().toLowerCase(), r])
    );

    const rows = questions.map((q) => {
      const match = byText.get(String(q.questionText).trim().toLowerCase());
      return {
        ...(match ? { id: match.id } : {}),
        document_id: documentId,
        question_text: q.questionText,
        options: q.options,
        correct_answer: q.correctAnswer,
        status: match ? (match.status || 'approved') : status,
      };
    });

    // remove questions that are no longer in the extracted set
    const keepIds = rows.filter((r) => r.id).map((r) => r.id);
    const stale = (existing || []).filter((r) => !keepIds.includes(r.id)).map((r) => r.id);
    if (stale.length > 0) {
      const { error: delErr } = await sb().from('questions').delete().in('id', stale);
      if (delErr) throw new Error(delErr.message);
    }

    if (rows.length > 0) {
      const { error } = await sb().from('questions').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }

    const { data: cur, error } = await sb()
      .from('questions')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (cur || []).map(mapQuestion);
  },

  async addQuestion({ documentId, questionText, options, correctAnswer, status = 'approved' }) {
    const { data, error } = await sb()
      .from('questions')
      .insert({
        document_id: documentId,
        question_text: questionText,
        options,
        correct_answer: correctAnswer,
        status,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapQuestion(data);
  },

  async updateQuestion(id, patch) {
    const update = {};
    if (patch.questionText !== undefined) update.question_text = patch.questionText;
    if (patch.options !== undefined) update.options = patch.options;
    if (patch.correctAnswer !== undefined) update.correct_answer = patch.correctAnswer;
    if (patch.status !== undefined) update.status = patch.status;
    const { data, error } = await sb()
      .from('questions')
      .update(update)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return mapQuestion(data);
  },

  async deleteQuestion(id) {
    const { error } = await sb().from('questions').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async approveAllQuestions(documentId) {
    const { data, error } = await sb()
      .from('questions')
      .update({ status: 'approved' })
      .eq('document_id', documentId)
      .neq('status', 'approved')
      .neq('correct_answer', '')
      .not('correct_answer', 'is', null)
      .select('id');
    if (error) throw new Error(error.message);
    return (data || []).length;
  },

  async listAllQuestions() {
    // one query for all banks — used for counts + duplicate detection
    const { data, error } = await sb()
      .from('questions')
      .select('id, document_id, question_text, status, correct_answer');
    if (error) throw new Error(error.message);
    return (data || []).map(
      (r) => ({
        id: r.id,
        documentId: r.document_id,
        questionText: r.question_text,
        status: r.status || 'approved',
        correctAnswer: r.correct_answer,
      })
    );
  },

  async listQuestions(documentId) {
    const { data, error } = await sb()
      .from('questions')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(mapQuestion);
  },

  async getQuestionsByIds(ids) {
    if (ids.length === 0) return [];
    const { data, error } = await sb().from('questions').select('*').in('id', ids);
    if (error) throw new Error(error.message);
    return (data || []).map(mapQuestion);
  },

  async createTest({ title, documentId, documentIds, createdBy, timeLimitMinutes, passingPercentage, maxAttempts, isPractice, availableFrom, availableTo, questionIds }) {
    const { data, error } = await sb()
      .from('tests')
      .insert({
        title,
        document_id: documentId,
        document_ids: documentIds || (documentId ? [documentId] : []),
        created_by: createdBy,
        time_limit_minutes: timeLimitMinutes,
        passing_percentage: passingPercentage ?? 40,
        max_attempts: maxAttempts ?? 1,
        is_practice: Boolean(isPractice),
        available_from: availableFrom || null,
        available_to: availableTo || null,
        question_ids: questionIds,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapTest(data);
  },

  async listTests() {
    const { data, error } = await sb()
      .from('tests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapTest);
  },

  async getTest(id) {
    const { data, error } = await sb().from('tests').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return mapTest(data);
  },

  async deleteTest(id) {
    const { error } = await sb().from('tests').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async saveAttempt({ testId, studentId, score, total, answers }) {
    const { data, attemptError } = await sb()
      .from('test_attempts')
      .insert({ test_id: testId, student_id: studentId, score, total })
      .select()
      .single();
    if (attemptError) throw new Error(attemptError.message);

    if (answers.length > 0) {
      const { error: answersError } = await sb().from('attempt_answers').insert(
        answers.map((a) => ({
          attempt_id: data.id,
          question_id: a.questionId,
          selected_option: a.selectedOption,
          is_correct: a.isCorrect,
        }))
      );
      if (answersError) throw new Error(answersError.message);
    }
    return mapAttempt(data);
  },

  async listAttempts() {
    const { data, error } = await sb()
      .from('test_attempts')
      .select('*')
      .order('finished_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapAttempt);
  },

  async listAttemptsByStudent(studentId) {
    const { data, error } = await sb()
      .from('test_attempts')
      .select('*')
      .eq('student_id', studentId)
      .order('finished_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapAttempt);
  },

  async listNotices() {
    const { data, error } = await sb()
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data || []).map(
      (r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        createdBy: r.created_by,
        createdAt: r.created_at,
      })
    );
  },

  async createNotice({ title, body, createdBy }) {
    const { data, error } = await sb()
      .from('notices')
      .insert({ title, body, created_by: createdBy })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      title: data.title,
      body: data.body,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  },

  async deleteNotice(id) {
    const { error } = await sb().from('notices').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async listAnswersByAttempt(attemptId) {
    const { data, error } = await sb()
      .from('attempt_answers')
      .select('*')
      .eq('attempt_id', attemptId);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => ({
      id: r.id,
      attemptId: r.attempt_id,
      questionId: r.question_id,
      selectedOption: r.selected_option,
      isCorrect: r.is_correct,
    }));
  },

  async getSetting(key) {
    const { data, error } = await sb()
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.value ?? null;
  },

  async setSetting(key, value) {
    const { error } = await sb()
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
    return value;
  },
};
