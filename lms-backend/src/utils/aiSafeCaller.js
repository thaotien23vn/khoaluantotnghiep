const logger = require('../utils/logger');

/**
 * Safe AI Call Wrapper
 * Bảo vệ tất cả AI calls khỏi crash server
 * 
 * Usage: const result = await safeAiCall(() => aiService.generateQuiz(...))
 */
async function safeAiCall(aiFunction, options = {}) {
  const {
    fallback = null,
    timeout = 180000, // 3 minutes default
    retries = 2,
    onError = null,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`AI call timeout after ${timeout}ms`)), timeout);
      });

      // Race between AI call and timeout
      const result = await Promise.race([
        aiFunction(),
        timeoutPromise
      ]);

      return { success: true, data: result };

    } catch (error) {
      lastError = error;
      
      logger.warn('SAFE_AI_CALL_ERROR', {
        attempt: attempt + 1,
        maxRetries: retries + 1,
        error: error.message,
        stack: error.stack?.substring(0, 200),
      });

      // Don't retry on certain errors
      if (error.statusCode === 400 || error.statusCode === 403) {
        break;
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const delayMs = Math.min(2000 * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  const errorInfo = {
    success: false,
    error: lastError?.message || 'AI service unavailable',
    code: lastError?.code || 'AI_SERVICE_ERROR',
    statusCode: lastError?.statusCode || 503,
  };

  if (onError) {
    onError(errorInfo);
  }

  // Return fallback if provided
  if (fallback !== undefined) {
    return { success: false, ...errorInfo, data: fallback };
  }

  throw errorInfo;
}

/**
 * Wrap an entire AI service with safety
 */
function wrapAiService(service, methodsToWrap) {
  const wrapped = {};
  
  for (const method of methodsToWrap) {
    if (typeof service[method] === 'function') {
      wrapped[method] = async (...args) => {
        const result = await safeAiCall(
          () => service[method](...args),
          { 
            fallback: null,
            timeout: 180000,
            retries: 2,
          }
        );
        
        if (!result.success) {
          throw {
            status: result.statusCode || 503,
            message: result.error,
            code: result.code,
          };
        }
        
        return result.data;
      };
    } else {
      wrapped[method] = service[method];
    }
  }
  
  return wrapped;
}

module.exports = {
  safeAiCall,
  wrapAiService,
};
