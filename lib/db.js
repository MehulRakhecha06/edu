/**
 * Database layer.
 *
 * Two modes, chosen automatically at runtime:
 *   1. SUPABASE MODE  — when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *                       are set. All queries run server-side with the service
 *                       role key (bypasses RLS — never expose it to the client).
 *   2. DEMO MODE      — when those vars are missing. An in-memory store with
 *                       seeded demo accounts and a sample question bank, so the
 *                       whole app runs anywhere with zero setup. Data resets on
 *                       server restart.
 *
 * Only server code may import this file.
 */

import { memoryStore, DEMO_USERS } from './store-memory';
import { supabaseStore } from './store-supabase';

export function isDemoMode() {
  return !(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const store = isDemoMode() ? memoryStore : supabaseStore;

export const db = store;
export { DEMO_USERS };
