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

// Request Queue with Throttling
const requestQueue = [];
const MAX_RPM_PER_KEY = 15; // Gemini free tier: 15 requests/min/key
const MIN_DELAY_MS = Math.ceil(60000 / MAX_RPM_PER_KEY); // 4000ms between requests per key
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_ATTEMPTS = 3;

let lastRequestTime = 0;
let isProcessingQueue = false;
let queueStats = {
  totalQueued: 0,
  totalProcessed: 0,
  totalFailed: 0,
  currentSize: 0,
};

// Global rate limit cooldown - when ALL keys are rate limited
let globalRateLimitCooldown = 0;
const GLOBAL_COOLDOWN_MS = 60000; // 60 seconds
const QUEUE_RETRY_DELAY_MS = 5000; // 5s delay before retrying queued request

function isGlobalRateLimited() {
  if (Date.now() < globalRateLimitCooldown) {
    return true;
  }
  return false;
}

function setGlobalRateLimit() {
  globalRateLimitCooldown = Date.now() + GLOBAL_COOLDOWN_MS;
  logger.error('GLOBAL_RATE_LIMIT_COOLDOWN_SET', { 
    cooldownSeconds: GLOBAL_COOLDOWN_MS / 1000,
    nextAttempt: new Date(globalRateLimitCooldown).toISOString()
  });
}

// Queue management functions
function getQueueStats() {
  return { ...queueStats, currentSize: requestQueue.length };
}

