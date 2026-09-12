/**
 * AI layer — provider is chosen by the ADMIN at runtime (Admin → AI Settings)
 * with environment variables as the bootstrap defaults.
 *
 * Priority when resolving which AI to use:
 *   1. The admin's saved choice (database `app_settings`):
 *        provider 'local'       -> locally hosted model (Ollama, LM Studio,
 *                                  llama.cpp, vLLM … anything OpenAI-compatible)
 *        provider 'huggingface' -> Hugging Face Inference API
 *        provider 'auto'        -> admin config if present, else environment
 *   2. Environment variables (AI_BASE_URL / HUGGINGFACE_API_KEY …)
 *   3. Built-in fallback — deterministic answers so the demo never breaks.
 *
 * If the chosen provider is unreachable, calls degrade gracefully instead of
 * crashing the app.
 *
 * Used for: PDF question extraction (verbatim!), answer explanations, and
 * the bottom-right assistant.
 */

import fs from 'node:fs';
import path from 'node:path';
import { db } from './db';
import { validateQuestions, validateQuestionDrafts, answerLetter } from './mcq';

/**
 * Bearer key for the local AI service.
 *
 * 1. AI_API_KEY env var (explicit — wins always, e.g. a remote AI service).
 * 2. Otherwise, when the bundled ai-service/ lives in the SAME repo (local
 *    development), read its SERVICE_API_KEY from ai-service/.env and use it
 *    automatically. This makes "SERVICE_API_KEY set in the service" and
 *    "web app sends no key" impossible to mismatch locally — the 401 class
 *    of error cannot happen unless the two are deliberately separated.
 */
