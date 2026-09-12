/**
 * Health / status endpoint. Reports which mode the app is running in and
 * which AI provider is active — handy during setup and for the demo
 * (never leaks keys or internal URLs).
 */

import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/db';
import { getAiInfo } from '@/lib/ai';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: isDemoMode() ? 'demo' : 'supabase',
    ai: await getAiInfo(),
    time: new Date().toISOString(),
  });
}
