const axios = require('axios');
const logger = require('../utils/logger');

// Multiple API key rotation support
const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').filter(Boolean);
let currentKeyIndex = 0;

// Simple Circuit Breaker to avoid hammering API when failing
class CircuitBreaker {
  constructor(threshold = 5, timeoutMs = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeoutMs = timeoutMs;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0;
  }

  canExecute() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        logger.info('CIRCUIT_BREAKER_HALF_OPEN');
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeoutMs;
      logger.error('CIRCUIT_BREAKER_OPEN', { 
        failureCount: this.failureCount, 
        cooldownSeconds: this.timeoutMs / 1000 
      });
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null
    };
  }
}

const circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures -> open for 60s

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
  return process.env.AI_MODEL || 'gemini-1.5-pro';
}

function getEmbeddingModel() {
  return process.env.AI_EMBEDDING_MODEL || 'gemini-embedding-001';
}

function buildGeminiUrl(model, action) {
  // action: generateContent | embedContent
  let normalized = String(model || '');
  if (normalized.startsWith('models/')) normalized = normalized.slice('models/'.length);
  if (normalized === 'text-embedding-004') normalized = 'gemini-embedding-001';
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalized)}:${action}`;
}

async function geminiGenerate({ system, prompt, maxOutputTokens, timeoutMs = 30000 }) {
  // Check circuit breaker first
  if (!circuitBreaker.canExecute()) {
    const state = circuitBreaker.getState();
    const err = new Error(`Circuit breaker is OPEN. AI service temporarily unavailable. Next attempt: ${state.nextAttempt}`);
    err.statusCode = 503;
    err.code = 'CIRCUIT_BREAKER_OPEN';
    throw err;
  }

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
      circuitBreaker.recordSuccess(); // Reset failure count
      
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
        
        // Exponential backoff before next key
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
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
      
      circuitBreaker.recordFailure(); // Count failure
      
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
  getCircuitBreakerState: () => circuitBreaker.getState(),
};
