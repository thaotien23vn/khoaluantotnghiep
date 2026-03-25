/**
 * Simple logger utility for AI services
 */
class Logger {
  constructor(context) {
    this.context = context || 'APP';
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      context: this.context,
      message,
      ...meta,
    };
  }

  info(message, meta) {
    console.log(JSON.stringify(this.formatMessage('INFO', message, meta)));
  }

  warn(message, meta) {
    console.warn(JSON.stringify(this.formatMessage('WARN', message, meta)));
  }

  error(message, meta) {
    console.error(JSON.stringify(this.formatMessage('ERROR', message, meta)));
  }

  debug(message, meta) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(JSON.stringify(this.formatMessage('DEBUG', message, meta)));
    }
  }
}

module.exports = new Logger();
