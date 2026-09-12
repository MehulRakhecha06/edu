/**
 * MCQ (multiple-choice question) extraction.
 *
 * Two strategies:
 *   1. AI parsing (Hugging Face) — preferred when HUGGINGFACE_API_KEY is set.
 *      The model is instructed to copy questions VERBATIM and only structure
 *      them into JSON (the client's hard requirement: never rewrite questions).
 *   2. Deterministic regex parser — always available fallback for the common
 *      textbook format:
 *
 *        1. Question text?
 *        A) option   (also: A. option / (A) option / A - option)
 *        B) option
 *        C) option
 *        D) option
 *        Answer: B   (also: Ans - b / Correct Answer: (B))
 *
 * Both paths run through validateQuestions() so nothing malformed is stored.
 */

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Best-effort correct-answer letter from whatever the AI wrote:
 * "B", "(B)", "Option D", "Answer: C", "D — Same", "2" (digit 1-6) or the
 * full option text. Returns null when nothing recognizable.
 */
export function answerLetter(raw, options) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let m = s.match(/^\(?([A-Fa-f])\)?[\s.,;:—-]*$/);
  if (m) return m[1].toUpperCase();
  // "D — Same" / "B: four" — leading letter, separator, then option text
  m = s.match(/^\(?([A-Fa-f])\)?\s*[—:–;-]\s*\S/);
  if (m) return m[1].toUpperCase();
  m = s.match(/(?:option|answer|ans|key)\s*[:\-]?\s*\(?\s*([A-Fa-f])\s*\)?/i);
  if (m) return m[1].toUpperCase();
  // "Option 3" / "Answer: 2" — digit after the word (1-6, positional)
  m = s.match(/(?:option|answer|ans|key)\s*[:\-]?\s*\(?\s*([1-6])\s*\)?/i);
  if (m) {
    const i = parseInt(m[1], 10) - 1;
    return i < options.length ? LETTERS[i] : null;
  }
  // exact option-text match BEFORE digit interpretation: for numeric options
  // ["3","4","5","6"] the answer "4" means the option TEXT "4" (B), not
  // "4th option" (D).
  const idx = options.findIndex((o) => o.toLowerCase() === s.toLowerCase());
  if (idx >= 0) return LETTERS[idx];
  m = s.match(/^\(?([1-6])\)?$/);
  if (m) {
    const i = parseInt(m[1], 10) - 1;
    return i < options.length ? LETTERS[i] : null;
  }
  return null;
}

// Option label: any letter a-z (banks exist that label options (p)(q)(r)(s)
// or start at other letters). Accepted only when labels run CONSECUTIVELY
// through the alphabet, so prose is never swallowed.
const OPTION_RE = /^\(?([A-Za-z])[).:\-]\s*(.+)$/;
// "(1) option" — numbered options common in Indian exam papers. Strictly
// parenthesized so question numbers like "1. Question" are never mistaken.
const OPTION_NUM_RE = /^\(\s*([1-6])\s*\)\s*(.+)$/;
// "Answer: B" but also "Answer: 2" (maps 1→A, 2→B, …)
const ANSWER_RE = /^(?:correct\s+answer|answer|ans|key)\s*[:\-]?\s*\(?\s*([A-Fa-f1-6])\s*\)?\s*\.?\s*$/i;
// "Q3: Question", "Q3. Question", "Q3 Question" (single space is fine)
const QMARKED_RE = /^Q(?:uestion)?\s*\.?\s*(\d{1,3})\s*[).:\-]?\s+(.+)$/i;
// "1. Question", "1) Question", "12 - Question", "5  Question"
const QNUM_RE = /^(\d{1,3})\s*[).:\-]\s*(.+)$/;
const QNUM_SP_RE = /^(\d{1,3})\s{2,}(.+)$/;

// Section headers that glue themselves to the first question of a section —
// stripped from the stem so "SECTION-A … What are colligative properties…?"
// keeps the real question and loses the header.
const HEADER_PHRASES = [
  /^section\s*[-–—:.]?\s*[a-z0-9]{0,3}\b\.?\s*/i,
  /^multiple\s+choice(?:\s+type)?\s+questions?\s*(?:\(\s*\d+\s*[-–]\s*\d+\s*\))?\s*(?:\(\s*\d+\s*[×x]\s*\d+\s*=\s*\d+\s*\))?\s*/i,
  /^(?:short|long)\s+answer(?:\s+type)?\s+questions?\s*(?:\(\s*\d+\s*[-–]\s*\d+\s*\))?\s*(?:\(\s*\d+\s*[×x]\s*\d+\s*=\s*\d+\s*\))?\s*/i,
  /^directions?\s*[:.\-]\s*/i,
  /^instructions?\s*[:.\-]\s*/i,
];

