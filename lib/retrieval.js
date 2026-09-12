/**
 * Retrieval over uploaded question banks — "ask your materials".
 *
 * BM25 keyword search with ZERO dependencies: no embeddings, no vector
 * database, no external service. It runs instantly on any hardware, works
 * offline, and for a tuition-sized library (tens of banks, a few hundred
 * chunks) it is exactly as useful as a vector search — the passages it
 * finds are handed to the AI, which writes the grounded answer.
 */

const STOPWORDS = new Set(
  `the a an is are was were of in on at to and or for with what which who whom how why when where
   does do did doing can could should would shall may might must be been being it its this that
   these those from by as not no nor if because while during above below up down out off over
   under again further once here there all any both each few more most other some such only own
   same too very just also than then so about into between i you your we they he she him her
   them his hers ours yours will has have had`
    .split(/\s+/)
    .filter(Boolean)
);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Split a document into overlapping passages (~700 chars) on paragraph and
 * sentence boundaries so each passage stays readable for the AI.
 */
export function chunkForRetrieval(text, size = 700, overlap = 120) {
  const clean = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const paragraphs = clean.split(/\n\n+/);
  const chunks = [];
  let cur = '';
  for (const p of paragraphs) {
    // paragraph itself too long? split on sentence ends
    let piece = p;
    while (piece.length > size) {
      let cut = piece.lastIndexOf('. ', size);
      if (cut < size * 0.5) cut = piece.lastIndexOf(' ', size);
      if (cut < size * 0.5) cut = size;
      if (cur) {
        chunks.push(cur);
        cur = '';
      }
      chunks.push(piece.slice(0, cut + 1).trim());
      piece = piece.slice(Math.max(cut + 1, cut + 1 - overlap));
    }
    if (cur.length + piece.length + 1 > size) {
      chunks.push(cur);
      cur = piece;
    } else {
      cur = cur ? `${cur}\n${piece}` : piece;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter((c) => c.length > 40);
}

/**
 * Build a searchable index from documents: [{ id, filename, subject, rawText }].
 * Returns [{ docId, filename, subject, text, tokens, tf, len }].
 */
export function buildRetrievalIndex(documents) {
  const index = [];
  for (const doc of documents || []) {
    const raw = String(doc.rawText || '');
    if (!raw) continue; // photos/scans have no text to search
    for (const text of chunkForRetrieval(raw)) {
      const tokens = tokenize(text);
      if (tokens.length === 0) continue;
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      index.push({
        docId: doc.id,
        filename: doc.filename,
        subject: doc.subject || 'General',
        text,
        tokens,
        tf,
        len: tokens.length,
      });
    }
  }
  return index;
}

/**
 * BM25 search. Returns the top-k passages with scores, best first:
 * [{ docId, filename, subject, text, score }].
 */
export function searchIndex(index, query, k = 5) {
  const qTokens = tokenize(query);
  if (qTokens.length === 0 || index.length === 0) return [];

  const N = index.length;
  const avgLen = index.reduce((a, c) => a + c.len, 0) / N;
  const k1 = 1.5;
  const b = 0.75;

  // document frequency per query term
  const df = new Map();
  for (const t of new Set(qTokens)) {
    let n = 0;
    for (const c of index) if (c.tf.has(t)) n += 1;
    df.set(t, n);
  }

  const scored = [];
  for (const c of index) {
    let score = 0;
    for (const t of new Set(qTokens)) {
      const f = c.tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
      score +=
        idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * c.len) / avgLen)));
    }
    if (score > 0) scored.push({ ...c, score });
  }
  scored.sort((a, b2) => b2.score - a.score);
  return scored.slice(0, k);
}

/**
 * Short snippet around the first query-term hit, for the citation list.
 */
export function makeSnippet(text, query, maxLen = 220) {
  const words = new Set(tokenize(query));
  const lower = text.toLowerCase();
  let best = -1;
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i >= 0 && (best === -1 || i < best)) best = i;
  }
  const start = best > 60 ? best - 60 : 0;
  const snippet = text.slice(start, start + maxLen).replace(/\s+/g, ' ').trim();
  return (start > 0 ? '…' : '') + snippet + (start + maxLen < text.length ? '…' : '');
}
