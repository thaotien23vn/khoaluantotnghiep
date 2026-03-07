/**
 * Input validation and sanitization middleware
 * Prevents XSS and other injection attacks
 */

const validateInput = (req, res, next) => {
  const skipKeys = new Set(['password', 'confirmPassword', 'token', 'resetToken', 'verificationToken']);

  // Recursive function to sanitize string values
  const sanitizeValue = (value, key) => {
    if (key && skipKeys.has(key)) {
      return value;
    }
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return value.replace(/[<>\"\'`]/g, '');
    }
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((v) => sanitizeValue(v));
      }
      const sanitized = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          sanitized[key] = sanitizeValue(value[key], key);
        }
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize request body and query
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};

module.exports = validateInput;