function stripSectionHeaders(stem) {
  let out = String(stem || '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of HEADER_PHRASES) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out.trim();
}

function normalizeOption(option) {
  return String(option)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/**
 * Draft validation — same as validateQuestions but allows a MISSING answer
 * (correctAnswer: ''). Drafts are saved as pending and the teacher completes
 * the key later (manually or with the AI answer-key completion).
 */
export function validateQuestionDrafts(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const questionText = String(item.questionText || item.question_text || '').trim();
    const options = Array.isArray(item.options)
      ? item.options.map((o) => normalizeOption(o))
      : [];
    if (!questionText || questionText.length < 4 || questionText.length > 1500) continue;
    if (options.length < 2 || options.length > 6) continue;
    if (options.some((o) => !o)) continue;

    const key = questionText.toLowerCase().slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      questionText: questionText.slice(0, 1500),
      options,
      correctAnswer: '',
    });
  }
  return out;
}

export function validateQuestions(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const questionText = String(item.questionText || item.question_text || '').trim();
    let options = Array.isArray(item.options)
      ? item.options.map((o) => normalizeOption(o))
      : [];
    const rawAnswer = String(item.correctAnswer || item.correct_answer || '').trim();
    let correctAnswer = rawAnswer.toUpperCase().match(/^[A-F]$/);

    if (!questionText || questionText.length < 4 || questionText.length > 1500) continue;
    if (options.length < 2 || options.length > 6) continue;
    if (options.some((o) => !o)) continue;

    let correct = correctAnswer ? correctAnswer[0] : null;
    if (!correct || LETTERS.indexOf(correct) >= options.length) {
      // "Option D", "(B)", "Answer: C", digit, or full option text — map it back
      correct = answerLetter(rawAnswer, options);
    }
    if (!correct || LETTERS.indexOf(correct) >= options.length) continue; // cannot grade — skip

    const key = questionText.toLowerCase().slice(0, 120);
    if (seen.has(key)) continue; // dedupe
    seen.add(key);

    out.push({
      questionText: questionText.slice(0, 1500),
      options,
      correctAnswer: correct,
    });
  }
  return out;
}

// Bare-letter option: "A Halved" (no punctuation) — the format several Nepali
// question banks use. Tentative only: accepted when the letters run in strict
// A,B,C… sequence AND at least two consecutive bare letters follow, so a stem
// like "A bar magnet is cut…" (prose starting with "A") is never swallowed.
const BARE_OPTION_RE = /^([A-Za-z])\s+(\S.*)$/;
// Whole-line answer-key entries: "12. B", "12) C", "12 - A", "12 B".
const KEY_LINE_RE = /^(\d{1,3})\s*[.):\-]?\s*\(?\s*([A-Za-z])\s*\)?\.?\s*$/;
// Answer entries that name the question: "Ans 12: B", "Answer to Q5 - C".
const KEY_NAMED_RE = /^(?:ans|answer)\s*(?:to)?\s*Q?\s*(\d{1,3})\s*[.):\-]\s*\(?\s*([A-Za-z])\s*\)?\.?\s*$/i;
// Compact multi-key lines: "1. B 2. A 3. C" / "1-B, 2-C".
const KEY_PAIR_RE = /(\d{1,3})\s*[.):\-]\s*\(?([A-Za-z])\)?/g;

/**
 * Scan the whole text for answer-key entries ("12. B" lists, "Ans 5: C")
 * OUTSIDE the question blocks and return a map questionNumber -> letter.
 * Conservative by design: a whole line must be exactly a key entry (or a
 * run of them), so "12 Bar is a unit…" never matches.
 */
