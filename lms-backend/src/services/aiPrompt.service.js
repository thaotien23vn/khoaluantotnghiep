const db = require('../models');

const { AiPromptTemplate } = db.models;

async function getTemplateOrDefault(key) {
  const tpl = await AiPromptTemplate.findOne({
    where: { key: String(key), isActive: true },
    order: [['id', 'DESC']],
  });

  if (tpl?.template) return tpl.template;

  if (key === 'tutor') {
    return [
      'Bạn là trợ lý học tập cho hệ thống LMS.',
      'Chỉ trả lời dựa trên ngữ cảnh tài liệu được cung cấp (CONTEXT).',
      'Nếu thiếu thông tin trong CONTEXT, hãy nói rõ là không đủ dữ liệu và đề xuất học viên xem lại bài học hoặc hỏi giáo viên.',
      'Trả lời ngắn gọn, rõ ràng, có ví dụ nếu cần.',
    ].join('\n');
  }

  return 'Bạn là trợ lý AI.';
}

module.exports = {
  getTemplateOrDefault,
};
