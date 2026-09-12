/**
 * CSV student import (admin only).
 *   POST /api/admin/users/import  — multipart form with a .csv file
 *
 * CSV format (header row optional, columns in this order or named):
 *   name,email,password
 * Role is always STUDENT. Duplicate emails are skipped and reported.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MAX_ROWS = 300;
const MAX_FILE_BYTES = 1024 * 1024; // 1 MB is plenty for 300 rows

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rl = rateLimit(`csvimport:${requestIp(request)}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many imports. Please wait a bit.' }, { status: 429 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file received' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File is larger than 1 MB.' }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return NextResponse.json({ error: 'The file is empty.' }, { status: 400 });
  }
  if (lines.length > MAX_ROWS + 1) {
    return NextResponse.json({ error: `Too many rows — at most ${MAX_ROWS} students per file.` }, { status: 400 });
  }

  // Detect a header row (name,email,password in any order) and map columns
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.includes('email') && header.includes('name');
  let nameIdx = 0;
  let emailIdx = 1;
  let passIdx = 2;
  if (hasHeader) {
    nameIdx = header.indexOf('name');
    emailIdx = header.indexOf('email');
    passIdx = header.includes('password') ? header.indexOf('password') : -1;
  }

  const rows = hasHeader ? lines.slice(1) : lines;

  // validate everything first — no DB work for invalid rows
  const valid = [];
  const skipped = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNo = i + (hasHeader ? 2 : 1); // human-friendly row number
    const cols = splitCsvLine(rows[i]);
    const name = (cols[nameIdx] || '').slice(0, 120);
    const email = (cols[emailIdx] || '').toLowerCase().slice(0, 200);
    const password = passIdx >= 0 ? cols[passIdx] : (cols[2] || '');

    if (!name) { skipped.push({ row: rowNo, reason: 'Missing name' }); continue; }
    if (!EMAIL_RE.test(email)) { skipped.push({ row: rowNo, reason: `Invalid email "${email || '(empty)'}"` }); continue; }
    if (password.length < 8) { skipped.push({ row: rowNo, reason: 'Password must be at least 8 characters' }); continue; }
    valid.push({ rowNo, name, email, password });
  }

  // hash passwords with bounded concurrency — 300 rows × bcrypt(12) would take
  // ~75s sequentially (timeout risk); 8 at a time finishes in ~10s
  const CONCURRENCY = 8;
  const created = [];
  for (let start = 0; start < valid.length; start += CONCURRENCY) {
    const batch = valid.slice(start, start + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const passwordHash = await bcrypt.hash(row.password, 12);
          await db.createUser({ email: row.email, name: row.name, passwordHash, role: 'STUDENT' });
          created.push(row.email);
        } catch (err) {
          if (err?.code === 'EMAIL_TAKEN' || /already exists/i.test(err?.message || '')) {
            skipped.push({ row: row.rowNo, reason: `${row.email} already has an account` });
          } else {
            skipped.push({ row: row.rowNo, reason: 'Could not create (server error)' });
          }
        }
      })
    );
  }

  return NextResponse.json({
    ok: true,
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
  });
}
