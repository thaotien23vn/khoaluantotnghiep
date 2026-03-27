const axios = require('axios');
const logger = require('../utils/logger');

// Multiple API key rotation support
const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').filter(Boolean);
let currentKeyIndex = 0;

function getNextApiKey(attempt = 0) {
  if (apiKeys.length === 0) return null;
  const index = (currentKeyIndex + attempt) % apiKeys.length;
  return { key: apiKeys[index].trim(), index };
}

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

function hasApiKeys() {
  return apiKeys.length > 0;
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

async function geminiGenerate({ system, prompt, maxOutputTokens, timeoutMs = 30000 }) {
  if (!hasApiKeys()) {
    const err = new Error('GEMINI_API_KEYS is not configured');
    err.statusCode = 503;
    throw err;
  }

  const model = getModel();
  const url = buildGeminiUrl(model, 'generateContent');

  const maxAttempts = apiKeys.length;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { key: apiKey, index: keyIndex } = getNextApiKey(attempt);
    
    try {
      logger.info('GEMINI_GENERATE_ATTEMPT', { attempt: attempt + 1, keyIndex, maxKeys: apiKeys.length });
      
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
          timeout: timeoutMs,
        }
      );

      // Success - remember this key for next time
      currentKeyIndex = keyIndex;
      
      const text = res?.data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join('') || '';
      return { text, raw: res.data };
      
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data;
      const errorMessage = e?.message;
      const errorCode = e?.code;
      
      // Check if retryable (429 or 503)
      if (status === 429 || status === 503) {
        logger.warn('GEMINI_KEY_RATE_LIMITED', { 
          keyIndex, 
          status, 
          attempt: attempt + 1, 
          maxAttempts,
          errorCode,
          errorMessage: errorMessage?.substring(0, 100)
        });
        
        // If last key, give up
        if (attempt === maxAttempts - 1) {
          logger.error('ALL_GEMINI_KEYS_EXHAUSTED', { maxAttempts });
          const err = new Error(`All Gemini API keys exhausted. Status=${status}`);
          err.statusCode = status || 429;
          throw err;
        }
        
        // Small delay before next key
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      
      // Non-retryable error - log and throw
      logger.error('Gemini API Error:', {
        status,
        errorCode,
        errorMessage,
        detail,
        url,
        model: getModel(),
        keyIndex,
      });
      
      const err = new Error(`Gemini generateContent failed status=${status || 'unknown'} code=${errorCode || 'none'} message=${errorMessage} detail=${detail ? JSON.stringify(detail) : ''}`);
      err.statusCode = Number.isInteger(status) ? status : 502;
      throw err;
    }
  }
}

async function geminiEmbed({ text }) {
  if (!hasApiKeys()) {
    const err = new Error('GEMINI_API_KEYS is not configured');
    err.statusCode = 503;
    throw err;
  }

  const model = getEmbeddingModel();
  const url = buildGeminiUrl(model, 'embedContent');

  const maxAttempts = apiKeys.length;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { key: apiKey, index: keyIndex } = getNextApiKey(attempt);
    
    try {
      logger.info('GEMINI_EMBED_ATTEMPT', { attempt: attempt + 1, keyIndex, maxKeys: apiKeys.length });
      
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

      // Success - remember this key
      currentKeyIndex = keyIndex;
      
      const embedding = res?.data?.embedding?.values;
      if (!Array.isArray(embedding)) {
        const err = new Error('Gemini embedContent returned invalid embedding');
        err.statusCode = 502;
        throw err;
      }

      return { embedding, raw: res.data };
      
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data;
      
      // Check if retryable
      if (status === 429 || status === 503) {
        logger.warn('GEMINI_EMBED_KEY_RATE_LIMITED', { keyIndex, status, attempt: attempt + 1 });
        
        if (attempt === maxAttempts - 1) {
          logger.error('ALL_GEMINI_EMBED_KEYS_EXHAUSTED');
          const err = new Error('All Gemini API keys exhausted for embedding');
          err.statusCode = status || 429;
          throw err;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      
      // Non-retryable
      const err = new Error(`Gemini embedContent failed status=${status || 'unknown'} url=${url} detail=${detail ? JSON.stringify(detail) : ''}`);
      err.statusCode = Number.isInteger(status) ? status : 502;
      throw err;
    }
  }
}

async function generateText({ system, prompt, maxOutputTokens, timeoutMs }) {
  if (!isEnabled()) {
    const err = new Error('AI is disabled');
    err.statusCode = 503;
    throw err;
  }

  return geminiGenerate({ system, prompt, maxOutputTokens, timeoutMs });
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
  getApiKeyCount: () => apiKeys.length,
};
