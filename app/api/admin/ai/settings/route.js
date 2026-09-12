/**
 * Admin AI settings (Admin only, enforced by the proxy AND re-checked here).
 *   GET  — current saved setting + what the environment provides + which
 *          provider is effectively active right now. Keys are never returned
 *          in full (only a hint like "…abcd").
 *   POST — save the admin's choice. apiKey: '' keeps the existing key;
 *          removeApiKey: true deletes it.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiSettingsSchema } from '@/lib/validators';
import { clearAiSettingCache, getAiInfo } from '@/lib/ai';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function keyHint(key) {
  if (!key) return null;
  return `…${String(key).slice(-4)}`;
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const setting = await db.getSetting('ai');
    const effective = await getAiInfo();

    return NextResponse.json({
      setting: {
        provider: setting?.provider || 'auto',
        local: {
          baseUrl: setting?.local?.baseUrl || '',
          model: setting?.local?.model || '',
          hasApiKey: Boolean(setting?.local?.apiKey),
          apiKeyHint: keyHint(setting?.local?.apiKey),
        },
        huggingface: {
          model: setting?.huggingface?.model || '',
          hasApiKey: Boolean(setting?.huggingface?.apiKey),
          apiKeyHint: keyHint(setting?.huggingface?.apiKey),
        },
      },
      environment: {
        hasLocalUrl: Boolean(process.env.AI_BASE_URL),
        localUrl: process.env.AI_BASE_URL || null,
        localModel: process.env.AI_MODEL || null,
        hasHuggingFaceKey: Boolean(
          process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
        ),
        hfModel: process.env.HF_MODEL || null,
      },
      effective,
    });
  } catch (err) {
    console.error('[ai settings GET]', err?.message);
    return NextResponse.json({ error: 'Failed to load AI settings' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rl = rateLimit(`ai-settings:${requestIp(request)}`, { limit: 30, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = aiSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const current = (await db.getSetting('ai')) || {};

    const next = {
      provider: data.provider,
      local: {
        baseUrl: data.local.baseUrl,
        model: data.local.model,
        apiKey: data.removeLocalApiKey
          ? ''
          : data.local.apiKey || current?.local?.apiKey || '',
      },
      huggingface: {
        model: data.huggingface.model,
        apiKey: data.removeApiKey
          ? ''
          : data.huggingface.apiKey || current?.huggingface?.apiKey || '',
      },
    };

    // Soft validation: warn (but still save) when the chosen provider has no config
    let warning = null;
    if (data.provider === 'local' && next.local.baseUrl && !next.local.apiKey &&
        !/^https?:\/\/localhost|^https?:\/\/127\./i.test(next.local.baseUrl)) {
      warning =
        'Saved, but no API key is set for this custom provider — most cloud APIs (Mistral, Groq, Gemini…) require one.';
    }
    if (data.provider === 'local' && !next.local.baseUrl && !process.env.AI_BASE_URL) {
      warning =
        'Saved, but no local base URL is set — the app will fall back to Hugging Face (if configured) until you provide one.';
    }
    if (data.provider === 'huggingface' && !next.huggingface.apiKey &&
        !(process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN)) {
      warning =
        'Saved, but no Hugging Face API key is set — the app will fall back to the local model (if configured) or built-in answers.';
    }

    await db.setSetting('ai', next);
    clearAiSettingCache();

    const effective = await getAiInfo();
    return NextResponse.json({ ok: true, warning, effective });
  } catch (err) {
    console.error('[ai settings POST]', err?.message);
    return NextResponse.json({ error: 'Could not save AI settings' }, { status: 500 });
  }
}
