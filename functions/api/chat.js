// functions/api/chat.js
// POST /api/chat — proxy ke api.jerexd.my.id untuk kirim pesan AI
// Body: { prompt, model, session_id }

const UPSTREAM_URL = 'https://api.jerexd.my.id/api/ai/aichat';
const API_KEY = 'Y907prao3JhPObmg';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  const { request } = context;

  try {
    // Parse body dari frontend
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const { prompt, model, session_id } = body || {};

    // Validasi
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return jsonResponse({ ok: false, error: 'Parameter "prompt" wajib diisi dan tidak boleh kosong' }, 400);
    }

    if (!model || typeof model !== 'string') {
      return jsonResponse({ ok: false, error: 'Parameter "model" wajib diisi' }, 400);
    }

    // Bangun URL ke upstream
    const url = new URL(UPSTREAM_URL);
    url.searchParams.set('apikey', API_KEY);

    // Timeout 60 detik (AI kadang lama)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.trim(),
        model: model,
        session_id: session_id || ('sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9))
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return jsonResponse({
        ok: false,
        error: `Upstream HTTP ${res.status}`
      }, 502);
    }

    const data = await res.json();

    // Ekstrak balasan — cek berbagai format dari upstream
    const reply = extractReply(data);

    // Kalau upstream balikin status false
    if (data.status === false && data.message && !reply) {
      return jsonResponse({
        ok: false,
        error: data.message
      }, 400);
    }

    if (!reply) {
      return jsonResponse({
        ok: false,
        error: 'Upstream tidak memberi balasan',
        raw: data
      }, 502);
    }

    return jsonResponse({
      ok: true,
      reply: String(reply),
      model,
      session_id: session_id || null
    }, 200);

  } catch (err) {
    console.error('Chat error:', err.message);
    if (err.name === 'AbortError') {
      return jsonResponse({ ok: false, error: 'Request timeout (60s). Coba lagi.' }, 504);
    }
    return jsonResponse({ ok: false, error: err.message || 'Unknown error' }, 500);
  }
}

// Helper: coba ambil reply dari berbagai format response
function extractReply(data) {
  if (!data) return null;

  // Cek field top-level
  const topLevel =
    data.result ||
    data.response ||
    data.message ||
    data.answer ||
    data.reply ||
    data.text ||
    data.content;

  if (topLevel && typeof topLevel === 'string') return topLevel;

  // Cek nested di data.data
  if (data.data) {
    if (typeof data.data === 'string') return data.data;

    const nested =
      data.data.result ||
      data.data.response ||
      data.data.message ||
      data.data.answer ||
      data.data.reply ||
      data.data.text ||
      data.data.content;

    if (nested && typeof nested === 'string') return nested;

    // Cek choices (format OpenAI-compatible)
    if (data.data.choices && Array.isArray(data.data.choices)) {
      const choice = data.data.choices[0];
      if (choice?.message?.content) return choice.message.content;
      if (choice?.text) return choice.text;
    }
  }

  // Cek choices top-level (format OpenAI)
  if (data.choices && Array.isArray(data.choices)) {
    const choice = data.choices[0];
    if (choice?.message?.content) return choice.message.content;
    if (choice?.text) return choice.text;
  }

  return null;
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: CORS_HEADERS
  });
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