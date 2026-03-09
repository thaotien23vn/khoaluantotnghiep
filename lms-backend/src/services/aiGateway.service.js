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
  return process.env.AI_MODEL || 'gemini-1.5-flash';
}

function getEmbeddingModel() {
  return process.env.AI_EMBEDDING_MODEL || 'text-embedding-004';
}

function buildGeminiUrl(model, action) {
  // action: generateContent | embedContent
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${action}`;
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

  const res = await axios.post(
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

  const res = await axios.post(
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
