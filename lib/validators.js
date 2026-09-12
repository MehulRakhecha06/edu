/**
 * Input validation & sanitization (zod).
 * Every API route parses its input through one of these schemas BEFORE
 * touching the database or the AI.
 */

import { z } from 'zod';

/** Strip control characters and angle brackets, collapse whitespace, cap length */
export function cleanText(value, max = 500) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Email is too short')
  .max(255)
  .email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export const nameSchema = z
  .string()
  .transform((v) => cleanText(v, 100))
  .refine((v) => v.length >= 2, 'Name must be at least 2 characters');

export const roleSchema = z.enum(['ADMIN', 'TEACHER', 'STUDENT']);

/** Public registration (students only — enforced, not taken from the body) */
/** Cheap UUID check — rejects garbage ids with a clean 404 before they
 *  reach the database (Supabase errors on non-uuid .eq values). */
export function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
}

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/** Admin creating an account (any role) */
export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
});

/** Admin changing someone's role */
export const updateUserRoleSchema = z.object({
  role: roleSchema,
});

/**
 * A NAIVE datetime-local string (e.g. "2026-09-12T18:00", no timezone) is
 * the teacher's NEPAL wall-clock time (+05:45) — never the server's
 * timezone. Full ISO strings (with Z or an offset) pass through unchanged.
 * Call this on availableFrom/availableTo BEFORE validating, so the stored
 * instant is right regardless of who calls the API.
 */
export function toNptWindow(value) {
  if (!value || typeof value !== 'string') return value;
  return /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}:00+05:45`;
}

export const createTestSchema = z
  .object({
    title: z.string().transform((v) => cleanText(v, 200)).refine((v) => v.length >= 3, 'Title is too short'),
    // one or many question banks (multi-subject tests)
    documentId: z.string().uuid('Invalid document id').optional(),
    documentIds: z.array(z.string().uuid()).min(1).max(20).optional(),
    questionCount: z.coerce.number().int().min(1, 'At least 1 question').max(100, 'At most 100 questions'),
    timeLimitMinutes: z.coerce.number().int().min(1, 'At least 1 minute').max(180, 'Maximum 180 minutes'),
    passingPercentage: z.coerce.number().int().min(1, 'Passing % must be at least 1').max(100, 'Passing % must be at most 100').default(40),
    // How many times a student may take this test: 1 (default), 2-10, or 0 = unlimited
    maxAttempts: z.coerce.number().int().min(0, 'Invalid attempt limit').max(10, 'At most 10 attempts').default(1),
    // Practice tests: unlimited retakes, marked "Practice" everywhere
    isPractice: z.coerce.boolean().default(false),
    // Optional availability window (datetime-local strings, e.g. 2026-09-12T18:00)
    // — normalized to Nepal time via toNptWindow() before validation
    availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Invalid start date').optional().or(z.literal('')),
    availableTo: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Invalid end date').optional().or(z.literal('')),
  })
  .refine((d) => d.documentIds?.length || d.documentId, {
    message: 'Select at least one question bank',
  })
  .refine((d) => !d.availableFrom || !d.availableTo || new Date(d.availableFrom) < new Date(d.availableTo), {
    message: 'The test cannot close before it opens',
    path: ['availableTo'],
  });

export const questionSchema = z.object({
  documentId: z.string().uuid('Invalid document id'),
  questionText: z.string().transform((v) => cleanText(v, 1500)).refine((v) => v.length >= 4, 'Question is too short'),
  options: z.array(z.string().transform((v) => cleanText(v, 300))).min(2, 'At least 2 options').max(6, 'At most 6 options'),
  correctAnswer: z.string().regex(/^[A-F]?$/, 'Answer must be a letter A-F (or empty)').default(''),
});

export const updateQuestionSchema = z.object({
  questionText: z.string().transform((v) => cleanText(v, 1500)).refine((v) => v.length >= 4, 'Question is too short').optional(),
  options: z.array(z.string().transform((v) => cleanText(v, 300))).min(2, 'At least 2 options').max(6, 'At most 6 options').optional(),
  correctAnswer: z.string().regex(/^[A-F]?$/).optional(),
  status: z.enum(['pending', 'approved']).optional(),
});

export const manualBankSchema = z.object({
  title: z.string().transform((v) => cleanText(v, 200)).refine((v) => v.length >= 3, 'Title is too short'),
  subject: z.string().transform((v) => cleanText(v, 60)).optional(),
  chapter: z.string().transform((v) => cleanText(v, 60)).optional(),
});

export const createNoticeSchema = z.object({
  title: z.string().transform((v) => cleanText(v, 120)).refine((v) => v.length >= 3, 'Title is too short'),
  body: z.string().transform((v) => cleanText(v, 2000)).refine((v) => v.length >= 3, 'Notice text is too short'),
});

export const submitTestSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selected: z.string().max(10).nullable(),
      })
    )
    .min(1, 'No answers submitted')
    .max(100),
});

export const explainSchema = z.object({
  questionId: z.string().uuid(),
  testId: z.string().uuid(),
});

export const chatSchema = z.object({
  message: z
    .string()
    .transform((v) => cleanText(v, 500))
    .refine((v) => v.length >= 1, 'Message is empty')
    .refine((v) => v.length > 0, 'Message is empty'),
});

// ---- Admin AI settings -------------------------------------------------

const httpUrlSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/.+/i.test(v), {
    message: 'URL must start with http:// or https://',
  });

const modelNameSchema = z.string().transform((v) => cleanText(v, 100));

export const aiSettingsSchema = z.object({
  provider: z.enum(['auto', 'local', 'huggingface']),
  local: z.object({
    baseUrl: httpUrlSchema.default(''),
    model: modelNameSchema.default(''),
    // '' = keep the existing key untouched (same convention as Hugging Face)
    apiKey: z.string().trim().max(300).default(''),
  }),
  huggingface: z.object({
    model: modelNameSchema.default(''),
    // '' = keep the existing key untouched
    apiKey: z.string().trim().max(300).default(''),
  }),
  // set true to REMOVE the stored Hugging Face key
  removeApiKey: z.boolean().default(false),
  removeLocalApiKey: z.boolean().default(false),
});

export const aiTestSchema = z.object({
  provider: z.enum(['local', 'huggingface']),
  baseUrl: z.string().trim().max(300).default(''),
  model: z.string().trim().max(100).default(''),
  apiKey: z.string().trim().max(300).default(''),
});
