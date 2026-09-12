/**
 * In-memory store — used only in DEMO MODE (no Supabase configured).
 * Seeds demo users + a sample question bank so the app is usable instantly.
 */

import { hashSync } from 'bcryptjs';
import { randomUUID } from 'crypto';

const uid = () => randomUUID();

// IMPORTANT: in a production Next.js build every route is its own bundle
// with separate module state. Keeping the demo store on globalThis makes it
// shared by ALL routes in the process (uploads via the API are visible to
// the pages, and so on).
function seedData() {
  const now = new Date().toISOString();

  const mkUser = (name, email, password, role) => ({
    id: uid(),
    name,
    email,
    // cost 12 — matches every real account-creation path (register, admin,
    // seed.js) so login timing is identical whether the email exists or not
    passwordHash: hashSync(password, 12),
    role,
    createdAt: now,
  });

  const users = [
    // Personal accounts (requested by the project owner)
    mkUser('Mehul Rakhecha', 'mehulrakhecha@gmail.com', 'Admin@123', 'ADMIN'),
    mkUser('Tanisha Rakhecha', 'tanisharakhecha2@gmail.com', 'Teacher@123', 'TEACHER'),
    // Generic demo accounts (handy for testing/teaching)
    mkUser('System Admin', 'admin@edumock.local', 'Admin@123', 'ADMIN'),
    mkUser('Maya Teacher', 'teacher@edumock.local', 'Teacher@123', 'TEACHER'),
    mkUser('Sam Student', 'student@edumock.local', 'Student@123', 'STUDENT'),
  ];

  const teacher = users.find((u) => u.role === 'TEACHER');

  const rawText = `General Science — Sample Question Bank (Grade 8)

1. What is the capital city of Nepal?
A) Pokhara
B) Kathmandu
C) Biratnagar
D) Lalitpur
Answer: B

2. Which planet is known as the Red Planet?
A) Venus
B) Jupiter
C) Mars
D) Saturn
Answer: C

3. Water is made up of which two elements?
A) Carbon and oxygen
B) Hydrogen and oxygen
C) Nitrogen and oxygen
D) Hydrogen and carbon
Answer: B

4. What is the process by which plants make their food?
A) Respiration
B) Photosynthesis
C) Digestion
D) Evaporation
Answer: B

5. Which gas do humans need to breathe in to survive?
A) Carbon dioxide
B) Nitrogen
C) Oxygen
D) Helium
Answer: C

6. What force pulls objects toward the center of the Earth?
A) Magnetism
B) Friction
C) Gravity
D) Tension
Answer: C

7. Which of these is a renewable source of energy?
A) Coal
B) Petroleum
C) Solar power
D) Natural gas
Answer: C

8. How many bones are there in an adult human body?
A) 206
B) 306
C) 106
D) 256
Answer: A

9. Which organ pumps blood around the human body?
A) Lungs
B) Brain
C) Liver
D) Heart
Answer: D

10. What is the boiling point of water at sea level?
A) 50 degrees Celsius
B) 90 degrees Celsius
C) 100 degrees Celsius
D) 120 degrees Celsius
Answer: C

11. Which is the largest ocean on Earth?
A) Atlantic Ocean
B) Indian Ocean
C) Arctic Ocean
D) Pacific Ocean
Answer: D

12. What do we call animals that eat both plants and other animals?
A) Herbivores
B) Carnivores
C) Omnivores
D) Decomposers
Answer: C
`;

  const doc = {
    id: uid(),
    filename: 'General Science — Sample Question Bank.pdf',
    subject: 'General Science',
    rawText,
    uploadedBy: teacher.id,
    uploadedAt: now,
  };

  const questions = rawText
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => /^\d+[.)]/.test(block))
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      const qText = lines[0].replace(/^\d+[.)]\s*/, '');
      const options = lines
        .filter((l) => /^[A-D][).]\s+/.test(l))
        .map((l) => l.replace(/^[A-D][).]\s+/, ''));
      const answerLine = lines.find((l) => /^(answer|ans|correct answer)\s*[:\-]/i.test(l));
      const correct = answerLine
        ? (answerLine.match(/([A-D])(?![a-z])/i)?.[1] || 'A').toUpperCase()
        : 'A';
      return {
        id: uid(),
        documentId: doc.id,
        questionText: qText,
        options,
        correctAnswer: correct,
        createdAt: now,
      };
    });

  const test = {
    id: uid(),
    title: 'General Science — Practice Test',
    documentId: doc.id,
    documentIds: [doc.id],
    createdBy: teacher.id,
    timeLimitMinutes: 15,
    passingPercentage: 40,
    maxAttempts: 1,
    isPractice: false,
    questionIds: questions.slice(0, 10).map((q) => q.id),
    createdAt: now,
  };

  const notice = {
    id: uid(),
    title: 'Welcome to Aimmers Nepal 🎉',
    body: 'This is where teachers post announcements — test schedules, reminders and results news. Keep an eye on this space!',
    createdBy: teacher.id,
    createdAt: now,
  };

  return { users, documents: [doc], questions, tests: [test], attempts: [], answers: [], settings: {}, notices: [notice] };
}