function buildAnswerKeyMap(lines) {
  const map = new Map();
  for (let line of lines) {
    if (!line || line.length > 80) continue;
    // drop a leading label so "Answers: 1. A 2. B" passes the prose guard
    line = line.replace(/^(?:answers?|answer\s*key|key|ans)\s*[:\-]?\s*/i, '');
    const named = line.match(KEY_NAMED_RE);
    if (named) {
      map.set(parseInt(named[1], 10), named[2].toUpperCase());
      continue;
    }
    const single = line.match(KEY_LINE_RE);
    if (single) {
      map.set(parseInt(single[1], 10), single[2].toUpperCase());
      continue;
    }
    // multi-pair line: needs at least two pairs to count ("1. B 2. A")
    if (/\d/.test(line) && line.length <= 60 && !/[a-z]{3,}/i.test(line.replace(KEY_PAIR_RE, ''))) {
      const pairs = [...line.matchAll(KEY_PAIR_RE)];
      if (pairs.length >= 2) {
        for (const [, n, l] of pairs) map.set(parseInt(n, 10), l.toUpperCase());
      }
    }
  }
  return map;
}

/**
 * Deterministic block parser — no AI needed.
 *
 * Returns RAW blocks: { number, questionText, options, correctAnswer }
 * (correctAnswer null when the document has no key for that question).
 * parseMcqs() below wraps this with validation for the fallback path; the
 * hybrid extraction path uses the blocks directly (verbatim text + AI fills
 * only the missing answer keys).
 *
 * Handles the common layouts plus the bare-letter format:
 *
 *   Q001 The pole strength of each piece will be:
 *   A Halved
 *   B Doubled
 *   C One-fourth
 *   D Same
 *   Correct Answer: Option D — Same
 */
