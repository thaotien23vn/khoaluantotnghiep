const db = require('../models');

const { AiSetting, AiRolePolicy } = db.models;

function boolFromEnv(name, fallback) {
  const v = String(process.env[name] || '').toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

async function getAiSetting() {
  const row = await AiSetting.findOne({ order: [['id', 'DESC']] });
  if (row) return row;

  // Fallback to env
  return {
    enabled: boolFromEnv('AI_ENABLED', true),
    provider: process.env.AI_PROVIDER || 'gemini',
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
  };
}

async function getRolePolicy(role) {
  const r = String(role || '').toLowerCase();
  const row = await AiRolePolicy.findOne({ where: { role: r }, order: [['id', 'DESC']] });
  if (row) return row;

  return {
    role: r,
    enabled: true,
    dailyLimit: 50,
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 1024) || 1024,
    ragTopK: Number(process.env.AI_RAG_TOP_K || 5) || 5,
  };
}

module.exports = {
  getAiSetting,
  getRolePolicy,
};