const g = globalThis;
if (!g.__edumockDemoData) {
  g.__edumockDemoData = seedData();
}
const data = g.__edumockDemoData;

// ---------------------------------------------------------------- CRUD

async function list(collection) {
  return [...data[collection]];
}

async function delay() {
  // keep async parity with the network store
  return undefined;
}

export const memoryStore = {
  mode: 'demo',

  async findUserByEmail(email) {
    await delay();
    return data.users.find((u) => u.email === String(email).toLowerCase()) || null;
  },

  async findUserById(id) {
    await delay();
    return data.users.find((u) => u.id === id) || null;
  },

  async listUsers() {
    await delay();
    return list('users');
  },

  async createUser({ email, name, passwordHash, role }) {
    await delay();
    const normalized = String(email).toLowerCase();
    if (data.users.some((u) => u.email === normalized)) {
      const err = new Error('An account with this email already exists.');
      err.code = 'EMAIL_TAKEN';
      throw err;
    }
    const user = {
      id: uid(),
      email: normalized,
      name,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    return user;
  },

  async deleteUser(id) {
    await delay();
    const i = data.users.findIndex((u) => u.id === id);
    if (i === -1) return false;
    data.users.splice(i, 1);
    return true;
  },

  async updateUserRole(id, role) {
    await delay();
    const user = data.users.find((u) => u.id === id);
    if (!user) return null;
    user.role = role;
    return user;
  },

  async createDocument({ filename, subject, chapter, rawText, fileKind = 'text', fileMime = null, fileData = null, uploadedBy }) {
    await delay();
    const doc = {
      id: uid(),
      filename,
      subject: subject || 'General',
      chapter: chapter || '',
      rawText,
      fileKind,
      fileMime,
      fileData,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
    };
    data.documents.push(doc);
    return doc;
  },

  async listDocuments() {
    await delay();
    return list('documents');
  },

  async getDocument(id) {
    await delay();
    return data.documents.find((d) => d.id === id) || null;
  },

  async listDocumentsForRetrieval() {
    await delay();
    return data.documents
      .filter((d) => d.rawText)
      .map((d) => ({
        id: d.id,
        filename: d.filename,
        subject: d.subject || 'General',
        rawText: d.rawText,
      }));
  },

  async deleteDocument(id) {
    await delay();
    const i = data.documents.findIndex((d) => d.id === id);
    if (i === -1) return false;
    data.documents.splice(i, 1);
    data.questions = data.questions.filter((q) => q.documentId !== id);
    data.tests = data.tests.filter((t) => t.documentId !== id);
    return true;
  },

  async saveQuestions(documentId, questions, { status = 'approved' } = {}) {
    await delay();
    // Keep IDs stable for unchanged questions so re-extracting a document
    // never breaks already-published tests that reference those IDs.
    const existing = data.questions.filter((q) => q.documentId === documentId);
    const byText = new Map(
      existing.map((q) => [q.questionText.trim().toLowerCase(), q])
    );
    const now = new Date().toISOString();
    const rows = questions.map((q) => {
      const match = byText.get(String(q.questionText).trim().toLowerCase());
      return {
        id: match ? match.id : uid(),
        documentId,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        status: match ? (match.status || 'approved') : status,
        createdAt: match ? match.createdAt : now,
      };
    });
    data.questions = data.questions.filter((q) => q.documentId !== documentId);
    data.questions.push(...rows);
    return rows;
  },

  async addQuestion({ documentId, questionText, options, correctAnswer, status = 'approved' }) {
    await delay();
    const q = {
      id: uid(),
      documentId,
      questionText,
      options,
      correctAnswer,
      status,
      createdAt: new Date().toISOString(),
    };
    data.questions.push(q);
    return q;
  },

  async updateQuestion(id, patch) {
    await delay();
    const q = data.questions.find((x) => x.id === id);
    if (!q) return null;
    if (patch.questionText !== undefined) q.questionText = patch.questionText;
    if (patch.options !== undefined) q.options = patch.options;
    if (patch.correctAnswer !== undefined) q.correctAnswer = patch.correctAnswer;
    if (patch.status !== undefined) q.status = patch.status;
    return q;
  },

  async deleteQuestion(id) {
    await delay();
    const i = data.questions.findIndex((q) => q.id === id);
    if (i === -1) return false;
    data.questions.splice(i, 1);
    return true;
  },

  async approveAllQuestions(documentId) {
    await delay();
    let n = 0;
    for (const q of data.questions) {
      // only questions that actually have an answer key can be approved —
      // drafts without answers stay pending until the key is completed
      if (q.documentId === documentId && q.status !== 'approved' && q.correctAnswer) {
        q.status = 'approved';
        n += 1;
      }
    }
    return n;
  },

  async listAllQuestions() {
    await delay();
    // lightweight copies for counting / duplicate detection (no options blob)
    return data.questions.map((q) => ({
      id: q.id,
      documentId: q.documentId,
      questionText: q.questionText,
      status: q.status || 'approved',
      correctAnswer: q.correctAnswer,
    }));
  },

  async listQuestions(documentId) {
    await delay();
    return data.questions.filter((q) => q.documentId === documentId);
  },

  async getQuestionsByIds(ids) {
    await delay();
    return data.questions.filter((q) => ids.includes(q.id));
  },

  async createTest({ title, documentId, documentIds, createdBy, timeLimitMinutes, passingPercentage, maxAttempts, isPractice, availableFrom, availableTo, questionIds }) {
    await delay();
    const test = {
      id: uid(),
      title,
      documentId,
      documentIds: documentIds || (documentId ? [documentId] : []),
      createdBy,
      timeLimitMinutes,
      passingPercentage: passingPercentage ?? 40,
      maxAttempts: maxAttempts ?? 1,
      isPractice: Boolean(isPractice),
      availableFrom: availableFrom || null,
      availableTo: availableTo || null,
      questionIds,
      createdAt: new Date().toISOString(),
    };
    data.tests.push(test);
    return test;
  },

  async listTests() {
    await delay();
    return list('tests');
  },

  async getTest(id) {
    await delay();
    return data.tests.find((t) => t.id === id) || null;
  },

  async deleteTest(id) {
    await delay();
    const i = data.tests.findIndex((t) => t.id === id);
    if (i === -1) return false;
    data.tests.splice(i, 1);
    const attemptIds = data.attempts.filter((a) => a.testId === id).map((a) => a.id);
    data.attempts = data.attempts.filter((a) => a.testId !== id);
    data.answers = data.answers.filter((a) => !attemptIds.includes(a.attemptId));
    return true;
  },

  async saveAttempt({ testId, studentId, score, total, answers }) {
    await delay();
    const attempt = {
      id: uid(),
      testId,
      studentId,
      score,
      total,
      finishedAt: new Date().toISOString(),
    };
    data.attempts.push(attempt);
    data.answers.push(
      ...answers.map((a) => ({
        id: uid(),
        attemptId: attempt.id,
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        isCorrect: a.isCorrect,
      }))
    );
    return attempt;
  },

  async listAttempts() {
    await delay();
    return list('attempts');
  },

  async listAttemptsByStudent(studentId) {
    await delay();
    return data.attempts.filter((a) => a.studentId === studentId);
  },

  async listNotices() {
    await delay();
    return list('notices');
  },

  async createNotice({ title, body, createdBy }) {
    await delay();
    const notice = {
      id: uid(),
      title,
      body,
      createdBy,
      createdAt: new Date().toISOString(),
    };
    data.notices.push(notice);
    return notice;
  },

  async deleteNotice(id) {
    await delay();
    const i = data.notices.findIndex((n) => n.id === id);
    if (i === -1) return false;
    data.notices.splice(i, 1);
    return true;
  },

  async listAnswersByAttempt(attemptId) {
    await delay();
    return data.answers.filter((a) => a.attemptId === attemptId);
  },

  async getSetting(key) {
    await delay();
    const s = data.settings[key];
    return s === undefined ? null : s;
  },

  async setSetting(key, value) {
    await delay();
    data.settings[key] = value;
    return value;
  },
};

export const DEMO_USERS = [
  { name: 'Mehul (Admin)', email: 'mehulrakhecha@gmail.com', password: 'Admin@123', role: 'ADMIN' },
  { name: 'Tanisha (Teacher)', email: 'tanisharakhecha2@gmail.com', password: 'Teacher@123', role: 'TEACHER' },
  { email: 'student@edumock.local', password: 'Student@123', role: 'STUDENT' },
];
