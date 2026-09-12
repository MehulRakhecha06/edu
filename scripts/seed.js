#!/usr/bin/env node
/**
 * Creates the first ADMIN account in Supabase.
 *
 *   npm run seed
 *
 * Reads env vars from your environment and/or .env.local / .env
 * (tiny built-in parser — no extra dependency needed).
 * Values can be overridden with SEED_ADMIN_* variables — see .env.example.
 */

const fs = require('fs');
const path = require('path');

// ---------- load .env files ----------
for (const file of ['.env.local', '.env']) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log(`
No Supabase configuration found — the app will run in DEMO MODE,
which seeds its own accounts automatically. Nothing to do here.

Demo accounts:
  mehulrakhecha@gmail.com    / Admin@123     (ADMIN)
  tanisharakhecha2@gmail.com / Teacher@123   (TEACHER)
  student@edumock.local      / Student@123   (STUDENT)

To use a real database:
  1. Run supabase/schema.sql in the Supabase SQL editor
  2. Fill NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
  3. Run "npm run seed" again
`);
    return;
  }

  const { createClient } = require('@supabase/supabase-js');
  const bcrypt = require('bcryptjs');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@edumock.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMeImmediately!';
  const name = process.env.SEED_ADMIN_NAME || 'System Admin';

  if (password === 'ChangeMeImmediately!') {
    console.log('⚠️  Using the default admin password. Set SEED_ADMIN_PASSWORD for anything real.');
  }

  // Already exists?
  const { data: existing } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    console.log(`✓ Admin already exists: ${email} — nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { error } = await supabase
    .from('users')
    .insert({ email, name, password_hash: passwordHash, role: 'ADMIN' });

  if (error) {
    if (error.code === '42P01') {
      console.error('✗ The "users" table does not exist yet. Run supabase/schema.sql first.');
    } else {
      console.error('✗ Could not create admin:', error.message);
    }
    process.exit(1);
  }

  console.log(`✓ Admin created: ${email} (password: ${password})`);
  console.log('  Sign in and create teacher accounts from the Admin dashboard.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