function getLocalServiceKey() {
  if (process.env.AI_API_KEY) return process.env.AI_API_KEY;
  const g = globalThis;
  if (g.__edumockLocalServiceKey !== undefined) return g.__edumockLocalServiceKey;
  let key = null;
  try {
    const envPath = path.join(process.cwd(), 'ai-service', '.env');
    if (fs.existsSync(envPath)) {
      const m = fs
        .readFileSync(envPath, 'utf8')
        .match(/^\s*SERVICE_API_KEY\s*=\s*(\S+)\s*$/m);
      if (m) key = m[1].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* unreadable -> no key */
  }
  g.__edumockLocalServiceKey = key;
  return key;
}

const LOCAL_DEFAULT_MODEL = 'llama3.2:1b';
const HF_DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

// ------------------------------------------------------- admin setting

// Cached briefly so every AI call doesn't hit the database. The cache lives
// on globalThis so it is shared by ALL route bundles and clearing it after an
// admin save takes effect everywhere immediately.
const g = globalThis;
const SETTING_TTL_MS = 10_000;

function getCache() {
  if (!g.__edumockAiSettingCache) g.__edumockAiSettingCache = { value: undefined, at: 0 };
  return g.__edumockAiSettingCache;
}

async function getAiSetting() {
  const cache = getCache();
  const now = Date.now();
  if (cache.value !== undefined && now - cache.at < SETTING_TTL_MS) {
    return cache.value;
  }
  let value = null;
  try {
    value = await db.getSetting('ai');
  } catch (err) {
    console.warn('[ai] could not read AI setting:', err?.message);
  }
  g.__edumockAiSettingCache = { value, at: now };
  return value;
}

/** Called after the admin saves settings so the change applies immediately. */
export function clearAiSettingCache() {
  g.__edumockAiSettingCache = { value: undefined, at: 0 };
}

// ------------------------------------------------------- provider

function trimUrl(v) {
  return String(v || '').trim().replace(/\/+$/, '');
}

/**
 * When nothing else is configured, check whether the bundled Python AI
 * service (npm run ai → port 8000) is running locally. If it answers, use
 * it as the local provider so the app works with zero configuration.
 */
async function detectBundledService(envLocalUrl) {
  const baseUrl = trimUrl(envLocalUrl || 'http://localhost:8000/v1');
  if (!baseUrl) return null;
  try {
    const probe = { kind: 'local', baseUrl, apiKey: getLocalServiceKey() || null };
    const svc = await detectService(probe);
    if (!svc) return null;
    // The mock backend answers any parse request with canned demo questions —
    // silently using it would REPLACE real questions with fake ones. Only a
    // real backend (ollama, huggingface, transformers…) is auto-detected.
    // An explicit AI_BASE_URL always wins over this check.
    if (svc.backend === 'mock') return null;
    return {
      kind: 'local',
      baseUrl,
      model: process.env.AI_MODEL || LOCAL_DEFAULT_MODEL,
      apiKey: getLocalServiceKey() || null,
      timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 60_000,
      source: 'environment',
      note: 'Using the bundled Python AI service on this machine (auto-detected on port 8000).',
    };
  } catch {
    return null;
  }
}

export async function resolveProvider() {
  const setting = await getAiSetting();

  // --- environment configuration (bootstrap defaults) ---
  const envLocalUrl = trimUrl(process.env.AI_BASE_URL);
  const envLocal = envLocalUrl
    ? {
        baseUrl: envLocalUrl,
        model: process.env.AI_MODEL || LOCAL_DEFAULT_MODEL,
        apiKey: process.env.AI_API_KEY || getLocalServiceKey() || null,
      }
    : null;

  // A key the admin saved for a CUSTOM OpenAI-compatible provider (Mistral,
  // Groq, Gemini…) — used before the auto-handshake service key.
  const savedLocalKey = String(setting?.local?.apiKey || '').trim();
  const envHfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
  const envHf = envHfToken
    ? { token: envHfToken, model: process.env.HF_MODEL || HF_DEFAULT_MODEL }
    : null;

  // --- admin configuration (saved from the dashboard) ---
  const savedLocalUrl = trimUrl(setting?.local?.baseUrl);
  const savedLocal = savedLocalUrl
    ? {
        baseUrl: savedLocalUrl,
        model: setting.local.model || LOCAL_DEFAULT_MODEL,
        apiKey: savedLocalKey || getLocalServiceKey() || null,
      }
    : null;

  const savedHfToken = String(setting?.huggingface?.apiKey || '').trim();
  const savedHf = savedHfToken
    ? { token: savedHfToken, model: setting.huggingface.model || HF_DEFAULT_MODEL }
    : null;

  const mkLocal = (src, source) => ({
    kind: 'local',
    baseUrl: src.baseUrl,
    model: src.model,
    apiKey: src.apiKey,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 60_000,
    source,
  });
  const mkHf = (src, source) => ({
    kind: 'huggingface',
    token: src.token,
    model: src.model,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 20_000,
    source,
  });

  const choice = setting?.provider; // 'auto' | 'local' | 'huggingface'

  // Admin explicitly chose the LOCAL model
  if (choice === 'local') {
    const src = savedLocal || envLocal;
    if (src) return mkLocal(src, savedLocal ? 'admin' : 'environment');
    // no URL saved — is the bundled Python service running? that IS local.
    const bundled = await detectBundledService(envLocalUrl);
    if (bundled) return bundled;
    const hfSrc = savedHf || envHf; // safety net: local not configured
    if (hfSrc) {
      return {
        ...mkHf(hfSrc, savedHf ? 'admin' : 'environment'),
        note: 'Local AI is selected but no base URL is configured — using Hugging Face instead.',
      };
    }
    return { kind: 'fallback', note: 'Local AI is selected but not configured, and no Hugging Face key exists.' };
  }

  // Admin explicitly chose HUGGING FACE
  if (choice === 'huggingface') {
    const src = savedHf || envHf;
    if (src) return mkHf(src, savedHf ? 'admin' : 'environment');
    const localSrc = savedLocal || envLocal; // safety net: no key anywhere
    if (localSrc) {
      return {
        ...mkLocal(localSrc, savedLocal ? 'admin' : 'environment'),
        note: 'Hugging Face is selected but no API key is set — using the local model instead.',
      };
    }
    return { kind: 'fallback', note: 'Hugging Face is selected but no API key is set.' };
  }

  // 'auto' (or no saved setting): admin config first, then environment.
  // Local has priority — matching the documented "local → HF → fallback".
  const localSrc = savedLocal || envLocal;
  if (localSrc) return mkLocal(localSrc, savedLocal ? 'admin' : 'environment');
  // Nothing configured? If the bundled Python AI service (npm run ai) is
  // running on this machine, use it — zero-config local AI.
  const bundled = await detectBundledService(envLocalUrl);
  if (bundled) return bundled;
  const hfSrc = savedHf || envHf;
  if (hfSrc) return mkHf(hfSrc, savedHf ? 'admin' : 'environment');
  return { kind: 'fallback' };
}

/** Info for /api/health and the admin settings page (never leaks keys). */
export async function getAiInfo() {
  const p = await resolveProvider();
  const info = { provider: p.kind, model: p.model || null };
  if (p.source) info.source = p.source; // 'admin' | 'environment'
  if (p.note) info.note = p.note;

  // Detect the Python AI service so the admin can see it is connected
  if (p.kind === 'local') {
    const service = await detectService(p);
    if (service) {
      info.pythonService = { version: service.version, backend: service.backend };
    }
  }
  return info;
}

// ------------------------------------------------------- python service

// The Aimmers AI service (ai-service/, Python/FastAPI) implements the
// OpenAI-compatible API AND smart task endpoints (/edumock/*). When the
// configured local URL points at it, we detect it once (cached) and route
// the parsing / explanation / assistant tasks to the dedicated endpoints —
// so ALL AI logic can be maintained in Python by the team.
function getServiceCache() {
  const g = globalThis;
  if (!g.__edumockServiceCache) g.__edumockServiceCache = {};
  return g.__edumockServiceCache;
}

async function detectService(provider) {
  if (provider.kind !== 'local') return null;

  const root = provider.baseUrl.replace(/\/v1\/?$/, '');
  const cache = getServiceCache();
  const hit = cache[root];
  if (hit && Date.now() - hit.at < 60_000) return hit.info;

  let info = null;
  try {
    const res = await fetch(`${root}/health`, {
      headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const d = await res.json();
      if (d?.service === 'edumock-ai-service') {
        info = { root, version: d.version || null, backend: d.backend || null };
      }
    }
  } catch {
    // not the Python service (e.g. plain Ollama) — that's fine
  }
  cache[root] = { at: Date.now(), info };
  return info;
}

/** Call a smart endpoint on the Python service. Returns null on any failure. */
async function callService(service, provider, path, payload, timeoutMs, { strict = false } = {}) {
  try {
    const res = await fetch(`${service.root}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs || provider.timeoutMs),
    });
    if (!res.ok) {
      const msg =
        `[ai] service call ${path} failed (HTTP ${res.status})` +
        (res.status === 401
          ? ' — the AI service has SERVICE_API_KEY set but the app is not sending a matching AI_API_KEY'
          : '');
      if (strict) throw new Error(msg);
      console.error(msg);
      return null;
    }
    return await res.json();
  } catch (err) {
    if (strict) throw err;
    return null;
  }
}

// ------------------------------------------------------- chat core

async function localChat(provider, messages, { maxTokens, temperature, timeoutMs }) {
  let res;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs || provider.timeoutMs),
    });
  } catch (err) {
    // network-level failure — name the URL so "wrong port" / "service down"
    // is obvious instead of a bare "fetch failed"
    throw new Error(
      `could not reach the AI at ${provider.baseUrl} (${err?.message || err}) — is the service running?`
    );
  }
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        `The AI at ${provider.baseUrl} responded with HTTP 401 (unauthorized). ` +
          'For a cloud API (Mistral, Groq, Gemini, OpenRouter…): check the API key you saved in Admin → AI Settings. ' +
          'For the Aimmers AI service: either remove SERVICE_API_KEY from ai-service/.env, ' +
          "or set AI_API_KEY in the web app's .env.local to the same value."
      );
    }
    if (res.status === 404) {
      throw new Error(
        `The AI at ${provider.baseUrl} responded with HTTP 404 — check the BASE URL and the MODEL NAME ` +
          '(cloud APIs need exact model ids like "open-mistral-nemo" or "llama-3.3-70b-versatile").'
      );
    }
    throw new Error(`The AI at ${provider.baseUrl} responded with HTTP ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

// Hugging Face's OpenAI-compatible router — one token, 100+ hosted models.
const HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';

/**
 * Turn an HTTP failure from the router into an error that SAYS something.
 * The official library collapses every failure into "an HTTP error occurred
 * when requesting the provider" — useless when the real cause is a retired
 * model (404), missing credits (402) or a token without the right scope.
 */
function hfError(status, bodyText) {
  let detail = '';
  try {
    const parsed = JSON.parse(bodyText);
    detail = String(parsed?.error?.message || parsed?.error || parsed?.message || '');
  } catch {
    detail = String(bodyText || '').slice(0, 160);
  }
  const hint =
    status === 401
      ? 'Token rejected — use a fine-grained token with "Make calls to Inference Providers" enabled (huggingface.co/settings/tokens).'
      : status === 402 || status === 403
        ? 'Out of inference credits, or billing is not enabled — the free plan includes only ~$0.10/month.'
        : status === 404
          ? 'This model is not served by Inference Providers — pick one listed at huggingface.co/models (filter: Inference Providers) and set HF_MODEL.'
          : status === 429
            ? 'Rate limited — wait a moment and retry.'
            : '';
  return new Error(
    `Hugging Face HTTP ${status}${detail ? `: ${detail}` : ''}${hint ? ` — ${hint}` : ''}`
  );
}

async function hfChat(provider, messages, { maxTokens, temperature, timeoutMs }) {
  const res = await fetch(HF_ROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.token}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs || provider.timeoutMs),
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw hfError(res.status, bodyText);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * One chat call through whichever provider is active.
 * Returns null when no provider is configured or it fails — callers
 * always have a fallback, so the app keeps working.
 */
async function chat(messages, { maxTokens = 250, temperature = 0.3, timeoutMs, strict = false } = {}) {
  const provider = await resolveProvider();
  try {
    if (provider.kind === 'local') {
      return await localChat(provider, messages, { maxTokens, temperature, timeoutMs });
    }
    if (provider.kind === 'huggingface') {
      return await hfChat(provider, messages, { maxTokens, temperature, timeoutMs });
    }
  } catch (err) {
    if (strict) throw err; // let callers that track failures see the real cause
    console.warn(
      `[ai] ${provider.kind} provider failed (${err?.message}) — using fallback`
    );
  }
  return null;
}

/**
 * Live connectivity test used by the admin settings page.
 * Tests the values in the form (before saving) — nothing is persisted.
 */
export async function testProvider({ provider, baseUrl, model, apiKey }) {
  const started = Date.now();
  const done = (ok, message) => ({ ok, latencyMs: Date.now() - started, message });
  try {
    if (provider === 'local') {
      const url = trimUrl(baseUrl);
      if (!/^https?:\/\/.+/i.test(url)) {
        return done(false, 'Enter a base URL starting with http:// or https://');
      }
      const p = {
        kind: 'local',
        baseUrl: url,
        model: model || LOCAL_DEFAULT_MODEL,
        apiKey: apiKey || process.env.AI_API_KEY || null,
        timeoutMs: 12_000,
      };
      const reply = await localChat(
        p,
        [{ role: 'user', content: 'Reply with exactly: OK' }],
        { maxTokens: 10, temperature: 0 }
      );
      // Bonus: detect our Python AI service on the same host
      let extra = '';
      const service = await detectService({ ...p, kind: 'local' });
      if (service) {
        extra = ` · Aimmers Python AI service v${service.version || '?'} detected (backend: ${service.backend || '?'})`;
      }
      return done(
        Boolean(reply),
        reply
          ? `Connected — model "${p.model}" replied: "${String(reply).slice(0, 60)}"${extra}`
          : 'Connected, but the model returned an empty reply.'
      );
    }

    if (provider === 'huggingface') {
      const token = String(apiKey || '').trim() || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
      if (!token) {
        return done(false, 'No API key provided (and none found in the environment).');
      }
      const p = {
        kind: 'huggingface',
        token,
        model: model || HF_DEFAULT_MODEL,
        timeoutMs: 15_000,
      };
      const reply = await hfChat(
        p,
        [{ role: 'user', content: 'Reply with exactly: OK' }],
        { maxTokens: 10, temperature: 0 }
      );
      return done(
        Boolean(reply),
        reply
          ? `Connected — model "${p.model}" replied: "${String(reply).slice(0, 60)}"`
          : 'Connected, but the model returned an empty reply.'
      );
    }

    return done(false, 'Unknown provider.');
  } catch (err) {
    return done(false, err?.message || 'Connection failed.');
  }
}

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ------------------------------------------------------- explanations

export async function explainQuestion({ question, options, correctAnswer }) {
  const provider = await resolveProvider();

  // 1. Preferred: the Python AI service's dedicated endpoint
  if (provider.kind === 'local') {
    const service = await detectService(provider);
    if (service) {
      const data = await callService(service, provider, '/edumock/explain', {
        question,
        options,
        correct_answer: correctAnswer,
      });
      if (data?.explanation) {
        return { explanation: data.explanation, source: data.source === 'fallback' ? 'fallback' : 'ai' };
      }
    }
  }

  // 2. Generic chat path (local OpenAI-compatible / Hugging Face)
  const letterText = options
    .map((o, i) => `${'ABCDEF'[i]}) ${o}`)
    .join('\n');

  const answer =
    (await chat(
      [
        {
          role: 'system',
          content:
            'You are a friendly school teacher. Explain why the correct answer is right, in simple English, in under 90 words. Do not reveal or discuss the other options at length.',
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nOptions:\n${letterText}\n\nCorrect answer: ${correctAnswer}`,
        },
      ],
      { maxTokens: 180 }
    )) || null;

  if (answer) return { explanation: answer, source: 'ai' };

  // Fallback — still useful for the demo
  const correctText = options['ABCDEF'.indexOf(correctAnswer)] || correctAnswer;
  return {
    explanation: `The correct answer is ${correctAnswer}) ${correctText}. To understand why, review this topic in your class notes — and ask your teacher if any part is still unclear. (An admin can enable an AI provider under Admin → AI Settings — a locally hosted model or a Hugging Face key.)`,
    source: 'fallback',
  };
}

// ------------------------------------------------------- PDF parsing

// Large question banks (textbooks, 100+ pages) far exceed a single model
// context window. The text is split into chunks at paragraph boundaries and
// each chunk is parsed separately; results are merged and de-duplicated.
// 9,000 chars ≈ 3-4 PDF pages — small enough for local models.
const PARSE_CHUNK_CHARS = 9000;
const PARSE_MAX_CHUNKS = 24; // ≈ 216K chars (~80+ pages) per document

const FURNITURE_EXACT = new Set([
  'your working space',
  'working space',
  'reason / key concept',
  'my answer',
  'question bank',
]);

/**
 * Strip page furniture before the text goes to the AI: form feeds, page
 * numbers, "— 16 of 173 —" markers, "A( ) B( ) C( ) D( )" answer strips,
 * social handles and repeated header/footer lines. This can remove half the
 * noise of a typical book-style export, which small local models struggle
 * with. The RAW text is untouched for the deterministic parser.
 */
export function cleanTextForAi(text) {
  const lines = String(text || '')
    .replace(/\f/g, '\n')
    .split('\n')
    .map((l) => l.trim());
  const counts = new Map();
  for (const l of lines) if (l) counts.set(l, (counts.get(l) || 0) + 1);
  const out = [];
  for (const l of lines) {
    if (!l) {
      out.push('');
      continue;
    }
    const low = l.toLowerCase();
    if (/^\d{1,4}$/.test(l)) continue; // bare page numbers
    if (/^--?\s*\d+(\s*of\s*\d+)?\s*--?$/.test(low)) continue; // "- 16 of 173 -"
    if (/^[a-z]\s*\(\s*\)\s*[a-z]\s*\(\s*\)/.test(low)) continue; // "A( ) B( ) C( ) D( )"
    if (FURNITURE_EXACT.has(low)) continue;
    if (l.startsWith('@')) continue; // @handles
    // repeated header/footer: identical short line on 4+ lines AND
    // furniture-ish (all caps, or dot/pipe separated) — never drops option
    // lines like "All of the above" (not all-caps, no separators).
    if (
      (counts.get(l) || 0) >= 4 &&
      l.length <= 90 &&
      (l === l.toUpperCase() || /·/.test(l) || / \| /.test(l))
    ) {
      continue;
    }
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function chunkDocumentText(text, size = PARSE_CHUNK_CHARS) {
  const src = String(text || '');
  if (!src.trim()) return [];
  const out = [];
  let cur = '';

  const flush = () => {
    if (cur.trim()) out.push(cur);
    cur = '';
  };

  for (const para of src.split(/\n\s*\n/)) {
    let piece = para;
    // A single paragraph bigger than a chunk (rare, e.g. a table dumped as
    // one line): hard-split it at the last line break before the limit.
    while (piece.length > size) {
      let cut = piece.lastIndexOf('\n', size);
      if (cut < size * 0.5) cut = size;
      flush();
      out.push(piece.slice(0, cut));
      piece = piece.slice(cut).replace(/^\n+/, '');
    }
    if (!piece.trim()) continue;
    if (!cur) cur = piece;
    else if (cur.length + piece.length + 2 <= size) cur += '\n\n' + para;
    else {
      flush();
      cur = piece;
    }
  }
  flush();
  return out.slice(0, PARSE_MAX_CHUNKS);
}

// Parsing generates up to 1500 tokens — on CPU with a small model that can
// far exceed the normal per-request timeout. Give parses generous room.
const PARSE_TIMEOUT_MS = 240_000;

async function parseQuestionsAIChunk(chunk, provider) {
  // 1. Preferred: the Python AI service's dedicated endpoint
  if (provider.kind === 'local') {
    const service = await detectService(provider);
    if (service) {
      const data = await callService(
        service,
        provider,
        '/edumock/parse-questions',
        { text: chunk },
        Math.max(provider.timeoutMs, PARSE_TIMEOUT_MS),
        { strict: true }
      );
      if (data?.source === 'provider-failed') {
        throw new Error(
          'The AI service could not reach its model backend (e.g. Ollama is not running, or the model/HF call failed). Check http://localhost:8000/health and the service terminal.'
        );
      }
      if (data) {
        // The service ANSWERED. An empty questions list is definitive for
        // this chunk ("no MCQs in this part") — do NOT re-send the same text
        // through the generic chat path: that doubled the time and almost
        // never changed the outcome.
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          // validate on our side too — defense in depth
          const strict = validateQuestions(
            data.questions.map((q) => ({
              questionText: q.question_text,
              options: q.options,
              correctAnswer: q.correct_answer,
            }))
          );
          if (strict.length > 0) return strict;
          // no answer key in this part of the document? Keep them as DRAFTS —
          // the teacher completes the key on the review page.
          return validateQuestionDrafts(
            data.questions.map((q) => ({
              questionText: q.question_text,
              options: q.options,
            }))
          );
        }
        return [];
      }
      // data === null -> the request itself failed -> generic path below
    }
  }

  // 2. Generic chat path (local OpenAI-compatible / Hugging Face)
  const out =
    (await chat(
      [
        {
          role: 'system',
          content:
            'You are an exam parser. Extract multiple-choice questions from the text. STRICT RULES: 1) Copy each question and option VERBATIM — never rewrite, translate, shorten or fix anything. 2) correct_answer must be the LETTER (A-F) of the correct option; if the text marks the answer use that, otherwise choose the most clearly correct option. 3) Ignore anything that is not a multiple-choice question. 4) If you find no questions, reply with exactly []. 5) Reply with ONLY a JSON array, no markdown, no commentary. Format: [{"question_text":"...","options":["...","...","...","..."],"correct_answer":"A"}]',
        },
        { role: 'user', content: chunk },
      ],
      { maxTokens: 1500, temperature: 0, timeoutMs: Math.max(provider.timeoutMs, PARSE_TIMEOUT_MS), strict: true }
    )) || null;

  const parsed = extractJson(out);
  if (!parsed) return [];

  const strict = validateQuestions(
    parsed.map((q) => ({
      questionText: q?.question_text,
      options: q?.options,
      correctAnswer: q?.correct_answer,
    }))
  );
  if (strict.length > 0) return strict;
  return validateQuestionDrafts(
    parsed.map((q) => ({
      questionText: q?.question_text,
      options: q?.options,
    }))
  );
}

/**
 * AI extraction over the WHOLE document — chunk by chunk, merged + deduped.
 * Sequential on purpose: local models (Ollama etc.) answer one request at a
 * time, and this keeps memory + rate limits predictable.
 */
export async function parseQuestionsAI(rawText) {
  const chunks = chunkDocumentText(cleanTextForAi(rawText));
  if (chunks.length === 0) return { questions: [], chunks: 0, chunksFailed: 0, lastError: null };

  const provider = await resolveProvider();
  const seen = new Set();
  const merged = [];
  let chunksFailed = 0;
  let lastError = null;

  for (const chunk of chunks) {
    let questions = [];
    try {
      questions = await parseQuestionsAIChunk(chunk, provider);
    } catch (err) {
      // one bad chunk must not kill the whole document — but it IS counted,
      // so the teacher can be told that the AI misbehaved (vs. genuinely
      // finding no questions).
      chunksFailed += 1;
      lastError = err?.message || String(err);
      continue;
    }
    for (const q of questions) {
      const key = String(q.questionText || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 120);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(q);
    }
  }
  return { questions: merged, chunks: chunks.length, chunksFailed, lastError };
}

// --------------------------------------------- answer-key completion

const ANSWER_KEY_SYSTEM_JS =
  'You are an exam answer-key expert. You receive multiple-choice questions without answers. For EACH question choose the single most clearly correct option. If an answer-key excerpt from the document is provided, use it when it clearly gives the answer for a question (it may write it as "Option D", "D", "2" or the option text). Reply with ONLY a JSON array, no markdown, in the format [{"index": 0, "correct_answer": "A"}] where index is the question number in the order given (starting at 0) and correct_answer is the LETTER of the best option.';

/**
 * Complete a missing answer key: questions without correct answers in,
 * picked letters out. Returns [{index, answer}] or null on failure.
 * answerContext: answer-ish lines from the document (distant key sections).
 */
export async function completeAnswerKey(questions, { answerContext = '', timeoutMs } = {}) {
  if (!Array.isArray(questions) || questions.length === 0) return null;

  const payload = questions.map((q) => ({
    question_text: q.questionText,
    options: q.options,
  }));
  const keyExcerpt = String(answerContext || '').slice(0, 4000);

  const provider = await resolveProvider();

  // 1. Preferred: the Python AI service's dedicated endpoint
  if (provider.kind === 'local') {
    const service = await detectService(provider);
    if (service) {
      const data = await callService(
        service,
        provider,
        '/edumock/answer-key',
        { questions: payload, answer_context: keyExcerpt },
        timeoutMs ? Math.max(provider.timeoutMs, timeoutMs) : undefined
      );
      if (data?.answers?.length) {
        return data.answers.map((a) => ({ index: a.index, answer: a.correct_answer }));
      }
    }
  }

  // 2. Generic chat path (any OpenAI-compatible / Hugging Face).
  //    strict: the REAL error (bad key, out of credits, rate limit, wrong
  //    model, timeout) propagates to the caller — a vague "could not
  //    complete" that blames the Python service helps nobody.
  const out = await chat(
    [
      { role: 'system', content: ANSWER_KEY_SYSTEM_JS },
      {
        role: 'user',
        content:
          JSON.stringify(payload) +
          (keyExcerpt ? `\n\nAnswer-key excerpt from the document:\n${keyExcerpt}` : ''),
      },
    ],
    { maxTokens: 1500, temperature: 0, timeoutMs, strict: true }
  );
  if (!out) return null;
  let parsed = extractJson(out);
  // Models wrap the array in many shapes — accept {"answers":[…]},
  // {"results":[…]}, {"key":[…]} as well as the bare array.
  if (parsed && !Array.isArray(parsed)) {
    const inner = parsed.answers ?? parsed.results ?? parsed.key ?? parsed.items;
    if (Array.isArray(inner)) parsed = inner;
  }
  if (!Array.isArray(parsed)) return null;

  const answers = [];
  const seen = new Set();
  for (const it of parsed) {
    if (!it || typeof it !== 'object') continue;
    let idx = it.index ?? it.n ?? it.i;
    if (typeof idx === 'string') idx = parseInt(idx, 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= questions.length) continue;
    if (seen.has(idx)) continue;
    const raw = it.correct_answer ?? it.answer ?? it.letter ?? it.option;
    if (raw == null) continue;
    // "B", "(b)", "Option D", "Answer: C", "Option 3", digit or the option
    // TEXT — answerLetter maps them all to a positional letter
    const letter = answerLetter(String(raw), questions[idx].options);
    if (!letter) continue;
    if ('ABCDEF'.indexOf(letter) >= questions[idx].options.length) continue;
    seen.add(idx);
    answers.push({ index: idx, answer: letter });
  }
  return answers.length > 0 ? answers : null;
}

// ------------------------------------------------- vision (photos & scans)

/**
 * Extract MCQs from an IMAGE (photo of a paper) or a scanned PDF.
 * Requires the Python AI service with a vision-capable backend
 * (e.g. Ollama + llama3.2-vision, or a HF vision model).
 * Returns [] when the service is missing/unable — callers show a helpful
 * error instead.
 */
export async function parseQuestionsVision(base64Content, mime) {
  if (!base64Content || !mime) return [];

  const provider = await resolveProvider();
  if (provider.kind !== 'local') return [];

  const service = await detectService(provider);
  if (!service) return [];

  // Vision is slow (multi-page scans) — allow up to 5 minutes
  const res = await fetch(`${service.root}/edumock/parse-vision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    },
    body: JSON.stringify({ content: base64Content, mime }),
    signal: AbortSignal.timeout(300_000),
  }).catch(() => null);

  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data?.questions?.length) return [];

  // validate on our side too — defense in depth
  return validateQuestions(
    data.questions.map((q) => ({
      questionText: q.question_text,
      options: q.options,
      correctAnswer: q.correct_answer,
    }))
  );
}

// ------------------------------------------------------- assistant

const APP_CONTEXT = `Aimmers Nepal is a mock-test platform for schools. Key facts:
- Roles: ADMIN (created first), TEACHER (added manually by the admin), STUDENT (can self-register on the Register page).
- Students sign in and take mock tests: 10 questions by default, with a countdown timer. After submitting they see their score and an AI explanation for every question.
- Teachers upload a PDF question bank; the system extracts the questions EXACTLY as written (they are never rewritten), then the teacher creates a test by choosing how many questions to include and a time limit (max 180 minutes).
- The AI is only used to extract questions into structured form and to write explanations — it never changes the questions.
- The AI runs either on Hugging Face (hosted; free plan has small monthly credits and rate limits, PRO is $9/month) or on a fully LOCAL model self-hosted by the school (Ollama, LM Studio, llama.cpp — anything OpenAI-compatible, e.g. llama3.2:1b; unlimited and free). The admin switches between them in Admin → AI Settings — no code changes.
- The admin can create teacher/student accounts and see overall stats.
- Data is stored in Supabase (Postgres) when configured; otherwise the app runs in a demo mode with sample data.
Keep answers short (under 80 words), friendly, and specific to this app.`;

const FALLBACK_REPLIES = [
  {
    match: /(what|about).*(edumock|app|site|this)/i,
    reply:
      "Aimmers Nepal is a platform for schools: teachers upload question banks (PDFs, Word files or even photos of papers), students take timed mock tests, and an AI explains every answer afterwards. Try the demo accounts on the login page!",
  },
  {
    match: /(create|make|new).*(test|exam|quiz)/i,
    reply:
      'Teachers create tests: sign in as a teacher, upload a PDF question bank under Documents, click "Extract Questions", then go to Tests and choose a title, number of questions and a time limit.',
  },
  {
    match: /(upload|pdf|document|question bank)/i,
    reply:
      'Upload a PDF, DOCX, TXT — or a photo/scan of the questions (PNG/JPG). Text files work best with numbered questions, options A-D, and an answer key like "Answer: B". The system stores every question exactly as written — the AI never changes the wording.',
  },
  {
    match: /(account|register|sign ?up|login|log in|password)/i,
    reply:
      'Students can create their own account on the Register page. Teachers and admins are created manually by the admin from the Admin dashboard.',
  },
  {
    match: /(locally|local|offline|own server|self.?host|ollama|lm ?studio|llama)/i,
    reply:
      'Yes — the AI can run fully locally! Install Ollama (or LM Studio / llama.cpp), pull a small model like llama3.2:1b, and the admin can switch to it in Admin → AI Settings. Hugging Face stays as the cloud option (its free plan only includes small monthly credits; the local model is unlimited and free).',
  },
  {
    match: /(free|cost|price|pricing|charge|budget)/i,
    reply:
      'Costs: the app itself is free (Vercel + Supabase free tiers). For AI — Hugging Face\'s free plan includes only about $0.10/month of inference credits (rate-limited), fine for short demos; HF PRO is $9/month. A locally hosted model (Ollama etc.) is unlimited and completely free — the admin can switch to it anytime in Admin → AI Settings.',
  },
  {
    match: /(ai|explain|explanation|hugging|llm|model)/i,
    reply:
      'The AI works two ways and the admin switches between them in Admin → AI Settings: a Hugging Face token (hosted, free tier is small) or a locally hosted model (Ollama / LM Studio / llama.cpp — free and unlimited). It extracts questions without changing them and writes a short explanation for each answer after a test.',
  },
];

const GROUNDED_SYSTEM =
  'You are a study assistant for teachers at a tuition centre. You answer ONLY from the provided passages taken from the teachers\' uploaded question-bank documents. Rules: 1) Use the passages as your only source of subject knowledge. 2) Cite the document you used like [filename] after the sentence it supports. 3) If the passages do not contain the answer, say plainly that the uploaded banks do not cover it — never invent content. 4) Keep the answer under 120 words.';

/**
 * Grounded "ask your materials" reply. passages: [{ filename, subject, text }].
 * Returns { reply, source } or null when no AI is configured.
 */
export async function groundedReply(query, passages) {
  const provider = await resolveProvider();
  if (provider.kind === 'fallback') return null;

  const passageBlock = passages
    .map((p, i) => `--- Passage ${i + 1} [${p.filename}] ---\n${p.text}`)
    .join('\n\n');
  const messages = [
    { role: 'system', content: GROUNDED_SYSTEM },
    {
      role: 'user',
      content: `Passages from the uploaded question banks:\n\n${passageBlock}\n\nTeacher's question: ${query}`,
    },
  ];

  // 1. Preferred: the Python AI service's OpenAI-compatible endpoint (it
  //    routes to whatever backend the service is configured with)
  if (provider.kind === 'local') {
    const service = await detectService(provider);
    if (service) {
      const data = await callService(service, provider, '/v1/chat/completions', {
        model: provider.model,
        messages,
        max_tokens: 300,
        temperature: 0.2,
        stream: false,
      });
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (reply) return { reply, source: 'ai' };
    }
  }

  // 2. Direct chat (local OpenAI-compatible / Hugging Face)
  const answer = await chat(messages, { maxTokens: 300, temperature: 0.2 });
  if (answer) return { reply: answer, source: 'ai' };
  return null;
}

export async function assistantReply(message, history = []) {
  const trimmed = String(message || '').slice(0, 500);
  const provider = await resolveProvider();

  // 1. Preferred: the Python AI service's dedicated endpoint
  if (provider.kind === 'local') {
    const service = await detectService(provider);
    if (service) {
      const data = await callService(service, provider, '/edumock/chat', {
        message: trimmed,
        history: (Array.isArray(history) ? history : [])
          .filter((m) => m && typeof m.content === 'string')
          .slice(-4)
          .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
      });
      if (data?.reply) return { reply: data.reply, source: data.source === 'fallback' ? 'fallback' : 'ai' };
      // failure -> fall through to the generic path
    }
  }

  // 2. Generic chat path (local OpenAI-compatible / Hugging Face)

  const recent = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.content === 'string')
    .slice(-4)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content).slice(0, 400),
    }));

  const answer =
    (await chat(
      [
        { role: 'system', content: APP_CONTEXT },
        ...recent,
        { role: 'user', content: trimmed },
      ],
      { maxTokens: 180, temperature: 0.5 }
    )) || null;

  if (answer) return { reply: answer, source: 'ai' };

  for (const f of FALLBACK_REPLIES) {
    if (f.match.test(trimmed)) return { reply: f.reply, source: 'fallback' };
  }
  return {
    reply:
      "I can tell you about Aimmers Nepal: how tests work, uploading question banks (PDFs, Word files, photos), accounts and roles, costs, or the AI (locally hosted model or Hugging Face — the admin switches in Admin → AI Settings). Ask me about any of those!",
    source: 'fallback',
  };
}
