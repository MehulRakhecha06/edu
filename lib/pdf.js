/**
 * Server-side text extraction for uploaded documents.
 *
 * PDFs via unpdf — a self-contained, serverless-native build of pdf.js
 * maintained by the unjs team. Text extraction needs NO browser globals
 * and NO native modules, which is exactly what broke the previous
 * pdf-parse setup on Vercel (pdf-parse relied on the native
 * @napi-rs/canvas binary to provide DOMMatrix — that cannot load in
 * Vercel's serverless runtime, so PDF uploads crashed with
 * "ReferenceError: DOMMatrix is not defined").
 *
 * TXT/MD are read directly; DOCX via mammoth (pure JS). Images carry no
 * text — they are stored as bytes and read by the AI service's vision
 * endpoint instead.
 */

export async function extractText(buffer, isPdf, filename = '') {
  const looksPdf = isPdf || /\.pdf$/i.test(filename || '') || buffer.subarray(0, 4).toString('latin1') === '%PDF';
  const looksDocx = /\.docx$/i.test(filename || '') || buffer.subarray(0, 2).toString('latin1') === 'PK';

  if (looksDocx && !looksPdf) {
    // Word document — extract the raw text (mammoth is pure JS)
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ buffer });
    return { text: result?.value || '', warning: null };
  }

  if (!looksPdf) {
    // Plain text / markdown
    return { text: buffer.toString('utf8'), warning: null };
  }

  // PDF — unpdf's extractText works in every JS runtime (no DOM, no
  // canvas, no native binaries) and returns { totalPages, text }.
  const { extractText: unpdfExtract } = await import('unpdf');
  const result = await unpdfExtract(new Uint8Array(buffer), { mergePages: true });
  return { text: result?.text || '', warning: null };
}
