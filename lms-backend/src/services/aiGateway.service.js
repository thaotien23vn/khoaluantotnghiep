const axios = require('axios');

function getEnvInt(name, fallback) {
  const v = process.env[name];
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isEnabled() {
  const enabled = String(process.env.AI_ENABLED || '').toLowerCase();
  if (enabled === 'true') return true;
  if (enabled === 'false') return false;
  return true;
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

function getModel() {
  return process.env.AI_MODEL || 'gemini-flash-latest';
}

function getEmbeddingModel() {
  return process.env.AI_EMBEDDING_MODEL || 'gemini-embedding-001';
}

function buildGeminiUrl(model, action) {
  // action: generateContent | embedContent
  let normalized = String(model || '');
  if (normalized.startsWith('models/')) normalized = normalized.slice('models/'.length);
  if (normalized === 'gemini-1.5-flash') normalized = 'gemini-flash-latest';
  if (normalized === 'gemini-1.5-flash-latest') normalized = 'gemini-flash-latest';
  if (normalized === 'text-embedding-004') normalized = 'gemini-embedding-001';
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalized)}:${action}`;
}

async function geminiGenerate({ system, prompt, maxOutputTokens }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const model = getModel();
  const url = buildGeminiUrl(model, 'generateContent');

  let res;
  try {
    res = await axios.post(
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: system ? `${system}\n\n${prompt}` : prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : getEnvInt('AI_MAX_OUTPUT_TOKENS', 1024),
        },
      },
      {
        params: { key: apiKey },
        timeout: getEnvInt('AI_HTTP_TIMEOUT_MS', 30000),
      }
    );
  } catch (e) {
    const status = e?.response?.status;
    const detail = e?.response?.data;
    const err = new Error(`Gemini generateContent failed status=${status || 'unknown'} url=${url} detail=${detail ? JSON.stringify(detail) : ''}`);
    err.statusCode = Number.isInteger(status) ? status : 502;
    throw err;
  }

  const text = res?.data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join('') || '';

  return {
    text,
    raw: res.data,
  };
}

async function geminiEmbed({ text }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const model = getEmbeddingModel();
  const url = buildGeminiUrl(model, 'embedContent');

  let res;
  try {
    res = await axios.post(
      url,
      {
        content: {
          parts: [{ text: String(text || '') }],
        },
      },
      {
        params: { key: apiKey },
        timeout: getEnvInt('AI_HTTP_TIMEOUT_MS', 30000),
      }
    );
  } catch (e) {
    const status = e?.response?.status;
    const detail = e?.response?.data;
    const err = new Error(`Gemini embedContent failed status=${status || 'unknown'} url=${url} detail=${detail ? JSON.stringify(detail) : ''}`);
    err.statusCode = Number.isInteger(status) ? status : 502;
    throw err;
  }

  const embedding = res?.data?.embedding?.values;
  if (!Array.isArray(embedding)) {
    const err = new Error('Gemini embedContent returned invalid embedding');
    err.statusCode = 502;
    throw err;
  }

  return {
    embedding,
    raw: res.data,
  };
}

async function generateText({ system, prompt, maxOutputTokens }) {
  if (!isEnabled()) {
    const err = new Error('AI is disabled');
    err.statusCode = 503;
    throw err;
  }

  return geminiGenerate({ system, prompt, maxOutputTokens });
}

async function embedText({ text }) {
  if (!isEnabled()) {
    const err = new Error('AI is disabled');
    err.statusCode = 503;
    throw err;
  }

  return geminiEmbed({ text });
}

module.exports = {
  generateText,
  embedText,
};