export function parseMcqBlocks(rawText) {
  const text = String(rawText || '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  const lines = text.split('\n').map((l) => l.trim());

  const blocks = [];
  let cur = null; // { number, question: [lines], options: [], answer: null, pending: [], firstCode }

  // Option labels may start at ANY letter (a-d, p-s, …). Answers written as
  // letters ("Answer: S" for options p/q/r/s) are converted to the option's
  // POSITION, so the stored key is always the canonical A-F position.
  const relOffset = () =>
    cur && cur.firstCode ? cur.firstCode - 97 : 0; // 'a' = 97
  const shiftLetter = (ch) => {
    const code = ch.toLowerCase().charCodeAt(0) - relOffset();
    return code >= 97 && code <= 122 ? String.fromCharCode(code).toUpperCase() : ch;
  };
  // rewrite standalone letters ("S", "(S)", "Option S", "S — text") to
  // canonical positions, then let answerLetter do the rest
  const mapAnswer = (raw) =>
    relOffset() === 0
      ? answerLetter(raw, cur.options)
      : answerLetter(
          String(raw).replace(/\b([A-Za-z])\b/g, (ch) => shiftLetter(ch)),
          cur.options
        );

  const resolvePending = () => {
    if (!cur || cur.pending.length === 0) return;
    if (cur.pending.length >= 2) {
      // a run of 2+ consecutive bare letters (A Halved / B Doubled…) is an
      // options block — commit it
      for (const [, t] of cur.pending) cur.options.push(normalizeOption(t));
    } else {
      // a single "A …" line is prose ("A bar magnet…"), not an option —
      // keep it in the stem so the question text stays verbatim
      cur.question.push(cur.pending[0][1]);
    }
    cur.pending = [];
  };

  const push = () => {
    if (!cur) return;
    resolvePending();
    const stem = stripSectionHeaders(
      cur.question.join(' ').replace(/\s+/g, ' ').trim()
    );
    if (stem.split(/\s+/).filter(Boolean).length >= 3 && cur.options.length >= 2) {
      blocks.push({
        number: cur.number,
        questionText: stem,
        options: cur.options,
        correctAnswer: cur.answer,
        firstCode: cur.firstCode,
      });
    }
    cur = null;
  };

  for (const line of lines) {
    if (!line) continue;

    // continuation of a bare-letter run? ("B Doubled" after "A Halved" —
    // or "Q Twenty" after "P Ten" for banks that label from other letters)
    const bare = line.match(BARE_OPTION_RE);
    if (cur && cur.options.length + cur.pending.length < 6 && bare) {
      const code = bare[1].toLowerCase().charCodeAt(0);
      const count = cur.options.length + cur.pending.length;
      const first = cur.firstCode || code; // first label decides the sequence
      if (count === 0 || code === first + count) {
        if (count === 0) cur.firstCode = code;
        cur.pending.push([bare[1].toUpperCase(), bare[2]]);
        continue;
      }
    }
    resolvePending();

    const qMatch =
      line.match(QMARKED_RE) || line.match(QNUM_RE) || line.match(QNUM_SP_RE);
    const oMatch = line.match(OPTION_RE);
    const oNumMatch = line.match(OPTION_NUM_RE);
    // tolerant answer line: "Answer: B", "Correct Answer: Option D — Same",
    // "Ans - 2" — answerLetter() resolves the rest against the options
    const aMatch = line.match(
      /^(?:correct\s+answer|answer|ans|key)\s*[:\-]?\s*(.+)$/i
    );

    if (aMatch && cur && !qMatch) {
      cur.answer = mapAnswer(aMatch[1]) || cur.answer;
      continue;
    }

    if (oMatch && cur && cur.options.length < 6) {
      // labels must run consecutively through the alphabet (A,B,C… or
      // p,q,r…); "C)" after "A)" without a "B)" is junk either way
      const code = oMatch[1].toLowerCase().charCodeAt(0);
      const first = cur.firstCode || code;
      if (cur.options.length === 0 || code === first + cur.options.length) {
        if (cur.options.length === 0) cur.firstCode = code;
        cur.options.push(normalizeOption(oMatch[2]));
        continue;
      }
    }

    // "(1) option" — accepted only in strict 1,2,3… order so prose lines
    // that merely start with a bracketed digit are never swallowed.
    if (oNumMatch && cur && !oMatch) {
      const idx = parseInt(oNumMatch[1], 10) - 1;
      if (idx === cur.options.length && cur.options.length < 6) {
        cur.options.push(normalizeOption(oNumMatch[2]));
        continue;
      }
    }

    if (qMatch) {
      push();
      cur = {
        number: parseInt(qMatch[1], 10),
        question: [qMatch[2]],
        options: [],
        answer: null,
        pending: [],
        firstCode: null,
      };
      continue;
    }

    // Continuation of the question text (wrapped lines)
    if (cur && cur.options.length === 0 && !oMatch && !oNumMatch) {
      cur.question.push(line);
    }
  }
  push();

  // Second pass: apply a distant answer key ("12. B" lists elsewhere in the
  // document) to questions that have no inline answer. Key letters are
  // relative to each block's own first option label.
  const keyMap = buildAnswerKeyMap(lines);
  if (keyMap.size > 0) {
    for (const b of blocks) {
      if (b.correctAnswer || b.number == null || !keyMap.has(b.number)) continue;
      const letter = keyMap.get(b.number); // absolute label letter
      const firstCode = b.firstCode || 97;
      const pos = letter.toLowerCase().charCodeAt(0) - firstCode;
      if (pos >= 0 && pos < b.options.length) b.correctAnswer = LETTERS[pos];
    }
  }

  return blocks;
}

/**
 * Collect the document's answer-ish lines ("Answer: B", "12. C", "Answers:
 * 1. A 2. B"…) as context for the AI answer-key completion call. Capped —
 * the model only needs the key material, not the whole document.
 */
export function collectAnswerKeyExcerpt(rawText, maxChars = 4000) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const keyLines = lines.filter(
    (l) =>
      l.length <= 120 &&
      (/^(?:correct\s+answer|answer|ans|key|answers)\b/i.test(l) ||
        KEY_LINE_RE.test(l) ||
        KEY_NAMED_RE.test(l))
  );
  return keyLines.join('\n').slice(0, maxChars);
}

/**
 * Deterministic parser — no AI needed. Validates the blocks from
 * parseMcqBlocks; strict mode only trusts questions that carry an explicit
 * answer key, lenient mode also keeps questions without one as drafts.
 */
export function parseMcqs(rawText, { lenient = false } = {}) {
  const blocks = parseMcqBlocks(rawText);
  const out = [];
  for (const b of blocks) {
    const q = { questionText: b.questionText, options: b.options, correctAnswer: b.correctAnswer };
    if (lenient && !b.correctAnswer) {
      const drafts = validateQuestionDrafts([q]);
      if (drafts.length > 0) out.push(drafts[0]);
    } else {
      const valid = validateQuestions([q]);
      if (valid.length > 0) out.push(valid[0]);
    }
  }
  return out;
}
