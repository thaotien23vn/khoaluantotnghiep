const db = require('../models');

const { AiAuditLog } = db.models;

async function logAiCall({ userId, role, endpoint, provider, model, status, error, inputTokens, outputTokens, cost, courseId, lectureId }) {
  try {
    await AiAuditLog.create({
      userId: userId != null ? Number(userId) : null,
      role: role != null ? String(role) : null,
      endpoint: String(endpoint || ''),
      provider: provider != null ? String(provider) : null,
      model: model != null ? String(model) : null,
      status: String(status || 'ok'),
      error: error != null ? String(error) : null,
      inputTokens: inputTokens != null ? Number(inputTokens) : null,
      outputTokens: outputTokens != null ? Number(outputTokens) : null,
      cost: cost != null ? Number(cost) : null,
      courseId: courseId != null ? Number(courseId) : null,
      lectureId: lectureId != null ? Number(lectureId) : null,
    });
  } catch (_) {
    // avoid throwing from audit logging
  }
}

module.exports = {
  logAiCall,
};