function clearQueue() {
  const cleared = requestQueue.length;
  requestQueue.length = 0;
  queueStats.currentSize = 0;
  logger.info('AI_REQUEST_QUEUE_CLEARED', { cleared });
  return cleared;
}

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  logger.info('AI_QUEUE_PROCESSING_START', { queueSize: requestQueue.length });
  
  while (requestQueue.length > 0) {
    // Check global rate limit
    if (isGlobalRateLimited()) {
      const waitTime = globalRateLimitCooldown - Date.now();
      logger.warn('AI_QUEUE_WAITING_COOLDOWN', { waitMs: waitTime });
      await new Promise(resolve => setTimeout(resolve, Math.max(waitTime, 1000)));
      continue;
    }
    
    // Check circuit breaker
    if (!circuitBreaker.canExecute()) {
      const state = circuitBreaker.getState();
      logger.warn('AI_QUEUE_CIRCUIT_BREAKER_OPEN', { nextAttempt: state.nextAttempt });
      break; // Stop processing until circuit closes
    }
    
    // Throttling: ensure minimum delay between requests
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    const effectiveMinDelay = MIN_DELAY_MS / Math.max(1, apiKeys.length); // Faster with more keys
    if (timeSinceLastRequest < effectiveMinDelay) {
      const waitTime = effectiveMinDelay - timeSinceLastRequest;
      logger.info('AI_QUEUE_THROTTLING', { waitMs: waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Get next request from queue
    const request = requestQueue.shift();
    queueStats.currentSize = requestQueue.length;
    
    try {
      lastRequestTime = Date.now();
      let result;
      
      if (request.type === 'generate') {
        result = await geminiGenerate(request.params);
      } else if (request.type === 'embed') {
        result = await geminiEmbed(request.params);
      }
      
      queueStats.totalProcessed++;
      request.resolve(result);
      logger.info('AI_QUEUE_REQUEST_SUCCESS', { 
        type: request.type, 
        remaining: requestQueue.length 
      });
      
    } catch (err) {
      queueStats.totalFailed++;
      
      // Retry logic for rate limited requests
      if ((err.statusCode === 429 || err.code === 'ALL_KEYS_RATE_LIMITED' || err.code === 'GLOBAL_RATE_LIMITED') && request.retries < MAX_RETRY_ATTEMPTS) {
        request.retries++;
        
        // If global cooldown active, wait longer
        let waitMs = QUEUE_RETRY_DELAY_MS;
        if (isGlobalRateLimited()) {
          waitMs = Math.max(QUEUE_RETRY_DELAY_MS, globalRateLimitCooldown - Date.now() + 1000);
          logger.warn('AI_QUEUE_WAITING_GLOBAL_COOLDOWN', { waitMs });
        }
        
        logger.warn('AI_QUEUE_RETRY', { 
          type: request.type, 
          retry: request.retries,
          maxRetries: MAX_RETRY_ATTEMPTS,
          waitMs
        });
        // Put back at front of queue with delay
        requestQueue.unshift(request);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        request.reject(err);
        logger.error('AI_QUEUE_REQUEST_FAILED', { 
          type: request.type, 
          error: err.message,
          retries: request.retries 
        });
      }
    }
  }
  
  isProcessingQueue = false;
  logger.info('AI_QUEUE_PROCESSING_COMPLETE', { 
    processed: queueStats.totalProcessed,
    failed: queueStats.totalFailed 
  });
}

// Wrapper functions that use queue
async function generateTextWithQueue({ system, prompt, maxOutputTokens, timeoutMs }) {
  if (!isEnabled()) {
    const err = new Error('AI is disabled');
    err.statusCode = 503;
    throw err;
  }
  
  // If queue is too large, process synchronously with backoff
  if (requestQueue.length >= MAX_QUEUE_SIZE) {
    logger.warn('AI_QUEUE_FULL_PROCESSING_SYNC', { queueSize: requestQueue.length });
    return geminiGenerate({ system, prompt, maxOutputTokens, timeoutMs });
  }
  
  return new Promise((resolve, reject) => {
    requestQueue.push({
      type: 'generate',
      params: { system, prompt, maxOutputTokens, timeoutMs },
      resolve,
      reject,
      retries: 0,
      timestamp: Date.now()
    });
    
    queueStats.totalQueued++;
    queueStats.currentSize = requestQueue.length;
    logger.info('AI_REQUEST_QUEUED', { 
      type: 'generate', 
      queueSize: requestQueue.length 
    });
    
    // Start processing queue
    processQueue();
  });
}

async function embedTextWithQueue({ text }) {
  if (!isEnabled()) {
    const err = new Error('AI is disabled');
    err.statusCode = 503;
    throw err;
  }
  
  if (requestQueue.length >= MAX_QUEUE_SIZE) {
    logger.warn('AI_QUEUE_FULL_PROCESSING_SYNC', { queueSize: requestQueue.length });
    return geminiEmbed({ text });
  }
  
  return new Promise((resolve, reject) => {
    requestQueue.push({
      type: 'embed',
      params: { text },
      resolve,
      reject,
      retries: 0,
      timestamp: Date.now()
    });
    
    queueStats.totalQueued++;
    queueStats.currentSize = requestQueue.length;
    logger.info('AI_REQUEST_QUEUED', { 
      type: 'embed', 
      queueSize: requestQueue.length 
    });
    
    processQueue();
  });
}

function getNextApiKey() {
  if (apiKeys.length === 0) return null;
  const index = currentKeyIndex % apiKeys.length;
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
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
  return process.env.AI_MODEL || 'gemini-2.5-flash-latest';
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
  // Check global rate limit cooldown first
  if (isGlobalRateLimited()) {
    const err = new Error(`All API keys rate limited. Global cooldown active until ${new Date(globalRateLimitCooldown).toISOString()}`);
    err.statusCode = 429;
    err.code = 'GLOBAL_RATE_LIMITED';
    throw err;
  }

  // Check circuit breaker
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
    const { key: apiKey, index: keyIndex } = getNextApiKey();
    
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
        
        // If last key, set global cooldown and give up
        if (attempt === maxAttempts - 1) {
          logger.error('ALL_GEMINI_KEYS_EXHAUSTED', { maxAttempts });
          setGlobalRateLimit(); // Set 60s cooldown for all requests
          const err = new Error(`All Gemini API keys exhausted. Global cooldown 60s. Status=${status}`);
          err.statusCode = status || 429;
          err.code = 'ALL_KEYS_RATE_LIMITED';
          throw err;
        }
        
        // Exponential backoff before next key - wait at least 4s for rate limit
        const delayMs = Math.max(4000, Math.min(1000 * Math.pow(2, attempt), 60000));
        logger.warn(`Rate limited, waiting ${delayMs}ms before next attempt...`);
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
    const { key: apiKey, index: keyIndex } = getNextApiKey();
    
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
  generateText: generateTextWithQueue,  // Use queue version
  embedText: embedTextWithQueue,        // Use queue version
  generateTextSync: geminiGenerate,     // Direct sync version
  embedTextSync: geminiEmbed,           // Direct sync version
  getApiKeyCount: () => apiKeys.length,
  getCircuitBreakerState: () => circuitBreaker.getState(),
  isGlobalRateLimited,
  getGlobalCooldownTime: () => globalRateLimitCooldown,
  getQueueStats,
  clearQueue,
};
