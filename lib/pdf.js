/**
 * Server-side text extraction for uploaded documents.
 * PDFs via pdf-parse (pure JS — works on Vercel), TXT/MD read directly,
 * DOCX via mammoth (pure JS). Images carry no text — they are stored as
 * bytes and read by the AI service's vision endpoint instead.
 */

import { PDFParse } from 'pdf-parse';

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

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return { text: result?.text || '', warning: null };
  } finally {
    try {
      await parser.destroy();
    } catch {
      /* ignore */
    }
  }
}
