// functions/api/models.js
// GET /api/models — proxy ke api.jerexd.my.id untuk ambil daftar model

const UPSTREAM_URL = 'https://api.jerexd.my.id/api/ai/aichat';
const API_KEY = 'Y907prao3JhPObmg';

// Fallback 26 model kalau upstream gagal
const FALLBACK_MODELS = [
  'chatday/ai-chat',
  'openai/gpt-5.6-terra',
  'openai/gpt-5.5',
  'openai/gpt-5.4',
  'openai/gpt-5.3-chat',
  'openai/gpt-5.1-instant',
  'openai/gpt-5',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'xai/grok-4.1-fast-non-reasoning',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4.5',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-opus-4.7',
  'anthropic/claude-opus-4.8',
  'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-v3.2-thinking',
  'google/gemini-3.1-pro-preview',
  'google/gemini-3-pro-preview',
  'google/gemini-3.1-flash-lite',
  'alibaba/qwen3-max',
  'meta/llama-4-maverick',
  'moonshotai/kimi-k2.6'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300' // cache 5 menit
};

export async function onRequestGet(context) {
  try {
    const url = new URL(UPSTREAM_URL);
    url.searchParams.set('apikey', API_KEY);
    url.searchParams.set('prompt', 'hi');
    url.searchParams.set('model', 'list');
    url.searchParams.set('session_id', 'sess_' + Date.now());

    // Timeout 10 detik
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url.toString(), {
      method: 'POST',
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`Upstream HTTP ${res.status}, pakai fallback`);
      return fallbackResponse();
    }

    const data = await res.json();

    // Kalau model=list sukses, balikin model dari upstream
    if (data.models && Array.isArray(data.models) && data.models.length > 0) {
      return new Response(JSON.stringify({
        ok: true,
        source: 'upstream',
        total: data.models.length,
        models: data.models
      }), { status: 200, headers: CORS_HEADERS });
    }

    console.warn('Upstream tidak balikin models, pakai fallback');
    return fallbackResponse();

  } catch (err) {
    console.error('Fetch upstream gagal:', err.message);
    return fallbackResponse();
  }
}

function fallbackResponse() {
  return new Response(JSON.stringify({
    ok: true,
    source: 'fallback',
    total: FALLBACK_MODELS.length,
    models: FALLBACK_MODELS
  }), { status: 200, headers: CORS_HEADERS });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}